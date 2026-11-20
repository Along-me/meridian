// Read-only diagnostic: inspect this executable's existing Windows startup entry.
const {app}=require('electron');
const {readLoginItem}=require('./login-items.cjs');
const executable=process.argv[2];
if(!executable)throw new Error('Pass the installed Meridian.exe path.');
app.setName('MeridianStartupDiagnostic');
app.whenReady().then(()=>{
  const results=[];
  for(const id of ['com.meridian.worldclock','Meridian']){
    app.setAppUserModelId(id);
    const info=app.getLoginItemSettings({path:executable,args:['--autostart']});
    results.push({appUserModelId:id,openAtLogin:info.openAtLogin,executableWillLaunchAtLogin:info.executableWillLaunchAtLogin,launchItems:info.launchItems});
  }
  app.setAppUserModelId('com.meridian.worldclock');
  console.log(JSON.stringify({originalQueries:results,resolvedStatus:readLoginItem(app,executable)},null,2));app.quit();
}).catch(error=>{console.error(error.stack);app.exit(1)});
