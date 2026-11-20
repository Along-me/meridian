const RELEASES='https://github.com/Along-me/meridian/releases';
function releaseText(value){
  const text=Array.isArray(value)?value.map(item=>item?.note||'').join('\n'):typeof value==='string'?value:'';
  return text.replace(/<[^>]*>/g,'').slice(0,12000);
}
function createUpdates({updater,version,supported,getAutomatic=()=>true,notify=()=>{},beforeInstall=()=>{},installFailed=()=>{},schedule=setTimeout,cancel=clearTimeout}){
  let timer=null,operation=null,state={status:supported?'idle':'unsupported',currentVersion:version,availableVersion:'',notes:'',progress:0,error:'',checkedAt:null,releaseUrl:RELEASES};
  const read=()=>({...state,automatic:getAutomatic(),supported});
  function change(patch){state={...state,...patch};notify(read())}
  updater.autoDownload=false;updater.autoInstallOnAppQuit=false;updater.allowPrerelease=false;updater.allowDowngrade=false;
  updater.on('checking-for-update',()=>change({status:'checking',error:''}));
  updater.on('update-available',info=>change({status:'available',availableVersion:String(info.version),notes:releaseText(info.releaseNotes),error:'',checkedAt:new Date().toISOString()}));
  updater.on('update-not-available',()=>change({status:'current',availableVersion:'',notes:'',error:'',checkedAt:new Date().toISOString()}));
  updater.on('download-progress',info=>change({status:'downloading',progress:Math.max(0,Math.min(100,Number(info.percent)||0))}));
  updater.on('update-downloaded',info=>change({status:'downloaded',availableVersion:String(info.version),notes:releaseText(info.releaseNotes)||state.notes,progress:100,error:''}));
  function failed(){change({status:'error',error:'更新服务暂时无法连接，请稍后重试或访问 GitHub Releases 手动下载。'})}
  updater.on('error',failed);
  async function check(){
    if(!supported)return read();if(operation||['downloading','downloaded','installing'].includes(state.status))return read();
    change({status:'checking',error:''});operation=Promise.resolve().then(()=>updater.checkForUpdates()).catch(failed).finally(()=>operation=null);await operation;return read();
  }
  async function download(){
    if(!supported||state.status!=='available'||operation)return read();
    change({status:'downloading',progress:0,error:''});operation=Promise.resolve().then(()=>updater.downloadUpdate()).catch(failed).finally(()=>operation=null);await operation;return read();
  }
  function install(){
    if(!supported||state.status!=='downloaded')return read();
    change({status:'installing'});
    try{beforeInstall();updater.quitAndInstall(false,true)}catch(_){installFailed();failed()}
    return read();
  }
  function start(){if(!supported||timer!==null)return;timer=schedule(()=>{timer=null;if(getAutomatic())check()},8000);timer?.unref?.()}
  function dispose(){if(timer!==null)cancel(timer);timer=null}
  return {read,check,download,install,start,dispose,preferencesChanged:()=>notify(read())};
}
module.exports={createUpdates,releaseText};
