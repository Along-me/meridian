// Download public reference data and generate an offline snapshot with apply_patch.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),{spawnSync}=require('node:child_process');
const asOf=process.argv.find(value=>value.startsWith('--as-of='))?.slice(8)||new Date().toISOString().slice(0,10);
const sources={rates:'https://api.frankfurter.dev/v2/rates?base=USD',currencies:'https://api.frankfurter.dev/v2/currencies',regions:'https://raw.githubusercontent.com/unicode-org/cldr-json/main/cldr-json/cldr-core/supplemental/currencyData.json'};
async function main(){
  const entries=await Promise.all(Object.entries(sources).map(async([key,url])=>{const response=await fetch(url,{signal:AbortSignal.timeout(20000)});if(!response.ok)throw Error(key+': HTTP '+response.status);return [key,await response.json()]}));
  const raw=Object.fromEntries(entries),html=fs.readFileSync(path.join(__dirname,'prototype.html'),'utf8');
  const catalogue=vm.runInNewContext(html.slice(html.indexOf('const catalogue='),html.indexOf('// TIMEZONE_REGISTRY'))+';catalogue',{Intl});
  const codes=[...new Set(catalogue.map(zone=>zone.code))].sort(),countries={},needed=new Set();
  for(const region of codes){
    const active=(raw.regions.supplemental.currencyData.region[region]||[]).flatMap(entry=>Object.entries(entry).filter(([,value])=>value._tender!=='false'&&(!value._from||value._from<=asOf)&&(!value._to||value._to>=asOf)).map(([currency])=>currency));
    countries[region]={currencies:[...new Set(active)]};for(const currency of active)needed.add(currency);
  }
  const rates={USD:1},dates={},metadata={};
  for(const item of raw.currencies)metadata[item.iso_code]={name:item.name,type:item.type};
  for(const item of raw.rates)if(item.base==='USD'&&Number.isFinite(item.rate)&&item.rate>0&&item.date<=asOf){rates[item.quote]=item.rate;dates[item.quote]=item.date}
  const missing=[...needed].filter(code=>!rates[code]).sort();
  console.log(JSON.stringify({asOf,zones:catalogue.length,regions:codes.length,neededCurrencies:needed.size,missingRates:missing,regionsWithoutCurrency:codes.filter(code=>!countries[code].currencies.length),sampleMappings:Object.fromEntries(['CN','MX','ID','NG','HK','ZW','PS'].map(code=>[code,countries[code]])),dateRange:[Object.values(dates).sort()[0],Object.values(dates).sort().at(-1)]}));
  if(process.argv.includes('--audit'))return;
  if(missing.length)throw Error('Missing fallback rates: '+missing.join(', '));
  const reference={schemaVersion:1,generatedAt:new Date().toISOString(),asOf,countries,currencies:Object.fromEntries([...needed].sort().map(code=>[code,metadata[code]||{name:code,type:'currency'}])),fallback:{base:'USD',source:'Frankfurter v2 blended reference',sourceUrl:sources.rates,fetchedAt:new Date().toISOString(),rates:Object.fromEntries([...needed].sort().map(code=>[code,rates[code]])),dates:Object.fromEntries([...needed].sort().filter(code=>code!=='USD').map(code=>[code,dates[code]]))},attribution:{rates:'https://frankfurter.dev/',countryCurrencies:'Unicode CLDR — Unicode License v3'}};
  const lines=['const currencyReference = {'];
  for(const [key,value] of Object.entries(reference)){
    if(['countries','currencies'].includes(key)){lines.push(JSON.stringify(key)+': {');for(const [code,item] of Object.entries(value))lines.push(JSON.stringify(code)+':'+JSON.stringify(item)+',');lines.push('},')}
    else lines.push(JSON.stringify(key)+':'+JSON.stringify(value)+',');
  }
  lines.push('};',"if(typeof module==='object'&&module.exports)module.exports=currencyReference;else globalThis.MeridianCurrencyReference=currencyReference;");
  const file='currency-reference.js',patchExe=process.env.MERIDIAN_APPLY_PATCH_EXE;if(!patchExe)throw Error('Set MERIDIAN_APPLY_PATCH_EXE.');
  function patch(value){const result=spawnSync(patchExe,['--codex-run-as-apply-patch',value],{cwd:__dirname,encoding:'utf8'});if(result.status!==0)throw Error(result.stderr||result.stdout)}
  if(fs.existsSync(path.join(__dirname,file)))throw Error('Reference file exists; review before replacing it.');
  patch('*** Begin Patch\n*** Add File: '+file+'\n+// CURRENCY_REFERENCE_APPEND\n*** End Patch');
  let batch=[],length=0;
  function flush(){if(!batch.length)return;patch('*** Begin Patch\n*** Update File: '+file+'\n@@\n-// CURRENCY_REFERENCE_APPEND\n'+batch.map(line=>'+'+line).join('\n')+'\n+// CURRENCY_REFERENCE_APPEND\n*** End Patch');batch=[];length=0}
  for(const line of lines){if(length+line.length>6500)flush();batch.push(line);length+=line.length+2}flush();patch('*** Begin Patch\n*** Update File: '+file+'\n@@\n-// CURRENCY_REFERENCE_APPEND\n*** End Patch');console.log('Generated offline currency reference.');
}
main().catch(error=>{console.error(error);process.exitCode=1});
