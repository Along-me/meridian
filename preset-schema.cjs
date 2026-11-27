const clone=value=>JSON.parse(JSON.stringify(value));
const {requestedToolShortcuts,storedToolShortcuts}=require('./desktop/quick-launch.cjs');
function validatePresets(value){
  if(!value||value.schemaVersion!==1||!value.state||!Array.isArray(value.state.zones))throw new Error('预设格式无效。');
  const zones=value.state.zones;
  if(!zones.length||zones.length>450)throw new Error('预设至少需要一个时区。');
  const ids=new Set();
  for(const zone of zones){
    if(!zone||typeof zone.id!=='string'||ids.has(zone.id))throw new Error('时区无效或重复。');
    try{new Intl.DateTimeFormat('en',{timeZone:zone.id})}catch(_){throw new Error('不支持的时区：'+zone.id)}
    if(typeof zone.visible!=='boolean'||typeof zone.alias!=='string'||zone.alias.length>40)throw new Error('时区显示或别称格式无效。');
    ids.add(zone.id);
  }
  if(typeof value.preferences?.launchAtLogin!=='boolean'||typeof value.preferences?.startMinimized!=='boolean')throw new Error('自启预设必须是布尔值。');
  const state=clone(value.state);
  // This file is data only; consumers apply their usual renderer/main-process checks.
  state.widgetTheme=['light','dark'].includes(state.widgetTheme)?state.widgetTheme:['light','dark'].includes(state.theme)?state.theme:'dark';
  state.edgeSnap=state.edgeSnap!==false;
  delete state.__proto__;delete state.constructor;delete state.prototype;delete state.theme;delete state.frostedGlass;delete state.glassBlur;
  const toolShortcuts=requestedToolShortcuts(storedToolShortcuts(value.preferences));
  return {schemaVersion:1,state,preferences:{launchAtLogin:value.preferences.launchAtLogin,startMinimized:value.preferences.startMinimized,toolShortcuts}};
}
module.exports={validatePresets};
