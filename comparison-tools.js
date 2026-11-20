/* COMPARISON_CORE_START */
function comparisonHourInstants(now){
  const date=new Date(now),start=Number(date)-date.getMinutes()*60000-date.getSeconds()*1000-date.getMilliseconds();
  if(!Number.isFinite(start))throw new Error('系统时间无效。');
  return Array.from({length:24},(_,hour)=>start+hour*3600000);
}
function customComparisonRows(realAmount,realUnit,sceneAmount,sceneUnit){
  const realUnits={second:1,minute:60,hour:3600,day:86400},sceneUnits={hour:1,day:24};
  if(!realUnits[realUnit]||!sceneUnits[sceneUnit]||![realAmount,sceneAmount].every(value=>Number.isFinite(value)&&value>0))throw new Error('请填写大于 0 的有效比例。');
  const secondsPerDay=realAmount*realUnits[realUnit]*24/(sceneAmount*sceneUnits[sceneUnit]);
  if(!Number.isFinite(secondsPerDay)||secondsPerDay>Number.MAX_SAFE_INTEGER)throw new Error('比例过大，请减小现实时间或增加场景时间。');
  return {secondsPerDay,rows:Array.from({length:24},(_,hour)=>({hour,seconds:Math.round(hour*secondsPerDay/24)}))};
}
function comparisonDuration(seconds){
  const value=Math.round(seconds),hours=Math.floor(value/3600),minutes=Math.floor(value%3600/60),rest=value%60;
  return String(hours).padStart(2,'0')+':'+String(minutes).padStart(2,'0')+':'+String(rest).padStart(2,'0');
}
/* COMPARISON_CORE_END */
(() => {
  const storageKey='meridian-comparison-tools-v1';
  let config={zone:state.zones[0]?.id||'Asia/Shanghai',realAmount:1,realUnit:'hour',sceneAmount:1,sceneUnit:'day'},lastSignature='';
  try{const saved=JSON.parse(localStorage.getItem(storageKey));if(saved&&typeof saved==='object')for(const key of Object.keys(config))if(Object.hasOwn(saved,key))config[key]=saved[key]}catch(_){}
  if(!catalogue.some(zone=>zone.id===config.zone))config.zone=state.zones[0]?.id||'Asia/Shanghai';
  if(!['second','minute','hour','day'].includes(config.realUnit))config.realUnit='hour';
  if(!['hour','day'].includes(config.sceneUnit))config.sceneUnit='day';
  for(const key of ['realAmount','sceneAmount'])if(typeof config[key]!=='number'||!Number.isFinite(config[key])||config[key]<=0)config[key]=1;
  function persist(){try{localStorage.setItem(storageKey,JSON.stringify(config))}catch(_){}}
  const nav=document.querySelector('nav[aria-label="主导航"]');nav.querySelector('.nav-label').textContent='工具';
  for(const [id,label,glyph] of [['comparison','时间对照表','globe']]){
    names[id]=label;
    const button=document.createElement('button');button.type='button';button.className='nav-item';button.dataset.page=id;button.title=label;button.innerHTML=icon(glyph)+'<span>'+label+'</span>';button.onclick=()=>navigate(id);nav.appendChild(button);
  }
  const comparison=document.createElement('section');comparison.id='page-comparison';comparison.className='page comparison-page hidden';
  comparison.innerHTML='<div class="page-heading"><h1>时间对照表</h1><button type="button" class="ghost current-time-button" id="comparison-now">'+icon('clock')+'当前时间</button></div><div class="panel comparison-settings"><label class="form-label" for="comparison-zone">目标国家 / 城市</label><div class="comparison-zone-fields"><input class="field" type="search" id="comparison-search" aria-label="搜索对照时区" placeholder="搜索国家、城市、UTC 偏移"><div class="select-wrap"><select class="field" id="comparison-zone"></select></div></div><div class="quick-zones" id="comparison-quick-zones"></div></div><div class="comparison-summary"><span id="comparison-device"></span><span id="comparison-range"></span></div><div class="comparison-grid" id="comparison-grid" aria-label="未来24小时对照"></div>';
  const custom=document.createElement('section');custom.id='page-custom-comparison';custom.className='page comparison-page hidden';
  custom.innerHTML='<div class="page-heading"><h1>自定义对照</h1></div><div class="panel comparison-settings"><div class="comparison-ratio"><div><label class="form-label" for="comparison-real-amount">现实时间</label><div class="comparison-amount"><input class="field" id="comparison-real-amount" type="number" min="0.000001" step="any" aria-label="现实时间数值"><div class="select-wrap"><select class="field" id="comparison-real-unit" aria-label="现实时间单位"><option value="second">秒</option><option value="minute">分钟</option><option value="hour">小时</option><option value="day">天</option></select></div></div></div><span class="comparison-equals" aria-label="等于">＝</span><div><label class="form-label" for="comparison-scene-amount">目标场景时间</label><div class="comparison-amount"><input class="field" id="comparison-scene-amount" type="number" min="0.000001" step="any" aria-label="场景时间数值"><div class="select-wrap"><select class="field" id="comparison-scene-unit" aria-label="场景时间单位"><option value="hour">小时</option><option value="day">天</option></select></div></div></div></div></div><p class="comparison-error hidden" id="comparison-custom-error" role="status"></p><div class="comparison-summary"><span>场景一天 · 00:00—23:00</span><span id="comparison-custom-total"></span></div><div class="comparison-grid" id="comparison-custom-grid" aria-label="场景24小时与现实经过时间对照表"></div>';
  const timezonePanel=document.createElement('section');timezonePanel.id='comparison-timezone-panel';
  for(const node of Array.from(comparison.children).slice(1))timezonePanel.appendChild(node);
  custom.querySelector('.page-heading').remove();custom.id='comparison-custom-panel';custom.className='hidden';
  const tabs=document.createElement('div');tabs.className='widget-settings-tabs';tabs.setAttribute('role','tablist');tabs.setAttribute('aria-label','时间对照表方式');
  let comparisonTab='timezone';
  const modes=[['timezone','时区对照',timezonePanel],['custom','自定义对照',custom]];
  for(const [id,label,panel] of modes){
    const button=document.createElement('button');button.type='button';button.className='widget-settings-tab';button.id='comparison-tab-'+id;button.dataset.comparisonTab=id;button.textContent=label;button.setAttribute('role','tab');button.setAttribute('aria-controls',panel.id);
    panel.setAttribute('role','tabpanel');panel.setAttribute('aria-labelledby',button.id);button.onclick=()=>selectComparisonTab(id);tabs.appendChild(button);
  }
  function selectComparisonTab(id){
    comparisonTab=id;
    for(const [key,,panel] of modes){const active=key===id,button=tabs.querySelector('[data-comparison-tab="'+key+'"]');button.setAttribute('aria-selected',String(active));button.tabIndex=active?0:-1;panel.classList.toggle('hidden',!active)}
    document.getElementById('comparison-now').classList.toggle('hidden',id==='custom');
    if(id==='timezone'){refreshZones();renderHours(true)}else renderCustom();
  }
  tabs.addEventListener('keydown',event=>{if(!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;event.preventDefault();const id=event.key==='Home'?'timezone':event.key==='End'?'custom':comparisonTab==='timezone'?'custom':'timezone';selectComparisonTab(id);tabs.querySelector('[data-comparison-tab="'+id+'"]').focus()});
  comparison.append(tabs,timezonePanel,custom);document.querySelector('.main').append(comparison);
  for(const [id,key] of [['comparison-real-amount','realAmount'],['comparison-real-unit','realUnit'],['comparison-scene-amount','sceneAmount'],['comparison-scene-unit','sceneUnit']]){
    const input=document.getElementById(id);input.value=config[key];input.addEventListener('input',()=>{
      config[key]=input.type==='number'?Number(input.value):input.value;renderCustom();
      if(document.getElementById('comparison-custom-error').classList.contains('hidden'))persist();
    });
  }
  function refreshZones(){
    const now=new Date(),search=document.getElementById('comparison-search').value.trim().toLowerCase(),own=new Set(state.zones.map(zone=>zone.id));
    const matches=catalogue.filter(zone=>[zone.country,zone.city,zoneAlias(zone.id),zone.en,zone.id,zone.code,offset(now,zone.id),offset(now,zone.id,true)].join(' ').toLowerCase().includes(search));
    const option=zone=>'<option value="'+esc(zone.id)+'">'+esc(zoneLabel(zone,now,true))+'</option>',selected=catalogue.find(zone=>zone.id===config.zone);
    const groups=[['挂件已配置时区',matches.filter(zone=>own.has(zone.id))],['全部国家与地区',matches.filter(zone=>!own.has(zone.id))]];
    let options=groups.filter(([,zones])=>zones.length).map(([label,zones])=>'<optgroup label="'+label+'">'+zones.map(option).join('')+'</optgroup>').join('');
    if(selected&&!matches.some(zone=>zone.id===config.zone))options='<optgroup label="当前选择">'+option(selected)+'</optgroup>'+options;
    if(!matches.length)options+='<option disabled>没有匹配的时区</option>';
    const select=document.getElementById('comparison-zone');select.innerHTML=options;select.value=config.zone;
    document.getElementById('comparison-quick-zones').innerHTML=state.zones.map(item=>{const zone=catalogue.find(zone=>zone.id===item.id);return '<button type="button" class="quick-zone '+(item.id===config.zone?'active':'')+'" data-comparison-zone="'+esc(zone.id)+'">'+esc((item.alias?.trim()?item.alias.trim()+' · ':'')+zone.city+' '+offset(now,zone.id))+'</button>'}).join('')||'<span class="quick-empty">尚未配置挂件时区</span>';
  }
  function renderHours(force=false){
    const now=new Date(),localZone=Intl.DateTimeFormat().resolvedOptions().timeZone,instants=comparisonHourInstants(now),signature=[instants[0],config.zone,localZone].join('|');
    if(!force&&lastSignature===signature)return;lastSignature=signature;
    const target=catalogue.find(zone=>zone.id===config.zone),clock=ms=>fmt(new Date(ms),config.zone,{hour:'2-digit',minute:'2-digit',hourCycle:'h23'});
    document.getElementById('comparison-device').textContent='设备时间 · '+localZone+' · '+offset(now,localZone);
    document.getElementById('comparison-range').textContent='当前小时起 · 未来 24 小时';
    document.getElementById('comparison-grid').innerHTML=instants.map((ms,index)=>'<article class="comparison-tile '+(index===0?'comparison-current':'')+'"'+(index===0?' aria-current="time"':'')+'><div class="comparison-tile-label">'+esc(target.city)+(index===0?'<span class="comparison-now-badge">当前</span>':'')+'</div><strong class="comparison-primary">'+clock(ms)+'</strong><div class="comparison-target-date">'+esc(fmt(new Date(ms),config.zone,{month:'2-digit',day:'2-digit'})+' · '+offset(new Date(ms),config.zone))+'</div><div class="comparison-secondary">设备 '+esc(fmt(new Date(ms),localZone,{month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}))+'</div></article>').join('');
  }
  function renderCustom(){
    const error=document.getElementById('comparison-custom-error'),grid=document.getElementById('comparison-custom-grid'),total=document.getElementById('comparison-custom-total');
    try{
      const result=customComparisonRows(config.realAmount,config.realUnit,config.sceneAmount,config.sceneUnit);
      error.classList.add('hidden');error.textContent='';total.textContent='场景一天＝现实 '+comparisonDuration(result.secondsPerDay)+' · 精确到秒';
      grid.innerHTML=result.rows.map(row=>'<article class="comparison-tile"><div class="comparison-tile-label">场景时间</div><strong class="comparison-primary">'+String(row.hour).padStart(2,'0')+':00</strong><div class="comparison-secondary">现实 <span>'+comparisonDuration(row.seconds)+'</span></div></article>').join('');
    }catch(problem){error.textContent=problem.message;error.classList.remove('hidden');grid.replaceChildren();total.textContent='';}
  }
  document.getElementById('comparison-search').addEventListener('input',refreshZones);
  document.getElementById('comparison-zone').addEventListener('change',event=>{config.zone=event.target.value;persist();refreshZones();renderHours(true)});
  document.getElementById('comparison-quick-zones').addEventListener('click',event=>{const button=event.target.closest('[data-comparison-zone]');if(!button)return;config.zone=button.dataset.comparisonZone;persist();refreshZones();renderHours(true)});
  document.getElementById('comparison-now').onclick=()=>{refreshZones();renderHours(true)};
  const originalRefresh=refreshSelectors;refreshSelectors=()=>{originalRefresh();refreshZones();if(currentPage==='comparison')renderHours(true)};
  const originalNavigate=navigate;navigate=page=>{if(page==='custom-comparison'){originalNavigate('comparison');selectComparisonTab('custom');return}originalNavigate(page);if(page==='comparison')selectComparisonTab(comparisonTab)};
  const help=document.createElement('div');help.className='panel help-card';help.innerHTML='<h2>时间对照表</h2><p>查看目标时区的 24 小时对照，或按现实与场景时间比例生成自定义对照。</p>';document.getElementById('page-help').appendChild(help);
  selectComparisonTab('timezone');renderCustom();
  setInterval(()=>{if(currentPage==='comparison'&&comparisonTab==='timezone'){refreshZones();renderHours()}},60000);
})();
