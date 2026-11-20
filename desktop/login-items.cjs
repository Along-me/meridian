const path=require('node:path');
const LOGIN_ITEM_NAME='Meridian';
const LOGIN_ARGS=['--autostart'];
const normalized=value=>path.win32.normalize(String(value||'').replace(/^"|"$/g,'')).toLowerCase();

function readLoginItem(app,executable){
  const info=app.getLoginItemSettings({path:executable,args:LOGIN_ARGS});
  // openAtLogin queries the AppUserModelId; our older releases wrote a named Run item.
  const item=(info.launchItems||[]).find(item=>item.name===LOGIN_ITEM_NAME&&item.scope==='user'&&normalized(item.path)===normalized(executable));
  return {registered:!!item,launchAtLogin:!!item&&item.enabled!==false,startupBlocked:!!item&&item.enabled===false};
}
function setLoginItem(app,executable,enabled){
  app.setLoginItemSettings({openAtLogin:enabled,enabled,path:executable,args:LOGIN_ARGS,name:LOGIN_ITEM_NAME});
  const result=readLoginItem(app,executable);
  if(enabled&&!result.registered)throw new Error('未能保存当前用户的开机启动项，请稍后重试。');
  if(!enabled&&result.registered)throw new Error('未能移除开机启动项，请稍后重试。');
  if(enabled&&result.startupBlocked)throw new Error('启动项已保存，但被 Windows 禁用，请在系统的“启动应用”中启用 Meridian。');
  return result;
}
module.exports={readLoginItem,setLoginItem};
