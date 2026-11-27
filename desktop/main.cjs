const {app,BrowserWindow,Menu,Tray,ipcMain,screen,nativeImage,globalShortcut,shell}=require('electron');
const fs=require('node:fs');
const path=require('node:path');
const {pathToFileURL}=require('node:url');
const {readLoginItem,setLoginItem}=require('./login-items.cjs');
const {createQuickLaunch,requestedToolShortcuts,storedToolShortcuts}=require('./quick-launch.cjs');
const ShortcutRegistry=require('../tool-shortcuts.js');
const quickLaunch=createQuickLaunch(globalShortcut,tool=>openTool(tool));
const factory=require('./factory-defaults.json');
const {platformOptions,configureWidgetSpaces}=require('./platform.cjs');
const platform=platformOptions();

app.setName('Meridian');
const smoke=process.argv.includes('--smoke-test');
const preview=process.argv.includes('--preview-test');
if(smoke||preview)app.setPath('userData',process.env.MERIDIAN_TEST_PROFILE||path.join(app.getPath('temp'),'meridian-test-'+process.pid));
const locked=app.requestSingleInstanceLock();
if(!locked){app.quit();return;}
if(process.platform==='win32')app.setAppUserModelId('com.meridian.worldclock');
let manager,widget,tray,tooltip,quitting=false,saveTimer,trayClickTimer,lastTrayDoubleClick=0,pendingTool=null,appliedPinned=null;
const widgetGeometry=require('./widget-geometry.cjs').createWidgetGeometry({getWindow:()=>widget,getWorkArea:bounds=>screen.getDisplayMatching(bounds).workArea});
const widgetVisibility=require('./widget-visibility.cjs').createWidgetVisibility({getWindow:()=>widget,locate:locateWidget});
const widgetEdge=require('./widget-edge.cjs');
const edgeState={edge:null,hidden:false,visibleBounds:null};
let smokeCursor=null;
const widgetDrag=require('./widget-drag.cjs').createWidgetDrag({getWindow:()=>widget,getCursor:()=>screen.getCursorScreenPoint(),getSize:()=>widgetGeometry.size(),onMove:()=>widgetGeometry.moved(),onDrop:()=>commitWidgetDrop(),canDrag:()=>!!store.state&&!store.state.locked&&store.state.enabled});
const edgeHover=widgetEdge.createEdgeHover({getWindow:()=>widget,getCursor:()=>smoke&&smokeCursor?smokeCursor:screen.getCursorScreenPoint(),getDock:()=>edgeState,getArea:edgeArea,isDragging:()=>widgetDrag.isDragging(),hide:hideEdgeWidget,reveal:revealEdgeWidget});
const storePath=path.join(app.getPath('userData'),'settings.json');
const currencyService=require('./currency-service.cjs').createCurrencyService({file:path.join(app.getPath('userData'),'currency-rates.json')});
let hasUserConfig=false;
let store={state:factory.state,preferences:{toolShortcuts:ShortcutRegistry.empty(),...factory.preferences,autoCheckUpdates:true},widgetBounds:null,managerBounds:null};
try{const saved=JSON.parse(fs.readFileSync(storePath,'utf8'));store={...store,...saved,preferences:{...store.preferences,...saved.preferences,toolShortcuts:storedToolShortcuts(saved.preferences)}};hasUserConfig=true;}catch(_){}
store.preferences.autoCheckUpdates=store.preferences.autoCheckUpdates!==false;
store.preferences.toolShortcuts=storedToolShortcuts(store.preferences);delete store.preferences.quickLaunchEnabled;delete store.preferences.quickLaunchAccelerator;
const rendererPath=path.join(__dirname,'app.html');
const rendererUrl=pathToFileURL(rendererPath).href;
const updates=require('./updates.cjs').createUpdates({updater:require('electron-updater').autoUpdater,version:app.getVersion(),supported:app.isPackaged&&!platform.mac&&!smoke&&!preview,getAutomatic:()=>store.preferences.autoCheckUpdates,notify:state=>send(manager,'meridian:update-state',state),beforeInstall:()=>{persist();quitting=true;widgetDrag.end();tooltip?.hide()},installFailed:()=>{quitting=false}});

