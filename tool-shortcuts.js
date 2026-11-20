(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.MeridianToolShortcuts=api})(globalThis,()=>{
  // Tool order follows the sidebar. Widget visibility is an action, placed last.
  const tools={datetime:'日期时间转换',timestamp:'时间戳转换',comparison:'时间对照表',currency:'货币转换'};
  const actions={...tools,widget:'显示 / 隐藏挂件'};
  const empty=()=>Object.fromEntries(Object.keys(actions).map(id=>[id,'']));
  function read(preferences){
    const keys=preferences?.toolShortcuts;
    if(keys&&typeof keys==='object')return Object.fromEntries(Object.keys(actions).map(id=>[id,typeof keys[id]==='string'?keys[id]:'']));
    return {...empty(),datetime:preferences?.quickLaunchEnabled?preferences.quickLaunchAccelerator||'':''};
  }
  return {tools,actions,empty,read};
});
