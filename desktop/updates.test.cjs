const assert=require('node:assert/strict'),{EventEmitter}=require('node:events'),{createUpdates,releaseText}=require('./updates.cjs');
async function run(){
  const api=new EventEmitter(),events=[];let checks=0,downloads=0,installs=0,prepares=0,scheduled,automatic=true;
  api.checkForUpdates=async()=>{checks++;api.emit('update-available',{version:'1.2.1',releaseNotes:'<p>修复显示</p>'})};
  api.downloadUpdate=async()=>{downloads++;api.emit('download-progress',{percent:50});api.emit('update-downloaded',{version:'1.2.1'})};api.quitAndInstall=(silent,restart)=>{assert.equal(silent,false);assert.equal(restart,true);installs++};
  const updates=createUpdates({updater:api,version:'1.2.0',supported:true,getAutomatic:()=>automatic,notify:state=>events.push(state),beforeInstall:()=>prepares++,schedule:fn=>{scheduled=fn;return 1},cancel:()=>scheduled=null});
  assert.equal(api.autoDownload,false);assert.equal(api.autoInstallOnAppQuit,false);updates.install();assert.equal(installs,0);
  updates.start();automatic=false;scheduled();assert.equal(checks,0);
  await updates.check();assert.equal(checks,1);assert.equal(downloads,0);assert.equal(updates.read().status,'available');assert.equal(updates.read().notes,'修复显示');
  await updates.download();assert.equal(downloads,1);assert.equal(installs,0);assert.equal(updates.read().status,'downloaded');assert(events.some(state=>state.progress===50));await updates.check();assert.equal(checks,1);
  updates.install();assert.equal(installs,1);assert.equal(prepares,1);assert.equal(updates.read().status,'installing');
  const failedApi=new EventEmitter();failedApi.checkForUpdates=async()=>{throw Error('https://secret/token')};const failed=createUpdates({updater:failedApi,version:'1.2.0',supported:true});await failed.check();assert.equal(failed.read().status,'error');assert(!failed.read().error.includes('secret'));assert(!failed.read().error.includes('token'));
  let unused=0;const devApi=new EventEmitter();devApi.checkForUpdates=()=>unused++;const dev=createUpdates({updater:devApi,version:'1.2.0',supported:false});await dev.check();await dev.download();dev.install();dev.start();assert.equal(unused,0);assert.equal(dev.read().status,'unsupported');
  assert.equal(releaseText([{note:'<p>a</p>'},{note:'b'}]),'a\nb');updates.dispose();
  console.log('Updates require explicit downloads and installation, honor automatic-check settings, suppress dev checks and handle failures without exposing URLs.');
}
run().catch(error=>{console.error(error);process.exitCode=1});