const clamp=(n,min,max)=>Math.max(min,Math.min(max,n));

function persist(){
  fs.mkdirSync(path.dirname(storePath),{recursive:true});
  const temporary=storePath+'.tmp';
  fs.writeFileSync(temporary,JSON.stringify(store,null,2));
  fs.renameSync(temporary,storePath);
}
function persistSoon(){clearTimeout(saveTimer);saveTimer=setTimeout(()=>{try{persist()}catch(error){console.error('Could not save preferences:',error.message)}},180);}
function alive(window){return window&&!window.isDestroyed();}
function trusted(event){return [manager,widget].some(window=>alive(window)&&window.webContents.id===event.sender.id);}
function send(window,channel,data){if(alive(window)&&!window.webContents.isLoading())window.webContents.send(channel,data);}
function preferences(){
  const actual=app.isPackaged?readLoginItem(app,process.execPath):{launchAtLogin:false,startupBlocked:false};
  return {...store.preferences,...quickLaunch.status(store.preferences.toolShortcuts),launchAtLogin:actual.launchAtLogin,startupBlocked:actual.startupBlocked,available:app.isPackaged,platform:process.platform,version:app.getVersion()};
}
function cleanState(value){
  if(!value||typeof value!=='object'||!Array.isArray(value.zones))return null;
  const zones=[];
  for(const item of value.zones.slice(0,450)){
    if(!item||typeof item.id!=='string'||zones.some(z=>z.id===item.id))continue;
    try{new Intl.DateTimeFormat('en',{timeZone:item.id});zones.push({id:item.id,visible:item.visible!==false,alias:typeof item.alias==='string'?item.alias.slice(0,40):''})}catch(_){}
  }
  const next={zones,widgetSizes:{}};
  next.showMilliseconds=value.showMilliseconds!==false;
  next.preferAlias=value.preferAlias!==false;next.autoHideHeader=value.autoHideHeader===true;
  next.dateMode=value.dateMode==='relative'?'relative':'short';
  next.customBackground=value.customBackground===true;next.backgroundColor=/^#[\da-f]{6}$/i.test(value.backgroundColor)?value.backgroundColor:'#24303c';
  next.customTextColor=value.customTextColor===true;next.textColor=/^#[\da-f]{6}$/i.test(value.textColor)?value.textColor:'#f3f6fa';
  next.customCardBackground=value.customCardBackground===true;next.cardBackgroundColor=/^#[\da-f]{6}$/i.test(value.cardBackgroundColor)?value.cardBackgroundColor:'#ffffff';
  next.cardOpacity=clamp(Number.isFinite(value.cardOpacity)?value.cardOpacity:100,0,100);
  for(const key of ['enabled','pinned','seconds','locked','hour24','date'])next[key]=typeof value[key]==='boolean'?value[key]:!['seconds','locked'].includes(key);
  for(const key of ['appTheme'])next[key]=['system','light','dark'].includes(value[key])?value[key]:'system';
  next.widgetTheme=['light','dark'].includes(value.widgetTheme)?value.widgetTheme:['light','dark'].includes(value.theme)?value.theme:'dark';
  next.widgetStyle=['classic','compact','cards','analog'].includes(value.widgetStyle)?value.widgetStyle:'classic';
  next.edgeSnap=value.edgeSnap!==false;
  next.edgeHide=value.edgeHide===true;
  next.listLayouts=Object.fromEntries(['classic','compact'].map(style=>[style,value.listLayouts?.[style]==='vertical'?'vertical':'horizontal']));
  next.backgroundOpacity=clamp(Number.isFinite(value.backgroundOpacity)?value.backgroundOpacity:Number.isFinite(value.opacity)?value.opacity:100,0,100);
  next.foregroundOpacity=clamp(Number.isFinite(value.foregroundOpacity)?value.foregroundOpacity:100,0,100);
  for(const key of ['classic','compact','cards','analog']){
    const size=value.widgetSizes?.[key];
    if(size&&Number.isSafeInteger(Math.round(size.width))&&Number.isSafeInteger(Math.round(size.height)))next.widgetSizes[key]={width:Math.max(Math.round(size.width),110),height:Math.max(Math.round(size.height),1)};
  }
  if(value.fontConfig&&typeof value.fontConfig==='object'&&!Array.isArray(value.fontConfig)){
    next.fontConfig={};
    for(const key of ['标题栏','国家','别称','时间','上午/下午','日期','相对日期','时区','表盘数字','悬停标题','悬停内容','悬停别称','悬停国家','悬停城市','悬停时间','悬停上午/下午','悬停日期','悬停相对日期','悬停时区']){
      const font=value.fontConfig[key];
      if(font===null||(typeof font==='number'&&Number.isFinite(font)&&font>=6&&font<=96)||(['上午/下午','悬停上午/下午'].includes(key)&&typeof font==='string'&&/^\d+(?:\.\d+)?%$/.test(font)))next.fontConfig[key]=font;
    }
  }
  return next;
}
if(store.state)store.state=cleanState(store.state);
function clampBounds(bounds,fallback){
  const merged={...fallback,...bounds};
  const display=screen.getDisplayMatching({x:Math.round(merged.x),y:Math.round(merged.y),width:Math.round(merged.width),height:Math.round(merged.height)}).workArea;
  return {x:Math.round(clamp(merged.x,display.x,display.x+Math.max(0,display.width-merged.width))),y:Math.round(clamp(merged.y,display.y,display.y+Math.max(0,display.height-merged.height))),width:Math.round(merged.width),height:Math.round(merged.height)};
}
function clearEdgeHideTimer(){edgeHover.reset()}
function stopEdgeRevealMonitor(){edgeHover.stop()}
function edgeArea(bounds){return screen.getDisplayMatching(bounds).workArea}
function revealEdgeWidget(){
  clearEdgeHideTimer();
  if(!edgeState.hidden||!alive(widget))return;
  const bounds=edgeState.visibleBounds;
  edgeState.hidden=false;
  if(bounds)widget.setBounds(bounds,false);
  edgeState.visibleBounds=bounds?{...bounds}:null;
  // Re-assert topmost after the native window moves back into view. This keeps
  // edge hiding compatible with the independent "always on top" setting.
  // On Windows, moving a transparent window back from offscreen can leave its
  // compositor surface occluded. Show without taking keyboard focus and ask
  // Chromium to repaint rather than waiting for a user click to activate it.
  if(!platform.mac)widget.hide();widget.showInactive();
  widget.webContents.invalidate();
  syncWidgetTopmost(true);
  for(const delay of [100,250,500])setTimeout(()=>{if(alive(widget)&&!edgeState.hidden)syncWidgetTopmost(true)},delay);
  scheduleEdgeHide();
  persistSoon();
}
function hideEdgeWidget(){
  clearEdgeHideTimer();
  if(!alive(widget)||!store.state?.enabled||!store.state.edgeHide||!edgeState.edge||widgetDrag.isDragging())return;
  const bounds=widget.getBounds(),area=edgeArea(bounds),hidden=widgetEdge.hiddenBounds(bounds,area,edgeState.edge);
  edgeState.visibleBounds={...bounds};edgeState.hidden=true;
  if(platform.mac){tooltip?.hide();widget.hide();persistSoon();return}
  widget.setMinimumSize(1,1);
  widget.setBounds(hidden,false);store.widgetBounds={...bounds};persistSoon();
}
function scheduleEdgeHide(){
  if(!store.state?.enabled||!store.state.edgeHide||!edgeState.edge){edgeHover.stop();return}
  edgeHover.start();
}
function commitWidgetDrop(){
  if(!alive(widget)||!store.state?.enabled)return;
  if(edgeState.hidden)revealEdgeWidget();
  const current=widget.getBounds(),result=widgetEdge.snapToEdges(current,edgeArea(current));
  if(store.state.edgeSnap&&result.changed){
    widget.setBounds(result.bounds,false);widgetGeometry.moved();edgeState.visibleBounds=widget.getBounds();
  }else edgeState.visibleBounds={...current};
  edgeState.edge=result.edge;
  if(!edgeState.edge)clearEdgeHideTimer();else scheduleEdgeHide();
  persistSoon();
}
function refreshEdgeBehavior(){
  if(!alive(widget)||!store.state?.enabled)return;
  const current=edgeState.hidden?edgeState.visibleBounds:widget.getBounds(),result=widgetEdge.snapToEdges(current,edgeArea(current));
  edgeState.edge=result.edge;
  if(store.state.edgeSnap&&result.changed&&!edgeState.hidden){widget.setBounds(result.bounds,false);widgetGeometry.moved();edgeState.visibleBounds=widget.getBounds()}
  if(!store.state.edgeHide){edgeHover.stop();if(edgeState.hidden)revealEdgeWidget();return}
  scheduleEdgeHide();
}
function showManager(){
  if(!alive(manager))return;
  if(manager.isMinimized())manager.restore();
  manager.show();manager.focus();
}
function locateWidget(window){
  if(edgeState.hidden)revealEdgeWidget();
  const bounds=window.getBounds(),placed=clampBounds(bounds,bounds);
  if(placed.x!==bounds.x||placed.y!==bounds.y){const size=widgetGeometry.size();window.setBounds({x:placed.x,y:placed.y,width:size.width,height:size.height},false);widgetGeometry.moved()}
}
function showWidget({focus=true}={}){
  if(!store.state||!alive(widget))return;
  revealEdgeWidget();
  store.state.enabled=true;updateNativeState();syncWidgetTopmost(true);widgetVisibility.show({focus});
}
function toggleWidget(){if(store.state?.enabled&&widgetVisibility.isShowing())setEnabled(false);else showWidget()}
function showApplication(){showManager();showWidget()}
function openTool(tool){
  if(tool==='widget'){toggleWidget();return}
  if(!Object.hasOwn(ShortcutRegistry.tools,tool)||!alive(manager))return;
  pendingTool=tool;showManager();
  if(!manager.webContents.isLoading()){send(manager,'meridian:open-tool',pendingTool);pendingTool=null;}
}
function broadcastState(exclude){for(const window of [manager,widget])if(alive(window)&&window.webContents.id!==exclude)send(window,'meridian:state',store.state);}
function syncWidgetTopmost(force=false){
  if(!alive(widget)||!store.state)return;
  const pinned=!!store.state.pinned;if(force||appliedPinned!==pinned){widget.setAlwaysOnTop(pinned,...(platform.mac?['floating']:[]));appliedPinned=pinned}
  tooltip?.raise();
}
function updateNativeState(exclude,reveal=false){
  if(!store.state||!alive(widget))return;
  if(!store.state.enabled)revealEdgeWidget();
  if(store.state.locked||!store.state.enabled)widgetDrag.end();
  widget.setMinimumSize(edgeState.hidden?1:110,1);
  if(!store.state.enabled)widget.hide();else if(reveal&&!smoke)widgetVisibility.show({focus:false});
  syncWidgetTopmost();refreshEdgeBehavior();broadcastState(exclude);updateTray();persistSoon();
}
function setEnabled(enabled){if(!store.state)return;store.state.enabled=enabled;updateNativeState(undefined,enabled);}
function fitWidget(size){
  if(edgeState.hidden)revealEdgeWidget();
  widgetGeometry.fit(size);
  if(store.state?.edgeHide)refreshEdgeBehavior();
}
function updateTray(){
  if(!tray)return;
  tray.setContextMenu(Menu.buildFromTemplate([
    {label:'显示并定位挂件',click:()=>showWidget()},
    {label:'打开时区助手',click:showManager},
    {type:'separator'},
    {label:'隐藏挂件',enabled:store.state?.enabled!==false,click:()=>setEnabled(false)},
    {label:'挂件始终置顶',type:'checkbox',checked:store.state?.pinned!==false,click:item=>{if(store.state){store.state.pinned=item.checked;updateNativeState()}}},
    {type:'separator'},
    {label:'退出 Meridian',click:()=>app.quit()}
  ]));
}
function secureWindow(window){
  window.webContents.setWindowOpenHandler(()=>({action:'deny'}));
  window.webContents.on('will-navigate',(event,url)=>{if(url.split('?')[0]!==rendererUrl)event.preventDefault()});
  window.webContents.session.setPermissionRequestHandler((_contents,permission,callback)=>callback(permission==='clipboard-sanitized-write'));
  window.webContents.on('render-process-gone',(_event,details)=>console.error('Renderer stopped:',details.reason));
}
function createWidgetWindow(bounds){
  widgetDrag.end();
  const previous=widget,previousTooltip=tooltip;widgetGeometry.reset();appliedPinned=null;
  if(alive(previous)){store.widgetBounds=edgeState.hidden&&edgeState.visibleBounds?{...edgeState.visibleBounds}:previous.getBounds();previous.destroy()}
  if(previousTooltip&&!previousTooltip.window.isDestroyed())previousTooltip.window.destroy();
  const webPreferences={preload:path.join(__dirname,'preload.cjs'),contextIsolation:true,nodeIntegration:false,sandbox:true,backgroundThrottling:false};
  const current=widget=new BrowserWindow({...bounds,...platform.widget,alwaysOnTop:!!store.state?.pinned,minWidth:110,minHeight:1,show:false,frame:false,transparent:true,backgroundColor:'#00000000',hasShadow:false,roundedCorners:true,resizable:false,maximizable:false,minimizable:false,skipTaskbar:true,title:'Meridian 桌面挂件',icon:path.join(__dirname,'assets',platform.icon),webPreferences});
  configureWidgetSpaces(current);
  secureWindow(current);
  current.setHasShadow(false);


  const currentTooltip=tooltip=require('./tooltip-window.cjs')(current);
  for(const event of ['hide','closed'])current.on(event,()=>{widgetDrag.end();clearEdgeHideTimer();if(!platform.mac||!edgeState.hidden)stopEdgeRevealMonitor();currentTooltip.hide()});
  current.on('blur',()=>widgetDrag.end());
  let tooltipPosition=current.getPosition();
  current.on('move',()=>{
    const position=current.getPosition();
    if(position.some((value,index)=>value!==tooltipPosition[index])){
      currentTooltip.hide();
      if(widgetDrag.isDragging()){
        widgetGeometry.moved();edgeState.edge=null;edgeState.hidden=false;edgeState.visibleBounds=current.getBounds();clearEdgeHideTimer();
      }
      const bounds=current.getBounds();send(current,'meridian:moved',{x:bounds.x,y:bounds.y});
    }
    tooltipPosition=position;
  });
  current.on('close',event=>{if(!quitting){event.preventDefault();setEnabled(false)}});
  current.on('move',()=>{store.widgetBounds=edgeState.hidden&&edgeState.visibleBounds?{...edgeState.visibleBounds}:current.getBounds();persistSoon()});
  current.on('resize',()=>{
    const bounds=current.getBounds();if(!edgeState.hidden)edgeState.visibleBounds={...bounds};store.widgetBounds=edgeState.hidden&&edgeState.visibleBounds?{...edgeState.visibleBounds}:bounds;
    send(current,'meridian:resized',{width:bounds.width,height:bounds.height});persistSoon();
  });
  current.webContents.on('context-menu',()=>Menu.buildFromTemplate([
    {label:'打开管理界面',click:showManager},
    {label:'始终置顶',type:'checkbox',checked:!!store.state?.pinned,click:item=>{store.state.pinned=item.checked;updateNativeState()}},
    {label:'隐藏挂件',click:()=>setEnabled(false)},
    {type:'separator'},
    {label:'退出 Meridian',click:()=>app.quit()}
  ]).popup({window:current}));
  current.once('ready-to-show',()=>{if(widget===current)updateNativeState(undefined,true)});
  current.loadFile(rendererPath,{query:{window:'widget'}});
}
function createWindows(){
  Menu.setApplicationMenu(platform.mac?Menu.buildFromTemplate([{label:'Meridian',submenu:[{role:'about'},{type:'separator'},{label:'打开管理界面',click:showManager},{type:'separator'},{role:'quit'}]},{role:'editMenu'},{role:'windowMenu'}]):null);
  const area=screen.getPrimaryDisplay().workArea;
  const mainDefaults={x:area.x+Math.max(0,(area.width-1180)/2),y:area.y+Math.max(0,(area.height-850)/2),width:Math.min(1180,area.width),height:Math.min(850,area.height)};
  const mainBounds=clampBounds(store.managerBounds,mainDefaults);
  const webPreferences={preload:path.join(__dirname,'preload.cjs'),contextIsolation:true,nodeIntegration:false,sandbox:true,backgroundThrottling:false};
  manager=new BrowserWindow({...mainBounds,...platform.manager,minWidth:820,minHeight:640,show:false,title:'Meridian · 时区助手',backgroundColor:'#202020',icon:path.join(__dirname,'assets',platform.icon),webPreferences});
  secureWindow(manager);
  manager.webContents.on('did-finish-load',()=>{if(pendingTool){send(manager,'meridian:open-tool',pendingTool);pendingTool=null;}});
  manager.on('close',event=>{if(!quitting){event.preventDefault();manager.hide()}});
  for(const name of ['move','resize'])manager.on(name,()=>{if(!manager.isMaximized()){store.managerBounds=manager.getBounds();persistSoon()}});
  const widgetDefaults={x:area.x+area.width-300,y:area.y+60,width:250,height:330};
  const widgetBounds=clampBounds(store.widgetBounds,widgetDefaults);
  createWidgetWindow(widgetBounds);
  const icon=nativeImage.createFromPath(path.join(__dirname,'assets',platform.mac?'trayTemplate.png':'tray.png'));
  if(platform.mac)icon.setTemplateImage(true);
  tray=new Tray(icon);tray.setToolTip('Meridian · 时区助手');
  tray.on('double-click',()=>{clearTimeout(trayClickTimer);lastTrayDoubleClick=Date.now();showManager()});
  tray.on('click',()=>{if(Date.now()-lastTrayDoubleClick<400)return;clearTimeout(trayClickTimer);trayClickTimer=setTimeout(()=>showWidget(),250)});
  updateTray();
  manager.loadFile(rendererPath,{query:{window:'manager'}});
  const startup=process.argv.includes('--autostart')||(platform.mac&&app.isPackaged&&app.getLoginItemSettings().wasOpenedAtLogin);
  manager.once('ready-to-show',()=>{if(!smoke&&(!startup||!store.preferences.startMinimized))showManager()});
}

