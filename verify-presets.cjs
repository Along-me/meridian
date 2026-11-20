const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),assert=require('node:assert/strict'),{spawnSync}=require('node:child_process');
const {validatePresets}=require('./preset-schema.cjs');
const preset=JSON.parse(fs.readFileSync(path.join(__dirname,'build-presets.json'),'utf8'));
const directory=fs.mkdtempSync(path.join(os.tmpdir(),'meridian-preset-check-'));
const fixture=path.join(directory,'presets.json');
const withStartup={...preset,state:{...preset.state,zones:[...preset.state.zones].reverse()},preferences:{launchAtLogin:true,startMinimized:true}};
fs.writeFileSync(fixture,JSON.stringify(validatePresets(withStartup)));
try{
  const result=spawnSync(process.execPath,[path.join(__dirname,'desktop','prepare.cjs')],{env:{...process.env,MERIDIAN_FACTORY_PRESETS_FILE:fixture},encoding:'utf8'});
  assert.equal(result.status,0,result.stderr);
  const factory=JSON.parse(fs.readFileSync(path.join(__dirname,'desktop','factory-defaults.json'),'utf8'));
  assert.deepEqual(factory.preferences,{launchAtLogin:true,startMinimized:true,toolShortcuts:require('./tool-shortcuts.js').empty()});
  assert.deepEqual(factory.state.zones,withStartup.state.zones);
  const appHtml=fs.readFileSync(path.join(__dirname,'desktop','app.html'),'utf8');
  assert(!appHtml.includes('src="./preview-presets.js"'));
  assert(!appHtml.includes('id="preset-use-current"'));
  console.log('Factory startup flags and zone order follow saved presets; build-only controls excluded.');
}finally{
  spawnSync(process.execPath,[path.join(__dirname,'desktop','prepare.cjs')],{env:{...process.env,MERIDIAN_FACTORY_PRESETS_FILE:''},stdio:'inherit'});
}
