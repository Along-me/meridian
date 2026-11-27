const http=require('node:http'),fs=require('node:fs'),path=require('node:path');
const {validatePresets}=require('./preset-schema.cjs');
const {writePresets}=require('./preset-store.cjs');
const workspace=path.dirname(__dirname),presetPath=path.join(__dirname,'build-presets.json');
const port=Number(process.env.MERIDIAN_PREVIEW_PORT)||5511;
const endpoint='/api/meridian/build-presets';
let writes=Promise.resolve();
const server=http.createServer(async(req,res)=>{
  function json(status,data){res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify(data))}
  try{
    if(!['127.0.0.1:'+port,'localhost:'+port].includes(req.headers.host)){json(403,{error:'本机访问限定'});return}
    const url=new URL(req.url,'http://127.0.0.1:'+port);
    if(url.pathname===endpoint){
      if(req.method==='GET'){json(200,validatePresets(JSON.parse(fs.readFileSync(presetPath,'utf8'))));return}
      if(req.method!=='POST'){json(405,{error:'不支持的请求'});return}
      if(!['http://127.0.0.1:'+port,'http://localhost:'+port].includes(req.headers.origin)||!req.headers['content-type']?.startsWith('application/json')){json(403,{error:'仅允许预览页面保存'});return}
      let body='';for await(const part of req){body+=part;if(Buffer.byteLength(body)>256*1024){json(413,{error:'预设过大'});return}}
      const parsed=validatePresets(JSON.parse(body));
      const operation=writes.catch(()=>{}).then(()=>writePresets(presetPath,parsed));writes=operation;
      const data=await operation;
      json(200,data);return;
    }
    if(!['GET','HEAD'].includes(req.method)){res.writeHead(405);res.end();return}
    const name=decodeURIComponent(url.pathname).replace(/^\/+/,''),file=path.resolve(workspace,name||'MeridianWidget/prototype.html');
    const relative=path.relative(workspace,file);
    if(relative.startsWith('..')||path.isAbsolute(relative)||relative.split(path.sep).some(p=>p.startsWith('.')||['node_modules','release'].includes(p))){res.writeHead(403);res.end();return}
    const stat=fs.statSync(file);if(!stat.isFile()){res.writeHead(404);res.end();return}
    const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.png':'image/png','.jpg':'image/jpeg'};
    res.writeHead(200,{'Content-Type':types[path.extname(file)]||'application/octet-stream','Cache-Control':'no-store'});
    if(req.method==='HEAD')res.end();else fs.createReadStream(file).pipe(res);
  }catch(error){
    const denied=['EPERM','EACCES'].includes(error.code);
    json(error.code==='ENOENT'?404:denied?503:400,{error:error.code==='ENOENT'?'文件不存在':denied?'预览服务没有项目文件写入权限。请重新启动预览服务后重试；浏览器中的修改已暂存。':error.message});
  }
});
server.listen(port,'127.0.0.1',()=>console.log('Meridian preview: http://127.0.0.1:'+port+'/MeridianWidget/prototype.html'));
server.on('error',error=>{console.error(error.message);process.exitCode=1});
