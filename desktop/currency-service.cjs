const fs=require('node:fs'),path=require('node:path');
const Core=require('./renderer/currency-core.js'),Reference=require('./renderer/currency-reference.js');
const Providers=require('./renderer/currency-providers.js');
function createCurrencyService({file,fetchImpl=globalThis.fetch,getToday=Core.today,reference=Reference}){
  const allowed=new Set(Object.keys(reference.currencies));let queue=Promise.resolve();const inflight=new Map(),attempts=new Map();
  async function read(){try{const text=await fs.promises.readFile(file,'utf8');if(Buffer.byteLength(text)>2*1024*1024)throw Error('缓存过大');return Core.sanitizeStore(JSON.parse(text),allowed,getToday())}catch(error){if(error.code==='EACCES'||error.code==='EPERM')throw Error('无法读取本地汇率缓存。');return Core.sanitizeStore({},allowed,getToday())}}
  async function write(value){
    await fs.promises.mkdir(path.dirname(file),{recursive:true});const temporary=file+'.'+process.pid+'.tmp';
    try{await fs.promises.writeFile(temporary,JSON.stringify(value));for(let attempt=0;;attempt++){try{await fs.promises.rename(temporary,file);break}catch(error){if(attempt>=2||!['EPERM','EBUSY'].includes(error.code))throw error;await new Promise(resolve=>setTimeout(resolve,60))}}}
    finally{await fs.promises.rm(temporary,{force:true}).catch(()=>{})}
  }
  function transaction(change){const operation=queue.catch(()=>{}).then(async()=>{const value=await read();await change(value);await write(value);return value});queue=operation;return operation}
  function save(patch){
    if(!patch||typeof patch!=='object'||Buffer.byteLength(JSON.stringify(patch))>2*1024*1024)throw Error('汇率设置格式无效或文件过大。');
    return transaction(value=>{
      if(patch.imported!==undefined){if(!Array.isArray(patch.imported)||patch.imported.length>40)throw Error('最多保存 40 张导入表。');value.imported=patch.imported.map(item=>Core.normalizeSnapshot(item,{allowed,now:getToday(),origin:'imported'}))}
      if(patch.config!==undefined){if(!patch.config||typeof patch.config!=='object')throw Error('汇率设置格式无效。');value.config={...value.config,...patch.config}}
      Object.assign(value,Core.sanitizeStore(value,allowed,getToday()));
    });
  }
  async function refresh(){
    const config=(await read()).config,key=[Providers.sourceId(config),config.providerFallback,config.from,config.to].join('|');
    if(inflight.has(key))return inflight.get(key);
    const attempt=attempts.get(key);
    if(attempt&&Date.now()-attempt.time<30000){if(attempt.error)throw Error(attempt.error);return {...await read(),refreshInfo:{network:false}}}
    attempts.set(key,{time:Date.now()});
    const operation=(async()=>{
      try{
        const result=await Providers.refresh({config,allowed,now:getToday(),fetchImpl});
        const saved=await transaction(value=>{value.cache=Core.mergeCache(value.cache,result.snapshot)});
        return {...saved,refreshInfo:result.refreshInfo};
      }catch(error){attempts.set(key,{time:Date.now(),error:error.message});throw error}
    })().finally(()=>inflight.delete(key));
    inflight.set(key,operation);return operation;
  }
  return {read,save,refresh};
}
module.exports={createCurrencyService};
