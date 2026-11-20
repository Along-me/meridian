const fs=require('node:fs');
const path=require('node:path');
const source=fs.readFileSync(path.join(__dirname,'..','prototype.html'),'utf8');
const {validatePresets}=require('../preset-schema.cjs');
const presetSource=process.env.MERIDIAN_FACTORY_PRESETS_FILE||path.join(__dirname,'..','build-presets.json');
const factory=validatePresets(JSON.parse(fs.readFileSync(presetSource,'utf8')));
if(!source.includes('function renderWidget()'))throw new Error('Prototype renderer was not found.');
const html=source
  .replace(/<p\b[^>]*data-preview-only[^>]*>[\s\S]*?<\/p>/g,'')
  .replace(/<span\b[^>]*data-preview-only[^>]*>[\s\S]*?<\/span>/g,'')
  .replace('HTML 中仅配置打包默认值，不修改系统自启。','')
  .replace('<script src="./preview-presets.js"></script>','')
  .replace('./comparison-tools.css','./renderer/comparison-tools.css')
  .replace('./comparison-tools.js','./renderer/comparison-tools.js')
  .replace('./currency-tools.css','./renderer/currency-tools.css')
  .replace('./currency-reference.js','./renderer/currency-reference.js')
  .replace('./currency-core.js','./renderer/currency-core.js')
  .replace('./currency-tools.js','./renderer/currency-tools.js')
  .replace('./currency-providers.js','./renderer/currency-providers.js')
  .replace('./currency-source-settings.js','./renderer/currency-source-settings.js')
  .replace('./tool-controls.css','./renderer/tool-controls.css')
  .replace('./tool-controls.js','./renderer/tool-controls.js')
  .replace('./tool-shortcuts.js','./renderer/tool-shortcuts.js')
  .replace('const save=()=>','let save=()=>')
  .replace('<script>','<script src="./renderer/bootstrap.js"></script>\n<script>')
  .replace('</head>','<link rel="stylesheet" href="./renderer/desktop.css">\n</head>')
  .replace('</body>','<script src="./renderer/adapter.js"></script>\n<script src="./renderer/updates.js"></script>\n</body>');
fs.writeFileSync(path.join(__dirname,'app.html'),html);
for(const name of ['tool-shortcuts.js','comparison-tools.js','comparison-tools.css','currency-reference.js','currency-core.js','currency-providers.js','currency-source-settings.js','currency-tools.js','currency-tools.css','tool-controls.js','tool-controls.css'])fs.copyFileSync(path.join(__dirname,'..',name),path.join(__dirname,'renderer',name));
fs.writeFileSync(path.join(__dirname,'factory-defaults.json'),JSON.stringify(factory,null,2)+'\n');
console.log('Prepared desktop/app.html from the existing prototype.');
