const {contextBridge,ipcRenderer}=require('electron');
const initial=ipcRenderer.sendSync('meridian:initial');
contextBridge.exposeInMainWorld('meridianDesktop',{
  initial,
  updateStatus:()=>ipcRenderer.invoke('meridian:update-status'),
  checkUpdates:()=>ipcRenderer.invoke('meridian:update-check'),
  downloadUpdate:()=>ipcRenderer.invoke('meridian:update-download'),
  installUpdate:()=>ipcRenderer.invoke('meridian:update-install'),
  openReleases:()=>ipcRenderer.invoke('meridian:open-releases'),
  onUpdate:callback=>ipcRenderer.on('meridian:update-state',(_event,state)=>callback(state)),
  currencyRead:()=>ipcRenderer.invoke('meridian:currency-read'),
  currencySave:patch=>ipcRenderer.invoke('meridian:currency-save',patch),
  currencyRefresh:()=>ipcRenderer.invoke('meridian:currency-refresh'),
  saveState:state=>ipcRenderer.send('meridian:save-state',state),
  ready:state=>ipcRenderer.send('meridian:renderer-ready',state),
  onState:callback=>{
    const listener=(_event,state)=>callback(state);
    ipcRenderer.on('meridian:state',listener);
    return ()=>ipcRenderer.removeListener('meridian:state',listener);
  },
  onPreferences:callback=>{
    const listener=(_event,prefs)=>callback(prefs);
    ipcRenderer.on('meridian:preferences',listener);
    return ()=>ipcRenderer.removeListener('meridian:preferences',listener);
  },
  setPreferences:preferences=>ipcRenderer.invoke('meridian:set-preferences',preferences),
  openManager:()=>ipcRenderer.send('meridian:open-manager'),
  onOpenTool:callback=>ipcRenderer.on('meridian:open-tool',(_event,tool)=>callback(tool)),
  setTitleBarTheme:theme=>ipcRenderer.send('meridian:titlebar-theme',theme),
  beginDrag:()=>ipcRenderer.send('meridian:begin-drag'),
  endDrag:()=>ipcRenderer.send('meridian:end-drag'),
  showWidget:()=>ipcRenderer.send('meridian:show-widget'),
  hideWidget:()=>ipcRenderer.send('meridian:hide-widget'),
  showTooltip:data=>ipcRenderer.send('meridian:show-tooltip',data),
  hideTooltip:()=>ipcRenderer.send('meridian:hide-tooltip'),
  fitWidget:size=>ipcRenderer.send('meridian:fit-widget',size),
  reportWidgetSize:size=>ipcRenderer.send('meridian:widget-size',size),
  onMoved:callback=>ipcRenderer.on('meridian:moved',(_event,bounds)=>callback(bounds)),
  onResized:callback=>{
    const listener=(_event,size)=>callback(size);
    ipcRenderer.on('meridian:resized',listener);
    return ()=>ipcRenderer.removeListener('meridian:resized',listener);
  }
});
