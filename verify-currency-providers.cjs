const assert=require('node:assert/strict'),Core=require('./currency-core.js'),Providers=require('./currency-providers.js');
const allowed=new Set(['USD','CNY','EUR','JPY']),now='2026-11-20';
const frank=[{base:'USD',quote:'CNY',date:now,rate:7.2},{base:'USD',quote:'EUR',date:'2026-11-19',rate:.9}];
const exchange={result:'success',base_code:'USD',time_last_update_unix:Date.parse(now+'T00:00:00Z')/1000,rates:{USD:1,CNY:7.3,EUR:.91,ZZZ:4}};
const community={date:now,usd:{usd:1,cny:7.4,eur:.92,btc:.1}};
async function run(){
  const a=Providers.parse('frankfurter',frank,{allowed,now}),b=Providers.parse('exchange-api',exchange,{allowed,now}),c=Providers.parse('currency-api',community,{allowed,now});
  assert.equal(a.source,'Frankfurter v2');assert.equal(a.dates.EUR,'2026-11-19');assert.equal(b.rates.CNY,7.3);assert.equal(b.exportable,false);assert(b.attribution.includes('exchangerate-api'));assert.equal(c.rates.CNY,7.4);assert.equal(c.rates.BTC,undefined);
  assert.throws(()=>Providers.parse('exchange-api',{...exchange,result:'error'},{allowed,now}));assert.throws(()=>Providers.parse('exchange-api',{...exchange,time_last_update_unix:undefined},{allowed,now}));assert.throws(()=>Providers.parse('currency-api',{usd:{cny:7}},{allowed,now}));assert.throws(()=>Providers.parse('currency-api',{date:'2026-11-21',usd:{cny:7}},{allowed,now}));
  const config=Core.sanitizeStore({config:{provider:'custom',providerUrl:'https://example.test/{base}',providerBase:'USD',providerMapping:JSON.stringify({data:'data',base:'base_code',date:'observed',rates:'quotes'}),providerHeader:'X-API-Key',providerKey:'private-test-value'}},allowed,now).config;
  const custom=Providers.parse('custom',{data:{base_code:'USD',observed:now,quotes:{cny:7.5,eur:.93}}},{allowed,now,config});assert.equal(custom.rates.CNY,7.5);assert(custom.sourceId.startsWith('custom:'));assert(!JSON.stringify(custom).includes('private-test-value'));
  const req=Providers.request(config,'custom');assert(req.url.includes('/USD'));assert.equal(req.headers['X-API-Key'],'private-test-value');assert(!Providers.request(config,'frankfurter').headers['X-API-Key']);
  assert.throws(()=>Providers.request({...config,providerUrl:'file:///C:/test'},'custom'));assert.throws(()=>Providers.mapping({...config,providerMapping:'bad JSON'}));assert.throws(()=>Providers.pathValue({},'__proto__.x'));
  const rowConfig={...config,providerFormat:'custom-array',providerMapping:JSON.stringify({data:'data',base:'base',date:'time',quote:'currency',rate:'value',dateFormat:'timestamp'})};
  const rows=Providers.parse('custom',{data:[{base:'USD',currency:'CNY',value:7.6,time:exchange.time_last_update_unix},{base:'USD',currency:'EUR',value:.94,time:exchange.time_last_update_unix}]},{allowed,now,config:rowConfig});assert.equal(rows.rates.CNY,7.6);
  const merged=Core.mergeCache(Core.mergeCache([a],b),c);assert.equal(merged.length,3,'Same-day sources must not replace each other');const reloaded=Core.sanitizeStore({cache:merged,config},allowed,now);assert.equal(reloaded.cache.length,3);assert.equal(reloaded.cache.find(item=>item.providerId==='exchange-api').exportable,false);assert.equal(reloaded.config.providerKey,'private-test-value');
  const selected=Core.selectRate({from:'USD',to:'CNY',cache:reloaded.cache,fallback:a,preferredSource:'exchange-api',now});assert.equal(selected.toRate,7.3);
  const calls=[],fetchImpl=async(url,options)=>{calls.push({url,headers:options.headers});if(url.includes('example.test'))return {ok:true,json:async()=>({notRates:true})};return {ok:true,json:async()=>frank}};
  const result=await Providers.refresh({config:{...config,from:'USD',to:'CNY'},allowed,now,fetchImpl});assert.equal(result.refreshInfo.switched,true);assert.equal(result.snapshot.providerId,'frankfurter');assert.equal(calls.length,2);assert.equal(calls[1].headers['X-API-Key'],undefined);
  await assert.rejects(Providers.refresh({config:{...config,providerFallback:false},allowed,now,fetchImpl}),/自定义接口/);
  const error=await Providers.refresh({config:{provider:'frankfurter',providerFallback:false},allowed,now,fetchImpl:async()=>{throw Error('URL?secret=private-test-value')}}).catch(error=>error);assert(!error.message.includes('private-test-value'));
  const communityResult=await Providers.refresh({config:{provider:'currency-api',providerFallback:false},allowed,now,fetchImpl:async url=>{if(url.includes('jsdelivr'))throw Error('offline');return {ok:true,json:async()=>community}}});assert.equal(communityResult.snapshot.providerId,'currency-api');
  console.log('Provider formats, strict dates, custom object/array mappings, authentication isolation, independent caches and automatic failover passed.');
}
run().catch(error=>{console.error(error);process.exitCode=1});
