const {BrowserWindow,screen}=require('electron');
const path=require('node:path');
module.exports=function createTooltipWindow(widget){
  const window=new BrowserWindow({parent:widget,width:290,height:320,frame:false,transparent:true,show:false,focusable:false,resizable:false,skipTaskbar:true,hasShadow:false,webPreferences:{preload:path.join(__dirname,'tooltip-preload.cjs'),contextIsolation:true,nodeIntegration:false,sandbox:true,backgroundThrottling:false}});
  window.setAlwaysOnTop(true,'screen-saver');window.setIgnoreMouseEvents(true);
  window.webContents.setWindowOpenHandler(()=>({action:'deny'}));window.webContents.on('will-navigate',event=>event.preventDefault());
  let pending=null,loaded=false,revision=0;
  window.loadFile(path.join(__dirname,'tooltip.html'));
  window.webContents.on('did-finish-load',()=>{loaded=true;if(pending)window.webContents.send('meridian:tooltip-data',pending)});
  function raise(){
    if(!pending||window.isDestroyed()||widget.isDestroyed()||!window.isVisible())return;
    window.setAlwaysOnTop(true,'screen-saver');window.moveTop();
  }
  function place(measurement){
    if(!pending||measurement?.revision!==pending.revision||!Number.isFinite(measurement.height)||window.isDestroyed()||widget.isDestroyed())return;
    const height=Math.max(40,measurement.height);
    const bounds=widget.getContentBounds(),anchor=pending.anchor;
    const area=screen.getDisplayMatching(bounds).workArea,width=pending.width,h=Math.min(height,area.height);
    let x=bounds.x+anchor.x+anchor.width+8;if(x+width>area.x+area.width)x=bounds.x+anchor.x-width-8;
    if(pending.kind==='control')x=bounds.x+anchor.x+anchor.width-width;
    x=Math.max(area.x,Math.min(x,area.x+area.width-width));
    const controlY=bounds.y+anchor.y+anchor.height+6;
    const targetY=pending.kind==='control'?(controlY+h<=area.y+area.height?controlY:bounds.y+anchor.y-h-6):bounds.y+anchor.y;
    const y=Math.max(area.y,Math.min(targetY,area.y+area.height-h));
    const next={x:Math.round(x),y:Math.round(y),width,height:Math.round(h)},previous=window.getBounds();
    if(Object.keys(next).some(key=>next[key]!==previous[key]))window.setBounds(next);
    if(!window.isVisible()){window.showInactive();raise()}
  }
  return {window,raise,hide(){pending=null;if(!window.isDestroyed())window.hide()},show(data){
    if(!data||!Array.isArray(data.fields)||!data.anchor)return;
    const a=data.anchor;if(![a.x,a.y,a.width,a.height].every(Number.isFinite))return;
    const size=n=>Math.max(3,Math.min(144,Number(n)||11));
    const area=screen.getDisplayMatching(widget.getContentBounds()).workArea;
    pending={revision:++revision,width:Math.min(data.kind==='control'?220:290,area.width),kind:data.kind==='control'?'control':'clock',light:!!data.light,anchor:{x:a.x,y:a.y,width:a.width,height:a.height},fields:data.fields.slice(0,12).map(f=>({strong:!!f.strong,className:String(f.className).replace(/[^\w -]/g,'').slice(0,80),fontSize:size(f.fontSize),segments:(Array.isArray(f.segments)?f.segments:[]).slice(0,12).map(s=>({text:String(s.text||'').slice(0,300),period:!!s.period,fontSize:size(s.fontSize)}))}))};
    if(loaded)window.webContents.send('meridian:tooltip-data',pending);
  },measure:place};
};
