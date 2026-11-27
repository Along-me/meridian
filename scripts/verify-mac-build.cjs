const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),{spawnSync}=require('node:child_process');
assert.equal(process.platform,'darwin');
const arch=process.argv[2]||process.arch;assert.equal(process.arch,arch,'Verify on the matching native runner');
const output=path.resolve('release/mac-test'),version=require('../package.json').version;
const app=path.join(output,arch==='arm64'?'mac-arm64':'mac','Meridian.app');
const binary=path.join(app,'Contents/MacOS/Meridian');
function run(file,args){const result=spawnSync(file,args,{encoding:'utf8',timeout:120000});if(result.error)throw result.error;assert.equal(result.status,0,result.stdout+'\n'+result.stderr);return result.stdout}
assert.equal(run('/usr/bin/plutil',['-extract','CFBundleShortVersionString','raw','-o','-',path.join(app,'Contents/Info.plist')]).trim(),version);
assert(run('/usr/bin/lipo',['-archs',binary]).includes(arch==='x64'?'x86_64':arch));
run('/usr/bin/codesign',['--verify','--deep','--strict',app]);
const signature=spawnSync('/usr/bin/codesign',['-dv',app],{encoding:'utf8'});assert(signature.stderr.includes('Signature=adhoc'),'Only local ad-hoc signing is expected');
const smoke=run(binary,['--smoke-test']);process.stdout.write(smoke);assert(smoke.includes('MERIDIAN_SMOKE_OK'));
for(const ext of ['dmg','zip'])assert(fs.statSync(path.join(output,`Meridian-${version}-mac-${arch}-unsigned.${ext}`)).size>1000000);
console.log(`Verified native ${arch} app launch, local signature, DMG and ZIP for ${version}.`);