ipcMain.on('meridian:initial',(event)=>{event.returnValue=trusted(event)?{state:store.state,preferences:preferences(),version:app.getVersion(),packaged:app.isPackaged}:null});
ipcMain.on('meridian:renderer-ready',(event,state)=>{
  if(!trusted(event))return;
  if(!store.state)store.state=cleanState(state);
  if(store.state)updateNativeState();
});
ipcMain.on('meridian:save-state',(event,state)=>{
  if(!trusted(event))return;const next=cleanState(state);if(!next)return;const wasEnabled=store.state?.enabled;store.state=next;updateNativeState(event.sender.id,wasEnabled===false&&next.enabled);
});
ipcMain.on('meridian:begin-drag',event=>{if(alive(widget)&&event.sender.id===widget.webContents.id){revealEdgeWidget();widgetDrag.begin()}});
ipcMain.on('meridian:end-drag',event=>{if(alive(widget)&&event.sender.id===widget.webContents.id)widgetDrag.end()});
ipcMain.on('meridian:open-manager',event=>{if(trusted(event))showManager()});
ipcMain.on('meridian:titlebar-theme',(event,theme)=>{
  if(platform.mac||!alive(manager)||event.sender.id!==manager.webContents.id)return;
  const light=theme==='light';
  manager.setTitleBarOverlay({color:light?'#ededed':'#1b1b1b',symbolColor:light?'#252525':'#ededed',height:48});
});
ipcMain.on('meridian:hide-widget',event=>{if(trusted(event))setEnabled(false)});
ipcMain.on('meridian:show-widget',event=>{if(trusted(event))showWidget()});
ipcMain.on('meridian:show-tooltip',(event,data)=>{if(alive(widget)&&!edgeState.hidden&&event.sender.id===widget.webContents.id)tooltip?.show(data)});
ipcMain.on('meridian:hide-tooltip',event=>{if(alive(widget)&&event.sender.id===widget.webContents.id)tooltip?.hide()});
ipcMain.on('meridian:tooltip-measured',(event,measurement)=>{if(tooltip&&!tooltip.window.isDestroyed()&&event.sender.id===tooltip.window.webContents.id)tooltip.measure(measurement)});
ipcMain.on('meridian:fit-widget',(event,size)=>{if(alive(widget)&&event.sender.id===widget.webContents.id)fitWidget(size)});
ipcMain.on('meridian:widget-size',(event,size)=>{if(trusted(event))fitWidget(size)});
for(const [channel,action] of [['read',()=>currencyService.read()],['save',patch=>currencyService.save(patch)],['refresh',()=>currencyService.refresh()]]){
  ipcMain.handle('meridian:currency-'+channel,(event,value)=>{if(!alive(manager)||event.sender.id!==manager.webContents.id)throw Error('Unknown window.');return action(value)});
}
for(const [action,callback] of [['status',()=>updates.read()],['check',()=>updates.check()],['download',()=>updates.download()],['install',()=>updates.install()]]){
  ipcMain.handle('meridian:update-'+action,event=>{if(!alive(manager)||event.sender.id!==manager.webContents.id)throw Error('Unknown window.');return callback()});
}
ipcMain.handle('meridian:open-releases',event=>{if(!alive(manager)||event.sender.id!==manager.webContents.id)throw Error('Unknown window.');return shell.openExternal('https://github.com/Along-me/meridian/releases')});
ipcMain.handle('meridian:set-preferences',(event,patch)=>{
  if(!trusted(event))throw new Error('Unknown window.');
  if(typeof patch?.launchAtLogin==='boolean'){
    if(!app.isPackaged)throw new Error('请在打包安装后的应用中设置开机自启。');
    store.preferences.launchAtLogin=setLoginItem(app,process.execPath,patch.launchAtLogin).launchAtLogin;
  }
  if(typeof patch?.autoCheckUpdates==='boolean'){store.preferences.autoCheckUpdates=patch.autoCheckUpdates;updates.preferencesChanged()}
  if(typeof patch?.startMinimized==='boolean')store.preferences.startMinimized=patch.startMinimized;
  if(patch?.toolShortcuts&&typeof patch.toolShortcuts==='object'){
    const changes=Object.fromEntries(Object.entries(patch.toolShortcuts).filter(([tool])=>Object.hasOwn(ShortcutRegistry.actions,tool)));
    const wanted=requestedToolShortcuts({...store.preferences.toolShortcuts,...changes});
    store.preferences.toolShortcuts=wanted;try{quickLaunch.applyPatch(changes,wanted)}catch(_){}
  }
  persist();const current=preferences();for(const window of [manager,widget])send(window,'meridian:preferences',current);return current;
});

