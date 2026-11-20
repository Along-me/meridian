(() => {
  if(window.meridianDesktop&&new URLSearchParams(location.search).get('window')==='widget')return;
  const Core=window.MeridianCurrencyCore,Reference=window.MeridianCurrencyReference,allowed=new Set(Object.keys(Reference.currencies));
  const fallback=Core.normalizeSnapshot({...Reference.fallback,date:Reference.asOf},{allowed,origin:'builtin',allowFuture:true});
  const storageKey='meridian-currency-v1',desktop=window.meridianDesktop;
  let database=Core.sanitizeStore({},allowed),loading=false,saveTimer=null,lastAutoAttempt=0,revision=0;
  const freshKeys=new Set();
  try{database=Core.sanitizeStore(JSON.parse(localStorage.getItem(storageKey)||'{}'),allowed)}catch(_){}
  const currencyNames=new Intl.DisplayNames(['zh-CN'],{type:'currency'}),regionNames=new Intl.DisplayNames(['zh-CN'],{type:'region'});
  const currencyName=code=>currencyNames.of(code)||Reference.currencies[code]?.name||code;
  const countryCurrencies=code=>Reference.countries[code]?.currencies||[];
  const widgetChoices=()=>state.zones.flatMap(item=>{const zone=catalogue.find(zone=>zone.id===item.id);return zone?countryCurrencies(zone.code).map(currency=>({currency,zone,alias:item.alias?.trim()||''})):[]});
  const currencies=Object.keys(Reference.currencies).sort((a,b)=>currencyName(a).localeCompare(currencyName(b),'zh-CN'));
  const currencyRegions=Object.fromEntries(currencies.map(currency=>[currency,Object.entries(Reference.countries).filter(([,item])=>item.currencies.includes(currency)).map(([code])=>regionNames.of(code)).join(' ')]));
  function defaults(){const choices=widgetChoices();if(!allowed.has(database.config.from))database.config.from=choices[0]?.currency||'CNY';if(!allowed.has(database.config.to))database.config.to=choices.find(item=>item.currency!==database.config.from)?.currency||(database.config.from==='USD'?'CNY':'USD')}
  defaults();
  names.currency='货币转换';
  const nav=document.createElement('button');nav.type='button';nav.className='nav-item';nav.dataset.page='currency';nav.title='货币转换';nav.innerHTML=icon('swap')+'<span>货币转换</span>';nav.onclick=()=>navigate('currency');document.querySelector('nav[aria-label="主导航"]').appendChild(nav);
  const page=document.createElement('section');page.id='page-currency';page.className='page currency-page hidden';
  page.innerHTML='<div class="page-heading"><h1>货币转换</h1><div class="currency-toolbar"><button type="button" id="currency-refresh">获取最新汇率</button><button type="button" id="currency-import">导入</button><button type="button" id="currency-export">导出</button><button type="button" class="ghost" id="currency-template">模板</button></div></div><div class="panel currency-panel"><div class="currency-mode-row"><div class="mode-tabs" role="group" aria-label="汇率来源"><button type="button" data-currency-mode="auto">自动汇率</button><button type="button" data-currency-mode="imported">导入汇率</button></div><div class="currency-import-help"><span>CSV / JSON</span></div></div><div class="currency-fields"><div class="currency-amount-field"><label class="form-label" for="currency-amount">金额</label><input class="field" id="currency-amount" inputmode="decimal" maxlength="48" placeholder="输入金额"></div><div><label class="form-label" for="currency-from">来源货币</label><input class="field" type="search" data-search-for="currency-from" placeholder="搜索货币"><div class="select-wrap"><select class="field" id="currency-from"></select></div></div><button type="button" class="ghost currency-swap" id="currency-swap" aria-label="交换货币">'+icon('swap')+'</button><div><label class="form-label" for="currency-to">目标货币</label><input class="field" type="search" data-search-for="currency-to" placeholder="搜索货币"><div class="select-wrap"><select class="field" id="currency-to"></select></div></div></div><div id="currency-quick-from" class="currency-quick-group"></div><div id="currency-quick-to" class="currency-quick-group"></div><div class="currency-result" id="currency-result" aria-live="polite"></div><p class="currency-status" id="currency-status" role="status"></p></div><input class="hidden" id="currency-import-file" type="file" accept=".csv,.json,text/csv,application/json">';
  document.querySelector('.main').appendChild(page);
  for(const direction of ['from','to']){
    const quick=document.getElementById('currency-quick-'+direction),select=document.getElementById('currency-'+direction);
    select.closest('.select-wrap').after(quick);quick.setAttribute('aria-label',direction==='from'?'来源快捷货币':'目标快捷货币');
  }
  document.getElementById('currency-template').textContent='下载模板';
  document.getElementById('currency-export').textContent='导出当前汇率';
  const cachePanel=document.createElement('details');cachePanel.className='panel currency-cache-panel';cachePanel.id='currency-cache-panel';
  cachePanel.innerHTML='<summary><span>近10天缓存 <span id="currency-cache-count">0</span></span>'+icon('chevron')+'</summary><div class="currency-cache-body"><div class="currency-cache-toolbar"><span>按汇率日期筛选，仅列出本地已有数据</span><button type="button" id="currency-cache-download-all">下载全部缓存</button></div><div id="currency-cache-list"></div></div>';
  page.appendChild(cachePanel);
  const templateDialog=document.createElement('div');templateDialog.className='modal-mask hidden';templateDialog.id='currency-template-dialog';templateDialog.setAttribute('role','dialog');templateDialog.setAttribute('aria-modal','true');templateDialog.setAttribute('aria-labelledby','currency-template-title');
  templateDialog.innerHTML='<div class="modal currency-template-modal"><div class="modal-head"><h2 id="currency-template-title">汇率模板</h2><button type="button" class="ghost icon" data-close-currency-template aria-label="关闭模板说明">'+icon('close')+'</button></div><div class="modal-body"><table class="currency-field-table"><thead><tr><th>字段</th><th>说明</th><th>示例</th></tr></thead><tbody><tr><td>base</td><td>基准币种代码</td><td>USD</td></tr><tr><td>quote</td><td>目标币种代码</td><td>CNY</td></tr><tr><td>rate</td><td>1 单位基准币种可兑换的目标金额，须大于 0</td><td>7.2</td></tr><tr><td>date</td><td>汇率实际日期，YYYY-MM-DD</td><td>2026-11-19</td></tr></tbody></table><p class="currency-template-note">每行一条汇率；可填写不同日期。同一币种出现多次时保留较新的日期。也支持导入本工具导出的 JSON。</p></div><div class="modal-foot"><button type="button" id="currency-field-guide">下载字段说明</button><button type="button" class="primary" id="currency-template-download">下载 CSV 模板</button></div></div>';
  document.body.appendChild(templateDialog);
  let templateFocus=null;
  function closeTemplate(){templateDialog.classList.add('hidden');templateFocus?.focus()}
  templateDialog.addEventListener('click',event=>{if(event.target===templateDialog||event.target.closest('[data-close-currency-template]'))closeTemplate()});
  templateDialog.addEventListener('keydown',event=>{if(event.key==='Escape'){event.preventDefault();closeTemplate()}if(event.key==='Tab'){const nodes=Array.from(templateDialog.querySelectorAll('button')),first=nodes[0],last=nodes.at(-1);if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus()}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus()}}});
  const floatingTip=document.createElement('div');floatingTip.className='currency-floating-tip hidden';floatingTip.setAttribute('role','tooltip');document.body.appendChild(floatingTip);let tipOwner=null;
  function hideTip(){floatingTip.classList.add('hidden');tipOwner=null}
  function showTip(owner){
    const tip=owner.querySelector('.color-priority-tip');if(!tip)return;tipOwner=owner;floatingTip.replaceChildren(...Array.from(tip.childNodes,node=>node.cloneNode(true)));floatingTip.classList.remove('hidden');
    const r=owner.getBoundingClientRect(),width=Math.min(320,Math.max(0,innerWidth-24));floatingTip.style.width=width+'px';floatingTip.style.maxHeight=Math.max(40,innerHeight-24)+'px';
    const h=floatingTip.getBoundingClientRect().height;floatingTip.style.left=Math.max(12,Math.min(r.right-width,innerWidth-width-12))+'px';floatingTip.style.top=Math.max(12,Math.min(r.bottom+h+8<=innerHeight?r.bottom+8:r.top-h-8,innerHeight-h-12))+'px';
  }
  page.addEventListener('pointerover',event=>{const owner=event.target.closest('.color-priority-help');if(owner&&owner!==tipOwner)showTip(owner)});
  page.addEventListener('pointerout',event=>{if(tipOwner&&!tipOwner.contains(event.relatedTarget))hideTip()});
  page.addEventListener('focusin',event=>{const owner=event.target.closest('.color-priority-help');if(owner)showTip(owner)});page.addEventListener('focusout',hideTip);
  page.addEventListener('click',event=>{const owner=event.target.closest('.color-priority-help');if(owner)showTip(owner)});
  document.addEventListener('scroll',hideTip,true);window.addEventListener('resize',hideTip);document.addEventListener('keydown',event=>{if(event.key==='Escape')hideTip()});
  const amount=document.getElementById('currency-amount'),status=document.getElementById('currency-status'),Providers=window.MeridianCurrencyProviders;
  const sourceSettings=window.createCurrencySourceSettings({page,getConfig:()=>database.config,updateConfig:patch=>{Object.assign(database.config,patch);lastAutoAttempt=0;saveConfig();renderResult()},save:async()=>{clearTimeout(saveTimer);await commit({config:database.config})}});
  function message(text,error=false){status.textContent=text;status.classList.toggle('error',error)}
  async function commit(patch){
    if(desktop?.currencySave)return desktop.currencySave(patch);
    const next=Core.sanitizeStore({...database,...patch,config:{...database.config,...patch.config}},allowed);localStorage.setItem(storageKey,JSON.stringify(next));return next;
  }
  function saveConfig(){revision++;clearTimeout(saveTimer);saveTimer=setTimeout(()=>commit({config:database.config}).catch(()=>message('设置未保存，当前仍可继续换算。',true)),180)}
  function selected(){return Core.selectRate({from:database.config.from,to:database.config.to,cache:database.cache,imported:database.imported,mode:database.config.mode,fallback,preferredSource:Providers.sourceId(database.config)})}
  function renderResult(){
    hideTip();
    const box=document.getElementById('currency-result');
    try{
      const selection=selected(),to=database.config.to,from=database.config.from;
      const result=Core.convertDynamic(database.config.amount,selection),rate=Core.convertDynamic('1',selection);
      const rateText=Number.isFinite(selection.toRate/selection.fromRate)?new Intl.NumberFormat('zh-CN',{maximumSignificantDigits:10,minimumSignificantDigits:2}).format(selection.toRate/selection.fromRate):Core.formatAmount(rate);
      const sourceInfo=Core.provenance(selection,{freshKeys});
      const date=selection.date?(selection.date===selection.dateEnd?selection.date:selection.date+' — '+selection.dateEnd):'';
      const details=selection.snapshot?'<span class="color-priority-help"><button type="button" class="color-priority-info" aria-label="汇率数据详情" aria-describedby="currency-rate-details">'+icon('info')+'</button><span id="currency-rate-details" class="color-priority-tip" role="tooltip">'+esc(selection.kind==='builtin'?'随包固定参考值。':selection.kind==='imported'?'独立导入表，联网更新不会覆盖。':sourceInfo.network?'本次联网获取，汇率日期以服务原始日期为准。':'读取本地缓存，汇率日期以数据原始日期为准。')+'</span></span>':'';
      box.classList.remove('currency-result-error');box.innerHTML='<div class="currency-result-number">'+esc(Core.formatAmount(result))+'<small>'+esc(to)+'</small></div><div class="currency-result-rate">1 '+esc(from)+' ≈ '+rateText+' '+esc(to)+'</div><div class="currency-meta"><span class="currency-source-badge" id="currency-source-badge">'+esc(sourceInfo.label)+'</span><span id="currency-rate-date">'+esc(date?'汇率日期 '+date:'')+'</span><span>'+esc(selection.snapshot?.source||'')+'</span></div>';
      box.querySelector('.currency-meta').insertAdjacentHTML('beforeend',details);box.dataset.source=selection.kind;box.dataset.value=result;renderCache();
      const attribution=selection.snapshot?.attribution;if(attribution){const link=document.createElement('a');link.href=attribution;link.target='_blank';link.rel='noopener noreferrer';link.textContent='Rates By Exchange Rate API';box.querySelector('.currency-meta').appendChild(link)}
      document.getElementById('currency-export').disabled=selection.snapshot?.exportable===false;
    }catch(error){box.classList.add('currency-result-error');box.textContent=database.config.amount.trim()?error.message:'请输入金额';box.removeAttribute('data-value');try{renderCache()}catch(_){}}
  }
  function renderSelectors(){
    defaults();const choices=widgetChoices(),own=new Set(choices.map(item=>item.currency));
    for(const id of ['currency-from','currency-to']){
      const select=document.getElementById(id),search=document.querySelector('[data-search-for="'+id+'"]').value.trim().toLowerCase(),chosen=database.config[id==='currency-from'?'from':'to'];
      const matches=currencies.filter(code=>[code,currencyName(code),currencyRegions[code],...choices.filter(item=>item.currency===code).map(item=>item.alias)].join(' ').toLowerCase().includes(search));
      const option=code=>'<option value="'+code+'">'+esc(currencyName(code)+' '+code)+'</option>';
      const groups=[['挂件关联货币',matches.filter(code=>own.has(code))],['全部货币',matches.filter(code=>!own.has(code))]];
      let html=groups.filter(([,codes])=>codes.length).map(([label,codes])=>'<optgroup label="'+label+'">'+codes.map(option).join('')+'</optgroup>').join('');
      if(!matches.includes(chosen))html='<optgroup label="当前选择">'+option(chosen)+'</optgroup>'+html;
      if(!matches.length)html+='<option disabled>没有匹配的货币</option>';
      select.innerHTML=html;select.value=chosen;
    }
    for(const direction of ['from','to']){
      const buttons=choices.map(item=>'<button type="button" class="quick-zone '+(database.config[direction]===item.currency?'active':'')+'" data-currency-pick="'+direction+'" data-currency-code="'+item.currency+'">'+esc((item.alias?item.alias+' · ':'')+regionNames.of(item.zone.code)+' '+item.currency)+'</button>').join('');
      const unassigned=state.zones.filter(item=>{const zone=catalogue.find(zone=>zone.id===item.id);return zone&&!countryCurrencies(zone.code).length}).map(item=>{const zone=catalogue.find(zone=>zone.id===item.id);return '<button type="button" class="quick-zone" disabled title="此项没有统一法定货币，请自行选择货币">'+esc(zone.code==='UT'?'UTC · 无对应货币':zone.country+' · 无统一货币')+'</button>'}).join('');
      document.getElementById('currency-quick-'+direction).innerHTML=buttons+unassigned;
    }
    for(const button of page.querySelectorAll('[data-currency-mode]')){const active=button.dataset.currencyMode===database.config.mode;button.classList.toggle('selected',active);button.setAttribute('aria-pressed',String(active));button.disabled=button.dataset.currencyMode==='imported'&&!database.imported.length}
    renderResult();
  }
  async function refresh(){
    if(loading)return;loading=true;const button=document.getElementById('currency-refresh');button.disabled=true;button.textContent='更新中…';message('');
    const config={...database.config};
    try{
      clearTimeout(saveTimer);await commit({config});
      let info;
      if(desktop?.currencyRefresh){const next=await desktop.currencyRefresh();database.cache=next.cache;info=next.refreshInfo}
      else{const result=await Providers.refresh({config,cache:database.cache,allowed});database.cache=result.cache;info=result.refreshInfo;localStorage.setItem(storageKey,JSON.stringify(database))}
      if(info?.network)freshKeys.add(info.snapshotKey);
      renderResult();renderCache();
      if(info?.switched){const primary=Providers.catalogue[config.provider]?.name||'自定义接口',actual=Providers.catalogue[info.providerId]?.name;message(primary+'不可用，已使用 '+actual+'。',true)}else message('');
    }catch(error){renderResult();message(error.message.replace(/^Error invoking remote method '[^']+': Error: /,''),true)}
    finally{loading=false;button.disabled=false;button.textContent='获取最新汇率'}
  }
  async function importText(text){
    clearTimeout(saveTimer);const snapshots=Core.parseImport(text,{allowed}),nextConfig={...database.config,mode:'imported'};
    await commit({imported:snapshots,config:nextConfig});database.imported=snapshots;database.config=nextConfig;renderSelectors();message('已导入 '+snapshots.length+' 张汇率表。');
  }
  function download(name,text,type){const url=URL.createObjectURL(new Blob([text],{type})),link=document.createElement('a');link.href=url;link.download=name;link.click();setTimeout(()=>URL.revokeObjectURL(url),1000)}
  function exportSnapshot(snapshot){if(snapshot.exportable===false)throw Error('此来源允许本地换算与缓存，不允许导出汇率数据。');return {schemaVersion:1,base:snapshot.base,date:snapshot.date,rates:snapshot.rates,dates:snapshot.dates,source:snapshot.source,fetchedAt:snapshot.fetchedAt}}
  function renderCache(){
    const snapshots=Core.recentSnapshots(database.cache),count=document.getElementById('currency-cache-count'),list=document.getElementById('currency-cache-list');
    count.textContent=String(snapshots.length);document.getElementById('currency-cache-download-all').disabled=!snapshots.some(snapshot=>snapshot.exportable!==false);
    let hit=null;try{hit=selected().snapshot}catch(_){}
    list.innerHTML=snapshots.map((snapshot,index)=>{const dates=Object.entries(snapshot.dates).filter(([code])=>code!==snapshot.base).map(([,date])=>date).sort(),date=dates[0]===dates.at(-1)?dates[0]:dates[0]+' — '+dates.at(-1),selectedCache=database.config.mode==='auto'&&hit&&hit.origin!=='builtin'&&hit.origin!=='imported'&&Core.snapshotKey(hit)===Core.snapshotKey(snapshot);return '<div class="currency-cache-row"><div><div class="currency-cache-date">'+esc(date)+(selectedCache?'<span class="currency-source-badge">当前命中</span>':'')+'</div><div class="currency-cache-caption">'+esc(snapshot.source+' · '+snapshot.base+' 基准 · '+Object.keys(snapshot.rates).length+' 种货币')+'</div></div><button type="button" class="ghost" data-download-currency-cache="'+index+'" '+(snapshot.exportable===false?'disabled title="来源许可不允许导出"':'')+'>下载 JSON</button></div>'}).join('')||'<div class="currency-cache-empty">暂无近10天的本地缓存</div>';
  }
  document.getElementById('currency-cache-list').onclick=event=>{const button=event.target.closest('[data-download-currency-cache]');if(!button)return;const snapshot=Core.recentSnapshots(database.cache)[Number(button.dataset.downloadCurrencyCache)];if(snapshot&&snapshot.exportable!==false)download('meridian-cache-'+snapshot.date+'.json',JSON.stringify(exportSnapshot(snapshot),null,2),'application/json')};
  document.getElementById('currency-cache-download-all').onclick=()=>{const snapshots=Core.recentSnapshots(database.cache).filter(snapshot=>snapshot.exportable!==false);if(snapshots.length)download('meridian-cache-last10days.json',JSON.stringify({schemaVersion:1,snapshots:snapshots.map(exportSnapshot)},null,2),'application/json')};
  document.getElementById('currency-import').onclick=()=>document.getElementById('currency-import-file').click();
  document.getElementById('currency-import-file').onchange=async event=>{const file=event.target.files[0];if(!file)return;try{if(file.size>2*1024*1024)throw Error('文件不能超过 2 MB。');await importText(await file.text())}catch(error){message(error.message.replace(/^Error invoking remote method '[^']+': Error: /,''),true)}finally{event.target.value=''}};
  document.getElementById('currency-template').onclick=()=>{templateFocus=document.activeElement;templateDialog.classList.remove('hidden');templateDialog.querySelector('button').focus()};
  document.getElementById('currency-template-download').onclick=()=>{const codes=['CNY','EUR','MXN','IDR','NGN'],lines=['base,quote,rate,date',...codes.map(code=>'USD,'+code+','+fallback.rates[code]+','+(fallback.dates[code]||fallback.date))];download('meridian-rates-template.csv','\uFEFF'+lines.join('\r\n'),'text/csv;charset=utf-8')};
  document.getElementById('currency-field-guide').onclick=()=>download('meridian-rates-fields.txt',['汇率导入字段说明','base：基准币种代码，例如 USD','quote：目标币种代码，例如 CNY','rate：1 单位 base 可兑换的 quote 数量，必须大于 0','date：实际汇率日期，YYYY-MM-DD，不得晚于今天','示例：USD,CNY,7.2,2026-11-19 表示 1 美元可兑换 7.2 人民币，汇率日期为 2026-11-19。','每行一条汇率。多日同一币种保留最新日期；同日重复币种会拒绝导入。','JSON 可使用导出文件或 {snapshots:[...]} 批量汇率表。','缓存获取时间与汇率原始日期可能不同，导入不会修改原始日期。'].join('\r\n'),'text/plain;charset=utf-8');
  document.getElementById('currency-export').onclick=()=>{try{const snapshot=selected().snapshot||fallback;download('meridian-rates-'+snapshot.date+'.json',JSON.stringify(exportSnapshot(snapshot),null,2),'application/json')}catch(error){message(error.message,true)}};
  document.getElementById('currency-refresh').onclick=refresh;
  document.getElementById('currency-swap').onclick=()=>{[database.config.from,database.config.to]=[database.config.to,database.config.from];for(const input of document.querySelectorAll('[data-search-for^="currency-"]'))input.value='';saveConfig();renderSelectors()};
  amount.value=database.config.amount;amount.oninput=()=>{database.config.amount=amount.value;saveConfig();renderResult()};
  for(const direction of ['from','to'])document.getElementById('currency-'+direction).onchange=event=>{database.config[direction]=event.target.value;saveConfig();renderSelectors()};
  for(const input of page.querySelectorAll('[data-search-for]'))input.oninput=renderSelectors;
  page.addEventListener('click',event=>{
    const pick=event.target.closest('[data-currency-pick]');if(pick){database.config[pick.dataset.currencyPick]=pick.dataset.currencyCode;document.querySelector('[data-search-for="currency-'+pick.dataset.currencyPick+'"]').value='';saveConfig();renderSelectors()}
    const mode=event.target.closest('[data-currency-mode]');if(mode&&!mode.disabled){database.config.mode=mode.dataset.currencyMode;saveConfig();renderSelectors();message('');if(database.config.mode==='auto'&&currentPage==='currency')ensureFresh()}
  });
  const initialRevision=revision;
  const ready=(desktop?.currencyRead?desktop.currencyRead():Promise.resolve(database)).then(value=>{const next=Core.sanitizeStore(value,allowed);if(revision===initialRevision)database=next;else{database.cache=next.cache;database.imported=next.imported}defaults();amount.value=database.config.amount;sourceSettings.sync();renderSelectors()}).catch(()=>{sourceSettings.sync();renderSelectors();message('无法读取本地缓存，当前使用内置参考值。',true)});
  window.meridianCurrencyReady=ready;
  async function ensureFresh(){await ready;renderSelectors();const fetchedToday=database.cache.some(item=>(item.sourceId||'frankfurter')===Providers.sourceId(database.config)&&new Date(item.fetchedAt).toDateString()===new Date().toDateString());if(database.config.mode==='auto'&&!fetchedToday&&Date.now()-lastAutoAttempt>60000){lastAutoAttempt=Date.now();refresh()}}
  const originalNavigate=navigate;navigate=target=>{originalNavigate(target);if(target==='currency')ensureFresh()};
  const originalRefresh=refreshSelectors;refreshSelectors=()=>{originalRefresh();renderSelectors()};
  const help=document.createElement('div');help.className='panel help-card';help.innerHTML='<h2>货币转换</h2><p>切换汇率源或导入汇率表进行换算，支持缓存、离线参考值和模板下载。汇率仅供参考。</p>';document.getElementById('page-help').appendChild(help);
  renderSelectors();setInterval(()=>{if(currentPage==='currency')ensureFresh()},60000);
})();
