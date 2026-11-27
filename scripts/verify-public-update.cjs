const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),assert=require('node:assert/strict');
const {NsisUpdater}=require('electron-updater');
const {NodeHttpExecutor}=require('builder-util/out/nodeHttpExecutor');
const {createUpdates}=require('../desktop/updates.cjs');
const updateConfig=[
  '../release/local/win-unpacked/resources/app-update.yml',
  '../release/installers/win-unpacked/resources/app-update.yml'
].map(file=>path.resolve(__dirname,file)).find(file=>fs.existsSync(file));
if(!updateConfig)throw Error('请先运行 npm run pack，生成本地更新配置。');
async function verify(version,expected){
  const profile=fs.mkdtempSync(path.join(os.tmpdir(),'meridian-public-update-'));
  const adapter={version,name:'MeridianUpdateCheck',isPackaged:true,appUpdateConfigPath:updateConfig,userDataPath:profile,baseCachePath:profile,whenReady:async()=>{},onQuit:()=>{},quit:()=>{throw Error('Must not install during verification')},relaunch:()=>{}};
  const updater=new NsisUpdater(null,adapter);updater.httpExecutor=new NodeHttpExecutor();updater.logger=null;
  let downloaded=false;updater.on('download-progress',()=>downloaded=true);
  const controller=createUpdates({updater,version,supported:true});
  const state=await controller.check();assert.equal(state.status,expected,state.error);assert.equal(downloaded,false);
  if(expected==='available')assert.equal(state.availableVersion,'1.2.1');
  console.log(JSON.stringify({currentVersion:version,status:state.status,availableVersion:state.availableVersion,automaticDownload:updater.autoDownload,automaticInstall:updater.autoInstallOnAppQuit}));
  controller.dispose();
}
(async()=>{await verify('1.2.0','available');await verify('1.2.1','current')})().catch(error=>{console.error(error);process.exitCode=1});
