const fs=require('node:fs/promises'),path=require('node:path'),{randomUUID}=require('node:crypto');
const {validatePresets}=require('./preset-schema.cjs');
async function writePresets(destination,value){
  const data=validatePresets(value);
  const temporary=path.join(path.dirname(destination),'.meridian-preset-'+randomUUID()+'.tmp');
  try{
    await fs.writeFile(temporary,JSON.stringify(data,null,2)+'\n',{flag:'wx'});
    for(let attempt=0;;attempt++){
      try{await fs.rename(temporary,destination);break}catch(error){
        if(!['EPERM','EACCES','EBUSY'].includes(error.code)||attempt>=3)throw error;
        await new Promise(resolve=>setTimeout(resolve,50*(attempt+1)));
      }
    }
    return data;
  }finally{await fs.unlink(temporary).catch(()=>{})}
}
module.exports={writePresets};
