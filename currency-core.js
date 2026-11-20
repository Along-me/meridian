(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.MeridianCurrencyCore=api})(globalThis,()=>{
  const DAY=86400000,MAX_BYTES=2*1024*1024;
  function today(){const now=new Date();return [now.getFullYear(),String(now.getMonth()+1).padStart(2,'0'),String(now.getDate()).padStart(2,'0')].join('-')}
  function validDay(value){return typeof value==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(value)&&Number.isFinite(Date.parse(value+'T00:00:00Z'))&&new Date(value+'T00:00:00Z').toISOString().slice(0,10)===value}
  function age(date,now){return Math.round((Date.parse(now+'T00:00:00Z')-Date.parse(date+'T00:00:00Z'))/DAY)}
  function currencyCode(value,allowed){const code=String(value||'').toUpperCase();if(!/^[A-Z]{3}$/.test(code)||(allowed&&!allowed.has(code)))throw Error('不支持的货币：'+code);return code}
  function rateNumber(value){if(!['string','number'].includes(typeof value)||(typeof value==='string'&&!/^[+]?\d*\.?\d+(?:e[+-]?\d+)?$/i.test(value.trim())))throw Error('汇率必须是大于 0 的数字。');const rate=Number(value);if(!Number.isFinite(rate)||rate<=0)throw Error('汇率必须是大于 0 的有限数字。');return rate}
  function normalizeSnapshot(value,{allowed,origin='imported',now=today(),allowFuture=false}={}){
    if(!value||typeof value!=='object'||Array.isArray(value))throw Error('汇率表格式无效。');
    const base=currencyCode(value.base,allowed),date=value.date||Object.values(value.dates||{}).filter(validDay).sort().at(-1);
    if(!validDay(date)||(!allowFuture&&date>now))throw Error('汇率日期无效或晚于今天。');
    if(!value.rates||typeof value.rates!=='object'||Array.isArray(value.rates))throw Error('汇率表需要 rates 数据。');
    const rates={},dates={};
    for(const [rawCode,rawRate] of Object.entries(value.rates)){
      const code=currencyCode(rawCode,allowed),rate=rateNumber(rawRate),observed=value.dates?.[rawCode]||date;
      if(!validDay(observed)||(!allowFuture&&observed>now))throw Error(code+' 的汇率日期无效。');
      if(Object.hasOwn(rates,code))throw Error('汇率表包含重复币种：'+code);
      rates[code]=rate;dates[code]=observed;
    }
    if(Object.hasOwn(rates,base)&&Math.abs(rates[base]-1)>1e-12)throw Error('基准币种自身的汇率必须为 1。');
    rates[base]=1;dates[base]=date;
    if(Object.keys(rates).length<2)throw Error('汇率表至少需要一个基准币种以外的货币。');
    const providerId=origin==='online'&&['frankfurter','exchange-api','currency-api','custom'].includes(value.providerId)?value.providerId:'frankfurter';
    const names={frankfurter:'Frankfurter v2','exchange-api':'ExchangeRate-API Open','currency-api':'Currency API',custom:'自定义接口'};
    const result={schemaVersion:1,base,date,rates,dates,origin,source:origin==='online'?names[providerId]:origin==='builtin'?'内置参考快照':'手动导入',fetchedAt:typeof value.fetchedAt==='string'&&Number.isFinite(Date.parse(value.fetchedAt))?value.fetchedAt:new Date().toISOString()};
    if(origin==='online')Object.assign(result,{providerId,sourceId:providerId==='custom'&&/^custom:\d+$/.test(value.sourceId||'')?value.sourceId:providerId,exportable:providerId!=='exchange-api',attribution:providerId==='exchange-api'?'https://www.exchangerate-api.com/':''});
    return result;
  }
  function fromFrankfurter(rows,options={}){
    if(!Array.isArray(rows))throw Error('汇率服务返回了无效数据。');
    const now=options.now||today(),rates={USD:1},dates={};
    for(const row of rows){if(!row||row.base!=='USD'||!options.allowed?.has(row.quote)||!validDay(row.date)||row.date>now)continue;const rate=Number(row.rate);if(!Number.isFinite(rate)||rate<=0)continue;rates[row.quote]=rate;dates[row.quote]=row.date}
    return normalizeSnapshot({base:'USD',date:Object.values(dates).sort().at(-1),rates,dates,fetchedAt:new Date().toISOString()},{...options,now,origin:'online'});
  }
  function pair(snapshot,from,to){
    if(!snapshot?.rates||!Object.hasOwn(snapshot.rates,from)||!Object.hasOwn(snapshot.rates,to))return null;
    const dates=[from,to].filter(code=>code!==snapshot.base).map(code=>snapshot.dates?.[code]||snapshot.date).sort();
    if(!dates.every(validDay)||![snapshot.rates[from],snapshot.rates[to]].every(rate=>Number.isFinite(rate)&&rate>0))return null;
    return {fromRate:snapshot.rates[from],toRate:snapshot.rates[to],date:dates[0]||snapshot.date,dateEnd:dates.at(-1)||snapshot.date};
  }
  function selectRate({from,to,cache=[],imported=[],mode='auto',fallback,now=today(),preferredSource=''}){
    if(from===to)return {kind:'identity',fromRate:1,toRate:1,date:null,dateEnd:null,snapshot:null};
    const candidates=(mode==='imported'?imported:cache).flatMap(snapshot=>{const value=pair(snapshot,from,to);if(!value)return [];const days=age(value.date,now),newest=age(value.dateEnd,now);if(newest<0||(mode!=='imported'&&(days<0||days>10)))return [];return [{...value,snapshot,ageDays:days}]});
    candidates.sort((a,b)=>b.date.localeCompare(a.date)||b.dateEnd.localeCompare(a.dateEnd)||Number(b.snapshot.sourceId===preferredSource)-Number(a.snapshot.sourceId===preferredSource)||b.snapshot.fetchedAt.localeCompare(a.snapshot.fetchedAt));
    if(candidates.length){const selected=candidates[0];return {...selected,kind:mode==='imported'?'imported':selected.ageDays===0?'today':'recent'}}
    const value=pair(fallback,from,to);if(!value)throw Error('当前币种缺少参考汇率，请导入汇率表。');
    return {...value,snapshot:fallback,kind:'builtin',ageDays:age(value.date,now)};
  }
  function mergeCache(cache,snapshot){const id=snapshot.sourceId||'frankfurter';return [snapshot,...cache.filter(item=>!((item.sourceId||'frankfurter')===id&&item.base===snapshot.base&&item.date===snapshot.date))].sort((a,b)=>b.date.localeCompare(a.date)).slice(0,120)}
  function snapshotKey(snapshot){return snapshot?[snapshot.sourceId||'frankfurter',snapshot.base,snapshot.date,snapshot.fetchedAt].join('|'):''}
  function provenance(selection,{freshKeys=new Set(),now=today()}={}){
    const snapshot=selection.snapshot;
    if(selection.kind==='identity')return {label:'同币种',fetchedDay:'',network:false};
    if(selection.kind==='builtin')return {label:'内置兜底 · '+(snapshot?.date||'未知日期'),fetchedDay:'',network:false};
    const fetched=new Date(snapshot.fetchedAt),fetchedDay=[fetched.getFullYear(),String(fetched.getMonth()+1).padStart(2,'0'),String(fetched.getDate()).padStart(2,'0')].join('-');
    if(selection.kind==='imported')return {label:'手动导入 · '+(snapshot?.date||fetchedDay),fetchedDay,network:false};
    const network=freshKeys.has(snapshotKey(snapshot));
    return {label:network?'本次联网获取':('命中 '+fetchedDay+' 缓存'),fetchedDay,network,observedToday:selection.date===now};
  }
  function recentSnapshots(cache,now=today()){
    return cache.flatMap(snapshot=>{
      const rates={},dates={};
      for(const [code,rate] of Object.entries(snapshot.rates||{})){
        if(code===snapshot.base)continue;const date=snapshot.dates?.[code]||snapshot.date,days=validDay(date)?age(date,now):-1;
        if(days>=0&&days<=10&&Number.isFinite(rate)&&rate>0){rates[code]=rate;dates[code]=date}
      }
      const observed=Object.values(dates).sort();if(!observed.length)return [];
      rates[snapshot.base]=1;dates[snapshot.base]=observed.at(-1);
      return [{...snapshot,date:observed.at(-1),rates,dates}];
    }).sort((a,b)=>b.date.localeCompare(a.date)||b.fetchedAt.localeCompare(a.fetchedAt));
  }
  function decimal(value){
    let text=String(value).trim();if(/^[+-]?\d{1,3}(?:,\d{3})+(?:\.\d+)?$/.test(text))text=text.replaceAll(',','');
    const match=text.match(/^([+-]?)(\d*)(?:\.(\d*))?(?:e([+-]?\d+))?$/i);
    if(!match||!((match[2]||'')+(match[3]||''))||text.length>48)throw Error('请输入有效金额。');
    const exponent=Number(match[4]||0)-(match[3]||'').length;if(Math.abs(exponent)>1000)throw Error('金额或汇率的数值范围过大。');
    let n=BigInt((match[2]||'0')+(match[3]||'')),d=1n;if(exponent>=0)n*=10n**BigInt(exponent);else d=10n**BigInt(-exponent);if(match[1]==='-')n=-n;return {n,d};
  }
  function convert(amount,selection,digits=2){
    if(!Number.isInteger(digits)||digits<0||digits>1000)throw Error('金额小数位无效。');
    const a=decimal(amount),from=decimal(selection.fromRate),to=decimal(selection.toRate),scale=10n**BigInt(digits);
    let numerator=a.n*to.n*from.d*scale;const denominator=a.d*to.d*from.n;if(denominator<=0)throw Error('汇率无效。');
    const negative=numerator<0n;if(negative)numerator=-numerator;const rounded=(numerator*2n+denominator)/(2n*denominator),text=rounded.toString().padStart(digits+1,'0');
    return (negative&&rounded!==0n?'-':'')+(digits?text.slice(0,-digits)+'.'+text.slice(-digits):text);
  }
  function dynamicDigits(value,{minimumSignificant=2,maxDigits=12}={}){
    const absolute=Math.abs(Number(value));if(!Number.isFinite(absolute)||absolute===0)return 2;
    if(absolute>=1)return 2;
    const leadingZeros=Math.max(0,Math.floor(-Math.log10(absolute)));
    return Math.min(maxDigits,Math.max(2,leadingZeros+minimumSignificant));
  }
  function convertDynamic(amount,selection){
    const a=decimal(amount),from=decimal(selection.fromRate),to=decimal(selection.toRate);
    const n=(a.n<0n?-a.n:a.n)*to.n*from.d,d=a.d*to.d*from.n;if(d<=0n||n<0n)throw Error('汇率无效。');
    let digits=2;
    if(n>0n&&n<d){let order=n.toString().length-d.toString().length;const factor=10n**BigInt(Math.max(0,-order));if(n*factor<d)order--;digits=Math.max(2,1-order)}
    return convert(amount,selection,digits);
  }
  function formatAmount(value){const [whole,fraction]=String(value).split('.');return (whole==='-0'?'-':'')+new Intl.NumberFormat('zh-CN',{maximumFractionDigits:0}).format(BigInt(whole))+(fraction!==undefined?'.'+fraction:'')}
  function csvRows(text){
    const rows=[];let row=[],field='',quoted=false;
    for(let i=0;i<text.length;i++){
      const char=text[i];if(char==='"'){if(quoted&&text[i+1]==='"'){field+='"';i++}else if(quoted||!field){quoted=!quoted}else throw Error('CSV 引号格式无效。')}
      else if(char===','&&!quoted){row.push(field);field=''}
      else if((char==='\n'||char==='\r')&&!quoted){if(char==='\r'&&text[i+1]==='\n')i++;row.push(field);if(row.some(value=>value.trim()))rows.push(row);row=[];field=''}
      else field+=char;
    }
    if(quoted)throw Error('CSV 中存在未闭合的引号。');row.push(field);if(row.some(value=>value.trim()))rows.push(row);return rows;
  }
  function parseImport(text,options={}){
    if(typeof text!=='string'||new TextEncoder().encode(text).length>MAX_BYTES)throw Error('汇率文件不能超过 2 MB。');
    const content=text.replace(/^\uFEFF/,'').trim();if(!content)throw Error('汇率文件为空。');
    if(content.startsWith('{')||content.startsWith('[')){
      let value;try{value=JSON.parse(content)}catch(_){throw Error('JSON 文件格式无效。')}
      const list=Array.isArray(value)?value:Array.isArray(value.snapshots)?value.snapshots:[value];if(list.length>40)throw Error('一次最多导入 40 张汇率表。');
      if(!list.length)throw Error('没有可导入的汇率。');return list.map(item=>normalizeSnapshot({...item,fetchedAt:new Date().toISOString()},{...options,origin:'imported'}));
    }
    const rows=csvRows(content);if(rows.length>5000)throw Error('CSV 最多支持 5000 行。');
    const aliases={'基准币种':'base','目标币种':'quote','汇率':'rate','汇率日期':'date'},headers=(rows.shift()||[]).map(name=>aliases[name.trim()]||name.trim().toLowerCase());
    if(!['base','quote','rate','date'].every(key=>headers.includes(key)))throw Error('CSV 表头需要包含 base,quote,rate,date。');
    const tables=new Map();
    for(const cells of rows){
      const get=key=>(cells[headers.indexOf(key)]||'').trim(),base=currencyCode(get('base'),options.allowed),quote=currencyCode(get('quote'),options.allowed),date=get('date'),rate=rateNumber(get('rate'));
      if(!validDay(date)||date>(options.now||today()))throw Error('CSV 汇率日期无效或晚于今天。');
      if(!tables.has(base))tables.set(base,{base,date,rates:{},dates:{}});const table=tables.get(base);
      if(table.dates[quote]===date)throw Error('同一天存在重复币种：'+quote);
      if(!table.dates[quote]||table.dates[quote]<date){table.rates[quote]=rate;table.dates[quote]=date}
      if(table.date<date)table.date=date;
    }
    if(!tables.size)throw Error('CSV 中没有汇率数据。');if(tables.size>40)throw Error('一次最多导入 40 张汇率表。');
    return [...tables.values()].map(item=>normalizeSnapshot(item,{...options,origin:'imported'}));
  }
  function sanitizeStore(raw,allowed,now=today()){
    function list(value,origin){return (Array.isArray(value)?value:[]).slice(0,origin==='online'?120:40).flatMap(item=>{try{return [normalizeSnapshot(item,{allowed,now,origin})]}catch(_){return []}})}
    const cache=list(raw?.cache,'online'),imported=list(raw?.imported,'imported'),value=raw?.config||{};
    const string=(key,max=2000)=>typeof value[key]==='string'&&value[key].length<=max?value[key]:'';
    const config={mode:value.mode==='imported'&&imported.length?'imported':'auto',provider:['frankfurter','exchange-api','currency-api','custom'].includes(value.provider)?value.provider:'frankfurter',providerFallback:value.providerFallback!==false,providerUrl:string('providerUrl'),providerFormat:['custom-rates','custom-currency-api','custom-array'].includes(value.providerFormat)?value.providerFormat:'custom-rates',providerBase:allowed.has(value.providerBase)?value.providerBase:'USD',providerMapping:string('providerMapping',3000),providerHeader:string('providerHeader',100),providerKey:string('providerKey',2000),from:allowed.has(value.from)?value.from:'',to:allowed.has(value.to)?value.to:'',amount:typeof value.amount==='string'&&value.amount.length<=48?value.amount:'1'};
    return {schemaVersion:1,config,cache,imported};
  }
  return {today,validDay,age,normalizeSnapshot,fromFrankfurter,selectRate,mergeCache,snapshotKey,provenance,recentSnapshots,convert,convertDynamic,dynamicDigits,formatAmount,parseImport,sanitizeStore};
});
