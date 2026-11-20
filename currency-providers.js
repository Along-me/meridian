(function(root,factory){const api=factory(typeof module==='object'&&module.exports?require('./currency-core.js'):root.MeridianCurrencyCore);if(typeof module==='object'&&module.exports)module.exports=api;else root.MeridianCurrencyProviders=api})(globalThis,Core=>{
  const catalogue={
    frankfurter:{name:'Frankfurter v2',url:'https://api.frankfurter.dev/v2/rates?base=USD',exportable:true},
    'exchange-api':{name:'ExchangeRate-API Open',url:'https://open.er-api.com/v6/latest/USD',exportable:false,attribution:'https://www.exchangerate-api.com/'},
    'currency-api':{name:'Currency API',url:'https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/usd.json',alternate:'https://latest.currency-api.pages.dev/v1/currencies/usd.json',exportable:true},
    custom:{name:'自定义接口',exportable:true}
  };
  const defaults={data:'',base:'base',date:'date',rates:'rates',quote:'quote',rate:'rate',dateFormat:'date'};
  function sourceId(config){
    if(config.provider!=='custom')return config.provider||'frankfurter';
    const text=JSON.stringify([config.providerUrl,config.providerFormat,config.providerBase,config.providerMapping,config.providerHeader,config.providerKey]);let hash=2166136261;
    for(const char of text){hash^=char.charCodeAt(0);hash=Math.imul(hash,16777619)}return 'custom:'+String(hash>>>0);
  }
  function pathValue(value,path){
    if(!path||path==='$')return value;const parts=path.replace(/^\$\./,'').split('.');
    if(parts.length>16||parts.some(part=>!part||['__proto__','prototype','constructor'].includes(part)))throw Error('字段路径无效');
    return parts.reduce((current,key)=>current&&typeof current==='object'&&Object.hasOwn(current,key)?current[key]:undefined,value);
  }
  function mapping(config){
    let value={};try{value=JSON.parse(config.providerMapping||'{}')}catch(_){throw Error('字段映射必须是有效 JSON')}
    if(!value||typeof value!=='object'||Array.isArray(value))throw Error('字段映射必须是 JSON 对象');
    const result={...defaults};for(const key of Object.keys(defaults))if(value[key]!==undefined){if(typeof value[key]!=='string'||value[key].length>160)throw Error('字段路径无效');result[key]=value[key]}
    if(!['date','timestamp','milliseconds'].includes(result.dateFormat))throw Error('日期格式须为 date、timestamp 或 milliseconds');return result;
  }
  function observedDay(value,format='date'){
    if(format==='date'){if(!Core.validDay(value))throw Error('接口缺少有效的汇率日期');return value}
    if(typeof value!=='number'||!Number.isFinite(value))throw Error('时间戳日期无效');const date=new Date(value*(format==='timestamp'?1000:1));if(!Number.isFinite(date.getTime()))throw Error('时间戳日期无效');return date.toISOString().slice(0,10);
  }
  function parse(provider,payload,{config={},allowed,now=Core.today()}={}){
    const info=catalogue[provider];if(!info)throw Error('未知汇率源');
    let base,date,rates={},dates={};
    if(provider==='frankfurter'){
      const snapshot=Core.fromFrankfurter(payload,{allowed,now});return {...snapshot,providerId:provider,sourceId:provider,source:info.name,exportable:info.exportable};
    }
    if(provider==='exchange-api'){
      if(payload?.result!=='success')throw Error('汇率服务返回失败状态');base=payload.base_code;date=observedDay(payload.time_last_update_unix,'timestamp');rates=payload.rates;
    }else if(provider==='currency-api'){
      base='USD';date=observedDay(payload?.date);rates=payload?.usd;
    }else{
      const map=mapping(config),data=pathValue(payload,map.data);base=(map.base?pathValue(data,map.base):undefined)||config.providerBase||'USD';
      if(config.providerFormat==='custom-currency-api'){base=config.providerBase||'USD';rates=data?.[base.toLowerCase()];date=observedDay(pathValue(data,map.date),map.dateFormat)}
      else if(config.providerFormat==='custom-array'){
        if(!Array.isArray(data)||data.length>2000)throw Error('列表路径未指向有效数组');base=config.providerBase||'USD';
        for(const row of data){const rowBase=map.base?pathValue(row,map.base):undefined;if(rowBase&&String(rowBase).toUpperCase()!==base)continue;const code=String(pathValue(row,map.quote)||'').toUpperCase();if(!allowed.has(code))continue;
          const value=pathValue(row,map.rate),day=observedDay(pathValue(row,map.date),map.dateFormat);if(!dates[code]||dates[code]<day){rates[code]=value;dates[code]=day}}
        date=Object.values(dates).sort().at(-1);
      }else{rates=pathValue(data,map.rates);date=observedDay(pathValue(data,map.date),map.dateFormat)}
    }
    base=String(base||'').toUpperCase();if(!allowed.has(base))throw Error('接口基准币种无效');
    if(!rates||typeof rates!=='object'||Array.isArray(rates))throw Error('汇率字段未指向有效对象');
    const filtered={},filteredDates={};for(const [rawCode,value] of Object.entries(rates)){const code=rawCode.toUpperCase();if(!allowed.has(code))continue;filtered[code]=value;if(dates[code])filteredDates[code]=dates[code]}
    const snapshot=Core.normalizeSnapshot({base,date,rates:filtered,dates:filteredDates},{allowed,now,origin:'online'});
    return {...snapshot,providerId:provider,sourceId:provider==='custom'?sourceId({...config,provider}):provider,source:info.name,exportable:info.exportable,attribution:info.attribution||''};
  }
  function request(config,provider){
    const info=catalogue[provider],headers={Accept:'application/json'};
    let url=provider==='custom'?config.providerUrl:info.url;
    if(provider==='custom'){
      url=String(url||'').replaceAll('{base}',encodeURIComponent(config.providerBase||'USD'));
      if(config.providerHeader&&config.providerKey){if(!/^[A-Za-z0-9-]+$/.test(config.providerHeader)||/[\r\n]/.test(config.providerKey))throw Error('请求头格式无效');headers[config.providerHeader]=config.providerKey}
    }
    let address;try{address=new URL(url)}catch(_){throw Error('接口地址无效')}
    if(!['http:','https:'].includes(address.protocol)||address.username||address.password)throw Error('接口仅支持 HTTP(S)，认证请使用请求头');
    return {url:address.href,headers};
  }
  async function fetchSnapshot(config,provider,{allowed,now,fetchImpl}){
    const item=request(config,provider),addresses=[item.url];if(catalogue[provider].alternate)addresses.push(catalogue[provider].alternate);
    let failed='请求失败';
    for(const url of addresses){
      try{
        const response=await fetchImpl(url,{headers:item.headers,redirect:'error',signal:AbortSignal.timeout(7000)});
        if(!response.ok)throw Error('HTTP '+response.status);
        if(Number(response.headers?.get('content-length'))>2*1024*1024)throw Error('响应超过 2 MB');
        let payload;if(response.text){const text=await response.text();if(new TextEncoder().encode(text).length>2*1024*1024)throw Error('响应超过 2 MB');try{payload=JSON.parse(text)}catch(_){throw Error('返回内容不是有效 JSON')}}else payload=await response.json();
        return parse(provider,payload,{config,allowed,now});
      }catch(error){failed=/^(HTTP \d+|响应超过|返回内容|接口|汇率|字段|日期|时间戳|列表|请求头)/.test(error.message)?error.message:'请求失败或超时'}
    }
    throw Error(failed);
  }
  async function refresh({config,cache=[],allowed,now=Core.today(),fetchImpl=globalThis.fetch}){
    const primary=config.provider||'frankfurter',chain=[primary,...(config.providerFallback!==false?['frankfurter','exchange-api','currency-api'].filter(id=>id!==primary):[])],errors=[];
    for(const provider of chain){
      try{
        const snapshot=await fetchSnapshot(config,provider,{allowed,now,fetchImpl});
        const needsPair=config.from&&config.to&&config.from!==config.to;
        if(needsPair&&(!snapshot.rates[config.from]||!snapshot.rates[config.to]))throw Error('缺少当前兑换币种');
        const relevant=needsPair?[config.from,config.to].filter(code=>code!==snapshot.base).map(code=>snapshot.dates[code]||snapshot.date):[snapshot.date];
        if(relevant.some(day=>Core.age(day,now)>10))throw Error('当前兑换的汇率超过 10 天');
        return {snapshot,cache:Core.mergeCache(cache,snapshot),refreshInfo:{network:true,snapshotKey:Core.snapshotKey(snapshot),providerId:provider,switched:provider!==primary,errors}};
      }catch(error){errors.push({provider,message:error.message})}
    }
    const error=new Error(errors.map(item=>catalogue[item.provider].name+'：'+item.message).join('；')+'。继续使用缓存或内置参考值。');error.providerErrors=errors;throw error;
  }
  function visibleCache(cache,config){const id=sourceId(config);return [...cache].sort((a,b)=>Number(b.sourceId===id)-Number(a.sourceId===id))}
  return {catalogue,defaults,mapping,sourceId,pathValue,parse,request,refresh,visibleCache};
});
