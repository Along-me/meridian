const fs=require('node:fs'),path=require('node:path'),{spawnSync}=require('node:child_process');
const root=path.dirname(__dirname),exe=process.argv[2],file='MeridianWidget/prototype.html';
if(!exe)throw new Error('Pass apply_patch executable.');
const source=fs.readFileSync(path.join(root,file),'utf8');
if(source.includes('/* WIDGET_LAYOUT_START */'))throw new Error('Already consolidated; edit the dedicated widget layout block.');
const style=source.match(/<style>\s*([\s\S]*?)<\/style>/)[1];
const related=/\.(?:widget(?:-[\w-]+)?|clock-[\w-]+|resize-handle|empty-widget|day-period)(?![\w-])/;
function selectors(text){let depth=0,start=0,parts=[];for(let i=0;i<text.length;i++){if('(['.includes(text[i]))depth++;if(')]'.includes(text[i]))depth--;if(text[i]===','&&!depth){parts.push(text.slice(start,i));start=i+1}}parts.push(text.slice(start));return parts}
function clean(css){
  let result='',start=0;
  while(start<css.length){const open=css.indexOf('{',start);if(open<0)break;const header=css.slice(start,open).trim();let depth=1,end=open+1;for(;end<css.length&&depth;end++){if(css[end]==='{')depth++;if(css[end]==='}')depth--}
    const body=css.slice(open+1,end-1);
    if(/^@(?:media|container|supports)/.test(header)){const nested=clean(body);if(nested)result+=header+'{'+nested+'}\n'}
    else if(header.startsWith('@'))result+=header+'{'+body+'}\n';
    else {const retained=selectors(header).filter(s=>!related.test(s));if(retained.length)result+=retained.join(',')+'{'+body+'}\n'}
    start=end;
  }
  return result;
}
function patch(text){const r=spawnSync(exe,['--codex-run-as-apply-patch',text],{cwd:root,encoding:'utf8'});if(r.status!==0)throw new Error(r.stderr||r.stdout||r.error)}
for(const line of style.split(/\r?\n/))if(line)patch('*** Begin Patch\n*** Update File: '+file+'\n@@\n-'+line+'\n*** End Patch');
patch('*** Begin Patch\n*** Update File: '+file+'\n@@\n-</style>\n+/* CSS_INSERT */\n+</style>\n*** End Patch');
const cleaned=clean(style.replace(/\/\*[\s\S]*?\*\//g,''));
const widget=fs.readFileSync(path.join(__dirname,'widget-layout.css'),'utf8');
const lines=(cleaned+'\n/* WIDGET_LAYOUT_START */\n'+widget+'\n/* WIDGET_LAYOUT_END */').split(/\r?\n/).filter(Boolean);
for(let i=0;i<lines.length;i+=20)patch('*** Begin Patch\n*** Update File: '+file+'\n@@\n-/* CSS_INSERT */\n'+lines.slice(i,i+20).map(line=>'+'+line).join('\n')+'\n+/* CSS_INSERT */\n*** End Patch');
patch('*** Begin Patch\n*** Update File: '+file+'\n@@\n-/* CSS_INSERT */\n*** End Patch');
console.log('Removed overlapping widget selectors and embedded four isolated layouts.');
