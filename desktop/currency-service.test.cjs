const assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {createCurrencyService}=require('./currency-service.cjs');
async function run(){
  const directory=fs.mkdtempSync(path.join(os.tmpdir(),'meridian-currency-test-')),file=path.join(directory,'currency.json');
  const reference={currencies:{USD:{},CNY:{},EUR:{}}};let requests=0;
  const options={file,reference,getToday:()=> '2026-11-19',fetchImpl:async(url,request)=>{
    requests++;await new Promise(resolve=>setTimeout(resolve,15));
    if(url.includes('open.er-api'))return {ok:true,json:async()=>({result:'success',base_code:'USD',time_last_update_unix:1795046400,rates:{CNY:7.3,EUR:.91}})};
    if(url.includes('jsdelivr'))return {ok:true,json:async()=>({date:'2026-11-19',usd:{cny:7.4,eur:.92}})};
    if(url.includes('example.test')){assert.equal(request.headers['X-API-Key'],'test-secret');return {ok:true,json:async()=>({data:{base:'USD',date:'2026-11-19',rates:{CNY:7.5,EUR:.93}}})}}
    return {ok:true,json:async()=>[{base:'USD',quote:'CNY',rate:7.2,date:'2026-11-19'},{base:'USD',quote:'EUR',rate:.9,date:'2026-11-18'}]};
  }};
  try{
    const service=createCurrencyService(options);assert.equal((await service.read()).cache.length,0);
    await service.save({imported:[{base:'USD',date:'2026-10-01',rates:{USD:1,CNY:8}}],config:{from:'CNY',to:'USD',amount:'10',mode:'imported'}});
    const results=await Promise.all([service.refresh(),service.refresh(),service.save({config:{amount:'20'}})]);
    assert.equal(results[0].refreshInfo.network,true);assert.equal(results[1].refreshInfo.network,true);assert.equal(requests,1);
    assert.equal((await service.refresh()).refreshInfo.network,false);assert.equal(requests,1);
    let saved=await service.read();assert.equal(saved.config.amount,'20');assert.equal(saved.imported[0].rates.CNY,8);assert.equal(Object.hasOwn(saved,'refreshInfo'),false);
    await service.save({config:{provider:'exchange-api'}});const exchange=await service.refresh();assert.equal(exchange.refreshInfo.providerId,'exchange-api');assert(exchange.cache.some(item=>item.providerId==='frankfurter'));assert.equal(exchange.cache.find(item=>item.providerId==='exchange-api').rates.CNY,7.3);
    await service.save({config:{provider:'currency-api'}});const community=await service.refresh();assert.equal(community.refreshInfo.providerId,'currency-api');assert.equal(community.cache.length,3);
    await service.save({config:{provider:'custom',providerUrl:'https://example.test',providerMapping:'{"data":"data"}',providerHeader:'X-API-Key',providerKey:'test-secret'}});
    const custom=await service.refresh();assert.equal(custom.refreshInfo.providerId,'custom');assert.equal(custom.cache.length,4);assert.equal(custom.imported[0].rates.CNY,8);
    saved=await service.read();assert.deepEqual(await createCurrencyService(options).read(),saved);
    await assert.rejects(service.save({imported:[{base:'USD',date:'2026-11-19',rates:{CNY:-1}}]}));assert.equal((await service.read()).imported[0].rates.CNY,8);
    const offline=createCurrencyService({...options,fetchImpl:async()=>{throw Error('offline')}});await assert.rejects(offline.refresh(),/缓存或内置/);assert.equal((await offline.read()).cache.length,4);
    console.log('Currency persistence, concurrent refresh, per-source throttling, source switching, custom authentication and offline preservation passed.');
  }finally{fs.rmSync(directory,{recursive:true,force:true})}
}
run().catch(error=>{console.error(error);process.exitCode=1});
