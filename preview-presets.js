/* HTML-only preset editor. This script is removed by desktop/prepare.cjs. */
(() => {
  if(window.meridianDesktop)return;
  const endpoint='/api/meridian/build-presets';
  const clone=value=>JSON.parse(JSON.stringify(value));
  const section=document.createElement('section');section.className='build-presets-settings';
  section.innerHTML='<div class="section-head settings-head"><h2>打包预设</h2><span class="prototype-tag">仅 HTML</span></div><div class="panel preset-panel"><p class="preset-description">设置新安装的默认时区与自启选项；已有用户配置不受影响。此管理区不进入安装版。</p><div class="preset-toolbar"><button id="preset-use-current">使用当前挂件配置</button><button class="primary" id="preset-save">保存预设</button></div><div id="preset-zones"></div><div class="preset-add"><div class="select-wrap"><select class="field" id="preset-add-zone" aria-label="选择预制时区"></select></div><button id="preset-add">添加</button></div><p class="preset-save-status" id="preset-status" role="status">读取项目预设…</p></div>';
  document.querySelector('#page-packaging .packaging-settings').appendChild(section);
  const status=document.getElementById('preset-status'),startupStatus=document.getElementById('desktop-preferences-status');
  let preset={schemaVersion:1,state:clone(defaults),preferences:{launchAtLogin:false,startMinimized:true}},connected=false,saveChain=Promise.resolve(),pending=false;
  let recoverableDraft=null;
  const recoverButton=document.createElement('button');recoverButton.id='preset-recover';recoverButton.textContent='恢复未保存的修改';recoverButton.className='hidden';document.querySelector('.preset-toolbar').appendChild(recoverButton);
  recoverButton.onclick=()=>{if(!recoverableDraft)return;preset=clone(recoverableDraft);recoverButton.classList.add('hidden');renderZones();startup();persist()};
  const startupButtons=[['launch-at-login','launchAtLogin'],['start-minimized','startMinimized']];
  window.meridianPreviewPreferences={
    async update(patch){const tools={...window.MeridianToolShortcuts.empty(),...preset.preferences.toolShortcuts,...patch.toolShortcuts};Object.assign(preset.preferences,patch,{toolShortcuts:tools});delete preset.preferences.quickLaunchEnabled;delete preset.preferences.quickLaunchAccelerator;startup();await persist();return {...preset.preferences}},
    async updateState(patch){Object.assign(preset.state,patch);await persist()}
  };
  function message(text,error=false){status.textContent=text;status.classList.toggle('error',error)}
  function startup(){
    preset.state.widgetTheme=['light','dark'].includes(preset.state.widgetTheme)?preset.state.widgetTheme:['light','dark'].includes(preset.state.theme)?preset.state.theme:'dark';
    delete preset.state.theme;delete preset.state.frostedGlass;delete preset.state.glassBlur;
    preset.preferences.toolShortcuts=readToolShortcuts(preset.preferences);delete preset.preferences.quickLaunchEnabled;delete preset.preferences.quickLaunchAccelerator;
    for(const [id,key] of startupButtons){const button=document.getElementById(id),v=preset.preferences[key];button.classList.toggle('on',v);button.setAttribute('aria-checked',String(v));}
    startupStatus.textContent=connected?'HTML 仅配置安装版默认值，修改后自动保存，不会操作 Windows。':'当前仅浏览器暂存，需使用项目预览服务才能保存到打包配置。';
    syncAssistantPreferences(preset.preferences);
  }
  function renderZones(){
    document.getElementById('preset-zones').innerHTML=preset.state.zones.map((item,index)=>{
      const zone=catalogue.find(z=>z.id===item.id),label=zone?zoneLabel(zone,new Date()):item.id;
      return '<div class="preset-zone"><div class="preset-zone-main"><span>'+esc(label)+'</span><input class="field" data-preset-alias="'+index+'" maxlength="40" placeholder="别称（可选）" aria-label="预设时区别称" value="'+esc(item.alias||'')+'"></div><div class="preset-zone-actions"><button class="ghost icon" data-preset-up="'+index+'" aria-label="上移预设时区" '+(index===0?'disabled':'')+'>'+icon('up')+'</button><button class="ghost icon" data-preset-down="'+index+'" aria-label="下移预设时区" '+(index===preset.state.zones.length-1?'disabled':'')+'><svg style="transform:rotate(180deg)"><use href="#i-up"/></svg></button><button class="toggle '+(item.visible?'on':'')+'" data-preset-visible="'+index+'" role="switch" aria-checked="'+item.visible+'" aria-label="预设显示'+esc(zone?.city||item.id)+'"></button><button class="ghost icon" data-preset-remove="'+index+'" aria-label="移除预设时区" '+(preset.state.zones.length<=1?'disabled':'')+'>'+icon('trash')+'</button></div></div>';
    }).join('');
    const own=new Set(preset.state.zones.map(z=>z.id));
    document.getElementById('preset-add-zone').innerHTML=catalogue.filter(z=>!own.has(z.id)).map(z=>'<option value="'+esc(z.id)+'">'+esc(zoneLabel(z,new Date(),true))+'</option>').join('');
  }
  function persist(){
    pending=true;
    localStorage.setItem('meridian-build-presets-draft',JSON.stringify(preset));
    if(!connected){message('未写入项目文件：请通过 npm run preview 启动预览服务。',true);return Promise.resolve()}
    const snapshot=clone(preset);message('保存中…');
    saveChain=saveChain.catch(()=>{}).then(async()=>{
      try{
        const response=await fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(snapshot)});
        const result=await response.json();if(!response.ok)throw new Error(result.error||'保存失败');
        if(JSON.stringify(preset)===JSON.stringify(snapshot)){pending=false;recoverButton.classList.add('hidden');message('已写入 build-presets.json，下次打包采用此预设。');}
      }catch(error){message('未保存：'+error.message,true)}
    });return saveChain;
  }
  for(const [id,key] of startupButtons)document.getElementById(id).onclick=()=>{preset.preferences[key]=!preset.preferences[key];startup();persist()};
  document.getElementById('preset-save').onclick=persist;
  document.getElementById('preset-use-current').onclick=()=>{preset.state=clone(state);renderZones();persist()};
  document.getElementById('preset-add').onclick=()=>{const id=document.getElementById('preset-add-zone').value;if(!id||preset.state.zones.some(z=>z.id===id))return;preset.state.zones.push({id,visible:true,alias:''});renderZones();persist()};
  document.getElementById('preset-zones').onchange=event=>{const input=event.target.closest('[data-preset-alias]');if(input){preset.state.zones[Number(input.dataset.presetAlias)].alias=input.value.slice(0,40);persist()}};
  document.getElementById('preset-zones').onclick=event=>{
    const button=event.target.closest('button');if(!button||button.disabled)return;
    if(button.hasAttribute('data-preset-remove'))preset.state.zones.splice(Number(button.dataset.presetRemove),1);
    else if(button.hasAttribute('data-preset-visible')){const z=preset.state.zones[Number(button.dataset.presetVisible)];z.visible=!z.visible}
    else {const up=button.hasAttribute('data-preset-up'),index=Number(up?button.dataset.presetUp:button.dataset.presetDown),other=index+(up?-1:1);if(!Number.isInteger(index)||other<0||other>=preset.state.zones.length)return;[preset.state.zones[index],preset.state.zones[other]]=[preset.state.zones[other],preset.state.zones[index]];}
    renderZones();persist();
  };
  // Snapshot flushing happens before reload/close; the visible Save button can be used before building.
  window.addEventListener('pagehide',()=>{if(connected&&pending)fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(preset),keepalive:true}).catch(()=>{})});
  fetch(endpoint,{cache:'no-store'}).then(response=>{if(!response.ok)throw Error('项目预览服务未启动');return response.json()}).then(data=>{
    preset=data;connected=true;renderZones();startup();message('来自 build-presets.json，修改自动保存。');
    try{
      const draft=JSON.parse(localStorage.getItem('meridian-build-presets-draft'));
      if(draft?.schemaVersion===1&&draft.state?.zones?.length&&typeof draft.preferences?.launchAtLogin==='boolean'&&JSON.stringify(draft)!==JSON.stringify(data)){
        recoverableDraft=draft;recoverButton.classList.remove('hidden');message('发现浏览器暂存的修改，可点击“恢复未保存的修改”重新保存。');
      }
    }catch(_){}
    if(!localStorage.getItem('meridian-framework-v1')){state={...clone(defaults),...clone(data.state)};state.fontConfig=validateFontConfig(state.fontConfig);renderList();applyFontConfig();}
  }).catch(()=>{
    try{const draft=JSON.parse(localStorage.getItem('meridian-build-presets-draft'));if(draft?.state?.zones?.length)preset=draft}catch(_){}
    renderZones();startup();message('仅暂存在浏览器。请用 npm run preview 启动后保存，否则不会进入安装包。',true);
  });
  startup();
})();
