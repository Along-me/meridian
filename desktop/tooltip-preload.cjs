const {contextBridge,ipcRenderer}=require('electron');
contextBridge.exposeInMainWorld('meridianTooltip',{
  onData:callback=>ipcRenderer.on('meridian:tooltip-data',(_event,data)=>callback(data)),
  measure:height=>ipcRenderer.send('meridian:tooltip-measured',height)
});
