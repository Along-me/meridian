const fs=require('node:fs'),path=require('node:path'),{spawnSync}=require('node:child_process');
const exe=process.argv[2];if(!exe)throw new Error('Pass the native apply_patch executable.');
const root=path.dirname(__dirname),file='时区助手/ui-theme.css';
function patch(text){const r=spawnSync(exe,['--codex-run-as-apply-patch',text],{cwd:root,encoding:'utf8'});if(r.status!==0)throw new Error(r.stderr||r.stdout||r.error)}
// Use apply_patch for all edits, batching under the Windows process argument limit.
const old=fs.readFileSync(path.join(root,file),'utf8').trimEnd().split(/\r?\n/).filter(Boolean);
function batches(lines,prefix){let group=[],length=0;for(const line of lines){if(length+line.length>7000&&group.length){patch('*** Begin Patch\n*** Update File: '+file+'\n@@\n'+group.map(l=>prefix+l).join('\n')+'\n*** End Patch');group=[];length=0}group.push(line);length+=line.length+2}if(group.length)patch('*** Begin Patch\n*** Update File: '+file+'\n@@\n'+group.map(l=>prefix+l).join('\n')+'\n*** End Patch')}
batches(old,'-');
patch('*** Begin Patch\n*** Update File: '+file+'\n@@\n+/* STYLE_APPEND */\n*** End Patch');
const style=fs.readFileSync(path.join(__dirname,'prototype.html'),'utf8').match(/<style>\s*([\s\S]*?)<\/style>/)[1].trimEnd();
const lines=style.split(/\r?\n/).filter(Boolean);let group=[],length=0;
function appendGroup(){if(group.length)patch('*** Begin Patch\n*** Update File: '+file+'\n@@\n-/* STYLE_APPEND */\n'+group.map(line=>'+'+line).join('\n')+'\n+/* STYLE_APPEND */\n*** End Patch');group=[];length=0}
for(const line of lines){if(length+line.length>7000)appendGroup();group.push(line);length+=line.length+2}appendGroup();
patch('*** Begin Patch\n*** Update File: '+file+'\n@@\n-/* STYLE_APPEND */\n*** End Patch');
console.log('Synced CSS companion from standalone HTML.');
