const {contextBridge,ipcRenderer}=require('electron');
contextBridge.exposeInMainWorld('meridianTooltip',{
  onData:callback=>ipcRenderer.on('meridian:tooltip-data',(_event,data)=>callback(data)),
  measure:measurement=>ipcRenderer.send('meridian:tooltip-measured',measurement)
});
