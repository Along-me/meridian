const Shortcuts=require('../tool-shortcuts.js');
const TOOLS=Shortcuts.actions;
function normalizeKey(value){
  if(value==='')return '';
  if(typeof value!=='string'||value.length>100)throw new Error('快捷键格式无效。');
  const parts=value.split('+'),modifiers=['Control','Alt','Shift','Super'];
  if(parts.some(p=>!p)||new Set(parts).size!==parts.length||parts.slice(0,-1).some(p=>!modifiers.includes(p))||!(/^[A-Z0-9]$|^F(?:[1-9]|1\d|2[0-4])$|^(?:Space|Tab|Enter|Escape|Up|Down|Left|Right|Home|End|PageUp|PageDown|Insert|Delete)$/.test(parts.at(-1))))throw new Error('请使用有效组合键或 F1—F24 功能键。');
  if(parts.length===1&&!/^F\d+$/.test(parts[0]))throw new Error('请至少包含 Ctrl、Alt、Shift 或 Win 中的一个修饰键。');
  return parts.join('+');
}
function normalizeToolShortcuts(value){
  const result=Shortcuts.empty();
  for(const tool of Object.keys(TOOLS))result[tool]=normalizeKey(value?.[tool]??'');
  const keys=Object.values(result).filter(Boolean);if(new Set(keys).size!==keys.length)throw new Error('工具不能使用相同的快捷键。');
  return result;
}
function requestedToolShortcuts(value){
  const result=Shortcuts.empty();for(const tool of Object.keys(TOOLS)){const key=value?.[tool]??'';if(typeof key!=='string'||key.length>100)throw new Error('快捷键格式无效。');result[tool]=key}return result;
}
const storedToolShortcuts=Shortcuts.read;
function createQuickLaunch(globalShortcut,launch){
  let active=Shortcuts.empty(),errors=Shortcuts.empty();
  function applyPatch(patch,requested){
    let wanted;const added=[],owned=new Set(Object.values(active).filter(key=>key&&globalShortcut.isRegistered(key)));
    try{
      if(requested)for(const [tool,key] of Object.entries(patch))if(key&&Object.entries(requested).some(([id,value])=>id!==tool&&value===key))throw new Error('快捷键冲突：工具不能使用相同的快捷键。');
      wanted=normalizeToolShortcuts({...active,...patch});
      for(const [tool,key] of Object.entries(wanted)){
        if(!key||owned.has(key))continue;
        let ok=false;try{ok=globalShortcut.register(key,()=>{const owner=Object.keys(TOOLS).find(id=>active[id]===key);if(owner)launch(owner)})}catch(_){}
        if(!ok)throw new Error('快捷键冲突：'+TOOLS[tool]+'的快捷键已被其他软件或系统占用，请换一组按键。');
        added.push(key);
      }
    }catch(error){for(const key of added)globalShortcut.unregister(key);for(const tool of Object.keys(patch))if(tool in errors)errors[tool]=error.message;throw error}
    const keep=new Set(Object.values(wanted));for(const key of owned)if(!keep.has(key))globalShortcut.unregister(key);
    active=wanted;for(const tool of Object.keys(patch))if(tool in errors)errors[tool]='';return {...active};
  }
  return {applyPatch,restore(mapping){for(const tool of Object.keys(TOOLS)){try{applyPatch({[tool]:mapping[tool]||''},mapping)}catch(error){errors[tool]=error.message}}},status(requested=active){return {toolShortcutActive:Object.fromEntries(Object.keys(TOOLS).map(tool=>[tool,!!active[tool]&&active[tool]===requested[tool]&&globalShortcut.isRegistered(active[tool])])),toolShortcutErrors:{...errors}}},release(){for(const key of new Set(Object.values(active)))if(key)globalShortcut.unregister(key);active=Shortcuts.empty()}};
}
module.exports={createQuickLaunch,normalizeToolShortcuts,requestedToolShortcuts,storedToolShortcuts};
