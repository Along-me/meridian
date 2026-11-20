const fs=require('node:fs'),path=require('node:path'),{spawnSync}=require('node:child_process');
const file=path.join(__dirname,'prototype.html'),exe=process.argv[2];
if(!exe)throw new Error('Pass the native apply_patch executable.');
if(fs.readFileSync(file,'utf8').includes('calendar-popover'))throw new Error('Layout already updated. Edit prototype.html directly.');
function replace(old,value){
  const source=fs.readFileSync(file,'utf8');const index=source.indexOf(old);
  if(index<0)throw new Error('Missing source: '+old.slice(0,90));
  const start=source.lastIndexOf('\n',index)+1,next=source.indexOf('\n',index+old.length),end=next<0?source.length:next;
  const before=source.slice(start,end),after=before.replace(old,value);
  const patch='*** Begin Patch\n*** Update File: 时区助手/prototype.html\n@@\n'+before.split('\n').map(l=>'-'+l).join('\n')+'\n'+after.split('\n').map(l=>'+'+l).join('\n')+'\n*** End Patch';
  const result=spawnSync(exe,['--codex-run-as-apply-patch',patch],{cwd:path.dirname(__dirname),encoding:'utf8'});
  if(result.status!==0)throw new Error(result.stderr||result.stdout||result.error);
}
const style=fs.readFileSync(file,'utf8').match(/<style>\n([\s\S]*?)<\/style>/)[1];
for(const line of style.trimEnd().split('\n'))replace(line,'');
replace('<style>', '<style>\n'+fs.readFileSync(path.join(__dirname,'ui-theme.css'),'utf8').trimEnd());
const source=()=>fs.readFileSync(file,'utf8');
const header=source().match(/<header class="appbar">.*?<\/header>/)[0];
replace(header,'<header class="appbar"><div class="appbar-brand"><svg><use href="#i-clock"/></svg><span>Meridian · 时区助手</span><span class="prototype-tag">预览</span></div><div class="appbar-actions"><select class="field" id="app-theme" aria-label="界面配色"><option value="system">跟随系统</option><option value="light">浅色</option><option value="dark">深色</option></select></div></header>');
replace('<symbol id="i-monitor"','<symbol id="i-grip" viewBox="0 0 24 24"><circle cx="9" cy="5" r="1"/><circle cx="15" cy="5" r="1"/><circle cx="9" cy="12" r="1"/><circle cx="15" cy="12" r="1"/><circle cx="9" cy="19" r="1"/><circle cx="15" cy="19" r="1"/></symbol>\n<symbol id="i-monitor"');
replace('按列表顺序显示','拖动调整顺序');
replace('<div class="stat-meta">当前为浏览器内预览</div>','');
replace('<p class="note"><svg><use href="#i-info"/></svg><span>以系统时间为基准同步更新，自动遵循各地区的夏令时规则。</span></p>','');
replace('<div class="preview-caption"><span>挂件样式与显示内容预览</span>','<div class="preview-caption"><span>桌面悬浮与置顶仅为预览</span>');
const tip=source().match(/<div class="tip-card"><div class="tip-title">[\s\S]*?<\/div><\/div><\/div><\/section>/)[0];
replace(tip,'<div class="style-chooser"><div class="section-head"><h2>挂件风格</h2><button class="ghost small-link" data-goto="appearance">更多设置</button></div><div class="style-options" data-style-choices></div></div></div></div></section>');
const appearance=source().match(/<section id="page-appearance"[\s\S]*?<\/section>/)[0];
replace(appearance,`<section id="page-appearance" class="page hidden">
<div class="page-heading"><h1>外观与偏好</h1></div><div class="appearance-layout"><div><div class="section-head"><h2>界面</h2></div><div class="panel"><div class="setting-row"><div class="setting-label"><svg><use href="#i-sun"/></svg><h3>界面配色</h3></div><select class="field" id="appearance-theme" aria-label="设置界面配色"><option value="system">跟随系统</option><option value="light">浅色</option><option value="dark">深色</option></select></div></div>
<div class="section-head settings-head"><h2>挂件</h2></div><div class="panel"><div class="setting-row"><div class="setting-label"><svg><use href="#i-sun"/></svg><h3>挂件配色</h3></div><div class="theme-options" aria-label="挂件配色"><button class="theme-choice" data-theme="system">跟随界面</button><button class="theme-choice" data-theme="light">浅色</button><button class="theme-choice" data-theme="dark">深色</button></div></div><div class="setting-row"><div class="setting-label"><svg><use href="#i-widget"/></svg><h3>不透明度</h3></div><div class="unit"><input class="range" id="opacity" type="range" min="40" max="100" value="100" aria-label="挂件不透明度"><span id="opacity-value">100%</span></div></div><div class="setting-row"><div class="setting-label"><svg><use href="#i-clock"/></svg><h3>24 小时制</h3></div><button class="toggle on" data-toggle="hour24" role="switch" aria-checked="true" aria-label="24 小时制"></button></div><div class="setting-row"><div class="setting-label"><svg><use href="#i-calendar"/></svg><h3>显示日期</h3></div><button class="toggle on" data-toggle="date" role="switch" aria-checked="true" aria-label="显示日期"></button></div></div></div>
<div class="appearance-preview"><div class="section-head"><h2>挂件预览</h2></div><div class="preview-desktop" id="appearance-desktop"><span class="desktop-label">YOUR DESKTOP</span><div class="widget" id="appearance-widget"><div class="widget-top"><span><svg><use href="#i-globe"/></svg>世界时钟</span><svg><use href="#i-pin"/></svg></div><div class="widget-content" id="appearance-clocks"></div></div></div><div class="style-chooser"><div class="section-head"><h2>挂件风格</h2></div><div class="style-options" data-style-choices></div></div></div></div></section>`);
const help=source().match(/<section id="page-help"[\s\S]*?<\/section>/)[0];
replace(help,`<section id="page-help" class="page hidden"><div class="page-heading"><h1>使用说明</h1></div><div class="panel help-card"><h2>时区与挂件</h2><p>拖动时区左侧的六点手柄调整顺序，或聚焦手柄后按 <code>Alt + ↑ / ↓</code>。开关控制挂件内是否显示该时区。三种挂件风格与配色在「外观与偏好」中设置。</p></div><div class="panel help-card"><h2>时间转换</h2><p>UTC 偏移按输入日期计算，自动处理夏令时。跳时产生的无效时间会报错；回拨产生的重复时间需选择具体一次。秒时间戳支持三位小数，毫秒时间戳使用整数。</p></div><div class="panel help-card"><h2>HTML 预览</h2><p>当前版本在浏览器中运行，暂不具备桌面悬浮或系统置顶能力。数据与设置保存在本地。</p></div><div class="panel help-card"><h2>时区数据</h2><p><span class="catalogue-count"></span>列表来自 IANA，中文名称来自 Unicode CLDR；偏移规则由浏览器时区数据库提供。</p></div></section>`);
// Remove repeated explanatory prose while keeping field labels and actionable warnings.
let body=source().split('<body>')[1].split('<script>')[0];
const paragraphs=[...body.matchAll(/<p class="section-intro">[\s\S]*?<\/p>/g),...body.matchAll(/<div class="page-heading"><div><h1>[^<]*<\/h1>(<p>[\s\S]*?<\/p>)/g)].map(m=>m[1]||m[0]);
for(const text of paragraphs)replace(text,'');
for(const match of [...body.matchAll(/<div class="panel info-list">[\s\S]*?<\/div><\/div><\/section>/g)])replace(match[0],'</div></section>');
replace('<h2>跨时区转换</h2>','');
replace('<div class="form-actions"><span>自动考虑夏令时与跨天变化</span>','<div class="form-actions">');
replace('<div class="form-actions"><span>支持负时间戳，保留毫秒精度</span>','<div class="form-actions">');
replace('<p>按国家或城市查找，添加到你的桌面时钟。</p>','');
for(const note of ['让挂件保持在其他窗口上方','更精确地查看每一刻','避免拖动时意外移动'])replace('<p>'+note+'</p>','');
// Wrap native controls uniformly; keep labels, ids and conversion events intact.
body=source().split('<body>')[1].split('<script>')[0];
for(const m of [...body.matchAll(/<select\b[^>]*>[\s\S]*?<\/select>/g)])replace(m[0],'<div class="select-wrap">'+m[0]+'</div>');
for(const m of [...body.matchAll(/<input\b[^>]*type="datetime-local"[^>]*>/g)]){
  const id=m[0].match(/id="([^"]+)"/)[1];
  replace(m[0],'<div class="date-control">'+m[0]+'<button type="button" class="date-trigger" data-date-for="'+id+'" aria-label="打开日期时间选择器" title="选择日期与时间"><svg><use href="#i-calendar"/></svg></button></div>');
}
console.log('Updated layout, embedded theme and normalized controls.');