app.on('second-instance',showApplication);
app.on('before-quit',()=>{quitting=true;updates.dispose();widgetDrag.end();edgeHover.stop();quickLaunch.release();clearTimeout(saveTimer);clearTimeout(trayClickTimer);try{persist()}catch(_){}if(tray){tray.destroy();tray=null;}});
app.on('window-all-closed',()=>{if(quitting)app.quit()});
app.on('activate',showApplication);
app.whenReady().then(async()=>{
  if(!platform.mac&&!hasUserConfig&&app.isPackaged&&!smoke&&!preview&&store.preferences.launchAtLogin){
    try{if(!readLoginItem(app,process.execPath).registered)setLoginItem(app,process.execPath,true)}catch(error){console.error('Could not apply factory startup preference:',error.message)}
  }
  createWindows();
  updates.start();
  if(!smoke&&!preview)quickLaunch.restore(store.preferences.toolShortcuts);
  if(smoke){try{await require(platform.mac?'./mac-smoke.test.cjs':'./smoke.test.cjs')({app,manager,widget,getWidget:()=>widget,getState:()=>store.state,storePath});await require('./widget-edge-native.test.cjs')({manager,widget,getState:()=>store.state,getDock:()=>edgeState,setCursor:p=>{smokeCursor=p},refresh:refreshEdgeBehavior});console.log('MERIDIAN_SMOKE_OK');app.exit(0)}catch(error){console.error(error.stack);app.exit(1)}}
}).catch(error=>{console.error(error);app.exit(1)});
