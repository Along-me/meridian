const assert=require('node:assert/strict'),path=require('node:path');
module.exports=async({manager,storePath})=>{
  const {ipcMain}=require('electron'),Core=require('./renderer/currency-core.js'),{createCurrencyService}=require('./currency-service.cjs');
  const calls=[],date=Core.today(),file=path.join(path.dirname(storePath),'currency-rates.json');
  const service=createCurrencyService({file,fetchImpl:async(url,options)=>{
    calls.push({url,headers:options.headers});
    const rates={USD:1,CNY:7.2,EUR:.9,JPY:150};
    if(url.includes('custom.invalid'))return {ok:true,json:async()=>({wrong:true})};
    if(url.includes('custom.example'))return {ok:true,json:async()=>({payload:{base:'USD',date,rates}})};
    if(url.includes('open.er-api'))return {ok:true,json:async()=>({result:'success',base_code:'USD',time_last_update_unix:Date.parse(date+'T00:00:00Z')/1000,rates})};
    if(url.includes('jsdelivr'))return {ok:true,json:async()=>({date,usd:{usd:1,cny:7.3,eur:.92,jpy:151}})};
    return {ok:true,json:async()=>Object.entries(rates).filter(([quote])=>quote!=='USD').map(([quote,rate])=>({base:'USD',quote,rate,date}))};
  }});
  ipcMain.removeHandler('meridian:currency-refresh');ipcMain.handle('meridian:currency-refresh',()=>service.refresh());
  try{
    const result=await manager.webContents.executeJavaScript(String.raw`(async()=>{
      await meridianCurrencyReady;navigate('currency');
      const provider=document.getElementById('currency-provider'),url=document.getElementById('currency-provider-url'),format=document.getElementById('currency-provider-format'),mapping=document.getElementById('currency-provider-mapping'),key=document.getElementById('currency-provider-key'),header=document.getElementById('currency-provider-header'),fallback=document.getElementById('currency-provider-fallback');
      const original=(await meridianDesktop.currencyRead()).config;
      function field(input,value){input.value=value;input.dispatchEvent(new Event(input.tagName==='SELECT'?'change':'input',{bubbles:true}))}
      async function fetchRates(){const button=document.getElementById('currency-refresh');button.click();for(let i=0;i<150&&button.disabled;i++)await new Promise(resolve=>setTimeout(resolve,20));return document.getElementById('currency-status').textContent}
      const from=document.getElementById('currency-from'),to=document.getElementById('currency-to');field(from,'USD');field(to,'CNY');document.querySelector('[data-currency-mode="auto"]').click();
      const result={visible:!!document.querySelector('#currency-provider-panel h2'),defaultHidden:document.getElementById('currency-provider-panel').classList.contains('hidden'),modes:provider.options.length};
      document.getElementById('currency-provider-toggle').click();result.opened=!document.getElementById('currency-provider-panel').classList.contains('hidden');
      field(provider,'exchange-api');await fetchRates();result.exchange=document.querySelector('.currency-meta').textContent;result.attribution=!!document.querySelector('.currency-meta a');result.exportDisabled=document.getElementById('currency-export').disabled;
      field(provider,'currency-api');await fetchRates();result.community=document.querySelector('.currency-meta').textContent;
      field(provider,'custom');result.customVisible=!url.closest('.currency-custom-field').classList.contains('hidden');field(url,'https://custom.example/rates?base={base}');field(mapping,'{"data":"payload"}');field(header,'X-API-Key');field(key,'ui-private-key');
      await fetchRates();result.custom=document.querySelector('.currency-meta').textContent;const stored=await meridianDesktop.currencyRead();result.persisted={provider:stored.config.provider,url:stored.config.providerUrl,mapping:stored.config.providerMapping,key:stored.config.providerKey};result.masked=key.type==='password';result.sources=[...new Set(stored.cache.map(item=>item.providerId))];
      field(url,'https://custom.invalid/rates');const failover=await fetchRates();result.failover=failover;result.actual=document.querySelector('.currency-meta').textContent;
      fallback.checked=false;fallback.dispatchEvent(new Event('change',{bubbles:true}));const failed=await fetchRates();result.failed=failed;result.keptValue=!!document.getElementById('currency-result').dataset.value;
      field(provider,'frankfurter');field(from,'USD');field(to,'EUR');const amount=document.getElementById('currency-amount');field(amount,'0.00021');
      const precision=MeridianCurrencyCore.convertDynamic('1',{fromRate:1e30,toRate:1});result.precision=precision;
      const help=document.getElementById('page-help');result.helpLengths=Array.from(help.querySelectorAll('.help-card')).map(card=>card.textContent.length);
      await meridianDesktop.currencySave({config:original});navigate('widgets');return result;
    })()`);
    assert.equal(result.visible,true);assert.equal(result.defaultHidden,true);assert.equal(result.opened,true);assert.equal(result.modes,4);assert(result.exchange.includes('ExchangeRate-API'));assert.equal(result.attribution,true);assert.equal(result.exportDisabled,true);assert(result.community.includes('Currency API'));assert.equal(result.customVisible,true);assert(result.custom.includes('自定义接口'));assert.equal(result.persisted.provider,'custom');assert.equal(result.persisted.key,'ui-private-key');assert.equal(result.masked,true);assert(result.sources.includes('exchange-api')&&result.sources.includes('currency-api')&&result.sources.includes('custom'));assert(result.failover.includes('已使用 Frankfurter'));assert(result.failed.includes('缓存或内置'));assert.equal(result.keptValue,true);assert(result.precision.endsWith('10'));assert(result.helpLengths.every(length=>length<=110));
    assert(calls.some(call=>call.url.includes('custom.example')&&call.url.includes('USD')&&call.headers['X-API-Key']==='ui-private-key'));
    assert(calls.filter(call=>!call.url.includes('custom.')).every(call=>!call.headers['X-API-Key']));
    console.log('Visible source settings, desktop provider switching, custom field mapping, private authentication, failover and concise help passed.');
  }finally{
    ipcMain.removeHandler('meridian:currency-refresh');const real=createCurrencyService({file});ipcMain.handle('meridian:currency-refresh',event=>{if(event.sender.id!==manager.webContents.id)throw Error('Unknown window.');return real.refresh()});
  }
};
