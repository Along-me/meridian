const assert=require('node:assert/strict'),path=require('node:path'),Fx=require('./renderer/currency-core.js');
module.exports=async({manager,storePath})=>{
  const now=Fx.today(),previousDate=new Date(now+'T00:00:00Z');previousDate.setUTCDate(previousDate.getUTCDate()-1);const yesterday=previousDate.toISOString().slice(0,10),stamp=new Date().toISOString();
  const fresh={base:'USD',date:now,rates:{USD:1,CNY:7.2,EUR:.9},dates:{USD:now,CNY:now,EUR:yesterday},fetchedAt:stamp,origin:'online',source:'Frankfurter v2'};
  const older={...fresh,date:yesterday,dates:{USD:yesterday,CNY:yesterday,EUR:yesterday},fetchedAt:yesterday+'T12:00:00Z'};
  const ipc=require('electron').ipcMain;ipc.removeHandler('meridian:currency-refresh');let network=true;
  ipc.handle('meridian:currency-refresh',()=>({cache:[fresh,older],refreshInfo:{network,snapshotKey:Fx.snapshotKey(fresh)}}));
  try{
    const result=await manager.webContents.executeJavaScript(String.raw`(async()=>{
      navigate('currency');document.getElementById('currency-refresh').click();for(let i=0;i<50&&document.getElementById('currency-refresh').disabled;i++)await new Promise(resolve=>setTimeout(resolve,20));
      document.querySelector('[data-currency-mode="auto"]').click();const info={label:document.getElementById('currency-source-badge').textContent,date:document.getElementById('currency-rate-date').textContent,count:document.getElementById('currency-cache-count').textContent};
      document.getElementById('currency-cache-panel').open=true;info.rows=document.querySelectorAll('.currency-cache-row').length;
      const oldCreate=URL.createObjectURL,oldClick=HTMLAnchorElement.prototype.click,files=[];let blob;
      URL.createObjectURL=value=>{blob=value;return oldCreate.call(URL,value)};HTMLAnchorElement.prototype.click=function(){if(this.download){files.push({name:this.download,blob});return}return oldClick.call(this)};
      try{
        document.getElementById('currency-template').click();info.modal=!document.getElementById('currency-template-dialog').classList.contains('hidden');info.fields=document.querySelectorAll('.currency-field-table tbody tr').length;
        document.getElementById('currency-template-download').click();document.getElementById('currency-field-guide').click();document.querySelector('[data-close-currency-template]').click();
        document.getElementById('currency-cache-download-all').click();document.querySelector('[data-download-currency-cache]').click();info.files=await Promise.all(files.map(async file=>({name:file.name,text:await file.blob.text()})));
      }finally{URL.createObjectURL=oldCreate;HTMLAnchorElement.prototype.click=oldClick}
      const tipButton=document.querySelector('[aria-describedby="currency-rate-details"]');tipButton.focus();tipButton.dispatchEvent(new PointerEvent('pointerover',{bubbles:true,pointerType:'mouse'}));const tip=document.querySelector('.currency-floating-tip'),r=tip.getBoundingClientRect();info.tip={visible:!tip.classList.contains('hidden'),left:r.left,right:r.right,top:r.top,bottom:r.bottom,width:innerWidth,height:innerHeight,parent:tip.parentElement===document.body,text:tip.textContent};
      info.resultColor=getComputedStyle(document.querySelector('.currency-result-number')).color;info.rateColor=getComputedStyle(document.querySelector('.currency-result-rate')).color;info.status=document.getElementById('currency-status').textContent;navigate('widgets');return info;
    })()`);
    assert.equal(result.label,'本次联网获取');assert(result.date.includes(now));assert.equal(result.count,'2');assert.equal(result.rows,2);assert.equal(result.modal,true);assert.equal(result.fields,4);assert.equal(result.files.length,4);
    const csv=result.files.find(file=>file.name.endsWith('.csv')),guide=result.files.find(file=>file.name.endsWith('.txt')),archive=result.files.find(file=>file.name.includes('last10days'));
    assert(csv.text.includes('base,quote,rate,date'));assert(guide.text.includes('rate：1 单位'));assert.equal(JSON.parse(archive.text).snapshots.length,2);assert.equal(Fx.parseImport(csv.text,{allowed:new Set(Object.keys(require('./renderer/currency-reference.js').currencies))}).length,1);
    assert.equal(result.tip.visible,true);assert.equal(result.tip.parent,true);assert(result.tip.left>=0&&result.tip.right<=result.tip.width&&result.tip.top>=0&&result.tip.bottom<=result.tip.height);assert(result.tip.text.includes('汇率日期'));assert.equal(result.resultColor,result.rateColor);assert(!result.status.includes('模板包含内置参考值'));
    network=false;
    const cached=await manager.webContents.executeJavaScript(String.raw`(async()=>{navigate('currency');document.getElementById('currency-refresh').click();for(let i=0;i<50&&document.getElementById('currency-refresh').disabled;i++)await new Promise(resolve=>setTimeout(resolve,20));const text=document.getElementById('currency-status').textContent;navigate('widgets');return text})()`);
    assert.equal(cached,'');
    const switching=await manager.webContents.executeJavaScript(String.raw`(async()=>{
      navigate('currency');
      async function pick(id,query,code){
        document.getElementById(id+'-trigger').click();const search=document.querySelector('[data-search-for="'+id+'"]');search.value=query;search.dispatchEvent(new Event('input',{bubbles:true}));await new Promise(resolve=>setTimeout(resolve,0));
        const unmatchedHighlights=document.querySelectorAll('#'+id+'-options .keyboard-active,#'+id+'-options [aria-selected="true"]').length;
        const option=document.querySelector('#'+id+'-options [data-timezone-value="'+code+'"]');
        if(!option)throw Error('Missing dropdown option '+code);
        option.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,cancelable:true,pointerType:'mouse',button:0}));option.click();await new Promise(resolve=>setTimeout(resolve,0));
        return {value:document.getElementById(id).value,label:document.getElementById(id+'-trigger').textContent,closed:document.getElementById(id+'-popup').classList.contains('hidden'),query:search.value,unmatchedHighlights};
      }
      const source=await pick('currency-from','CHF','CHF'),target=await pick('currency-to','JPY','JPY');
      const result={source,target,fromHighlights:document.querySelectorAll('#currency-quick-from .active').length,toHighlights:document.querySelectorAll('#currency-quick-to .active').length,rate:document.querySelector('.currency-result-rate').textContent,unit:document.querySelector('.currency-result-number small').textContent};
      document.getElementById('currency-to-trigger').click();const search=document.querySelector('[data-search-for="currency-to"]');search.value='EUR';search.dispatchEvent(new Event('input',{bubbles:true}));await new Promise(resolve=>setTimeout(resolve,0));
      search.dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowDown',bubbles:true,cancelable:true}));search.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true,cancelable:true}));await new Promise(resolve=>setTimeout(resolve,0));
      result.keyboard=document.getElementById('currency-to').value;result.keyboardLabel=document.getElementById('currency-to-trigger').textContent;
      await new Promise(resolve=>setTimeout(resolve,250));const saved=await meridianDesktop.currencyRead();result.persisted={from:saved.config.from,to:saved.config.to};
      result.duplicateHelp=!!document.getElementById('currency-import-tip');result.exportLabel=document.getElementById('currency-export').textContent;result.cacheLabel=document.getElementById('currency-cache-download-all').textContent;
      result.removedText=['本次联网汇率已获取并缓存。','获取于'].some(text=>document.getElementById('page-currency').textContent.includes(text));navigate('widgets');return result;
    })()`);
    assert.equal(switching.source.value,'CHF');assert(switching.source.label.includes('CHF'));assert.equal(switching.source.closed,true);assert.equal(switching.source.query,'');assert.equal(switching.source.unmatchedHighlights,0);
    assert.equal(switching.target.value,'JPY');assert(switching.target.label.includes('JPY'));assert.equal(switching.target.unmatchedHighlights,0);assert.equal(switching.fromHighlights,0);assert.equal(switching.toHighlights,0);assert.match(switching.rate,/CHF.*JPY/);assert.equal(switching.unit,'JPY');
    assert.equal(switching.keyboard,'EUR');assert(switching.keyboardLabel.includes('EUR'));assert.deepEqual(switching.persisted,{from:'CHF',to:'EUR'});assert.equal(switching.duplicateHelp,false);assert.equal(switching.removedText,false);assert.equal(switching.exportLabel,'导出当前汇率');assert.equal(switching.cacheLabel,'下载全部缓存');
    console.log('Currency source labels, field-guide downloads, recent-cache exports, uncropped tooltip and result emphasis passed.');
  }finally{
    ipc.removeHandler('meridian:currency-refresh');const service=require('./currency-service.cjs').createCurrencyService({file:path.join(path.dirname(storePath),'currency-rates.json')});
    ipc.handle('meridian:currency-refresh',event=>{if(event.sender.id!==manager.webContents.id)throw Error('Unknown window.');return service.refresh()});
  }
};
