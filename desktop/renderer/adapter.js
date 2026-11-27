(() => {
  const desktop=window.meridianDesktop;
  if(!desktop)return;
  const widgetMode=new URLSearchParams(location.search).get('window')==='widget';
  let receiving=false,preferences=desktop.initial.preferences,fitFrame;
  const originalSave=save;
  save=()=>{originalSave();if(!receiving)desktop.saveState(state)};
  document.title=widgetMode?'Meridian 桌面挂件':'Meridian · 时区助手';
  document.body.classList.add(widgetMode?'desktop-widget':'desktop-manager');
  document.querySelector('.prototype-tag').textContent='v'+desktop.initial.version;
  document.querySelectorAll('.help-card').forEach(card=>{
    const title=card.querySelector('h2');
    if(title?.textContent==='HTML 预览'){
      title.textContent='桌面运行';
      card.querySelector('p').textContent='关闭管理窗口后挂件继续运行。单击托盘召回挂件，双击打开管理界面，右键退出。';
    }
  });
  const sourceRender=renderWidget;
  let root;
  function fitWidgetNow(){
    if(!widgetMode)return;cancelAnimationFrame(fitFrame);
    const preferred=preferredWidgetSize();let height=preferred.height;
    if(preferred.auto){
      const node=document.getElementById('widget'),content=node.querySelector('.widget-content'),previousStyle=node.getAttribute('style'),previousFlex=content.style.flex;
      try{
        node.style.setProperty('width',preferred.width+'px','important');node.style.setProperty('height','auto','important');node.style.setProperty('bottom','auto','important');content.style.flex='0 0 auto';
        height=Math.ceil(widgetHeaderFullHeight(node)+content.scrollHeight+2);
      }finally{if(previousStyle===null)node.removeAttribute('style');else node.setAttribute('style',previousStyle);content.style.flex=previousFlex}
    }
    const node=document.getElementById('widget'),fullHeaderHeight=widgetHeaderFullHeight(node),headerHeight=state.autoHideHeader?0:fullHeaderHeight;
    desktop.fitWidget({width:preferred.width,height:Math.max(minimumWidgetHeight(),height-(state.autoHideHeader?fullHeaderHeight:0)),headerHeight});
  }
  function requestFit(){if(!widgetMode)return;cancelAnimationFrame(fitFrame);fitFrame=requestAnimationFrame(fitWidgetNow)}
  if(widgetMode){
    root=document.createElement('div');root.className='desktop-widget-root';
    document.body.appendChild(root);root.appendChild(document.getElementById('widget'));
    applyWidgetSizes=()=>{};
    renderWidget=()=>{
      sourceRender();
      root.classList.toggle('widget-light',effectiveWidgetTheme()==='light');
      root.classList.toggle('widget-locked',state.locked);
      fitWidgetNow();
    };
    const draggable=document.getElementById('widget');let dragPointer=null;
    function finishDrag(){
      if(dragPointer===null)return;const pointer=dragPointer;dragPointer=null;desktop.endDrag();draggable.classList.remove('widget-dragging');
      if(draggable.hasPointerCapture(pointer))draggable.releasePointerCapture(pointer);updateWidgetHeader(draggable);
    }
    draggable.addEventListener('pointerdown',event=>{
      if(event.button!==0||state.locked||dragPointer!==null||event.target.closest('button,a,input,select,textarea,[contenteditable]'))return;
      event.preventDefault();hideWidgetTooltip();dragPointer=event.pointerId;draggable.classList.add('widget-dragging');
      draggable.setPointerCapture(event.pointerId);desktop.beginDrag();
    });
    for(const event of ['pointerup','pointercancel','lostpointercapture'])draggable.addEventListener(event,finishDrag);
    window.addEventListener('blur',finishDrag);desktop.onState(next=>{if(next.locked||!next.enabled)finishDrag()});
    const header=document.querySelector('#widget .widget-top');
    const actions=header.querySelector('.widget-header-actions');actions.classList.add('desktop-widget-actions');
    const manage=document.createElement('button');manage.className='ghost';manage.type='button';manage.setAttribute('aria-label','打开管理界面');manage.title='打开管理界面';manage.innerHTML=icon('settings');manage.onclick=()=>desktop.openManager();
    actions.append(manage,document.getElementById('preview-header-hide'),document.getElementById('preview-edge-hide'),document.getElementById('preview-pin'));header.appendChild(actions);setupWidgetHeaderHints(header);
    header.addEventListener('dblclick',event=>{if(!event.target.closest('button'))desktop.openManager()});
    const refreshHoverPosition=()=>requestAnimationFrame(()=>{tooltipSignature='';refreshWidgetTooltip(new Date());refreshWidgetControlTooltip()});
    desktop.onResized(refreshHoverPosition);desktop.onMoved(refreshHoverPosition);
    const originalHideTooltip=hideWidgetTooltip,originalRefreshTooltip=refreshWidgetTooltip;
    hideWidgetTooltip=()=>{originalHideTooltip();desktop.hideTooltip()};
    const originalHideControl=hideWidgetControlTooltip,originalRefreshControl=refreshWidgetControlTooltip;
    hideWidgetControlTooltip=()=>{originalHideControl();desktop.hideTooltip()};
    refreshWidgetControlTooltip=()=>{
      originalRefreshControl();if(!headerControlAnchor||headerControlTooltipBox.classList.contains('hidden'))return;
      const r=headerControlAnchor.getBoundingClientRect();
      desktop.showTooltip({kind:'control',light:effectiveWidgetTheme()==='light',anchor:{x:r.x,y:r.y,width:r.width,height:r.height},fields:[{className:'tip-control',strong:false,fontSize:11,segments:[{text:headerControlTooltipBox.textContent,period:false,fontSize:11}]}]});
    };
    let tooltipSignature='';
    refreshWidgetTooltip=now=>{
      originalRefreshTooltip(now);
      if(!widgetTooltipAnchor||widgetTooltipBox.classList.contains('hidden'))return;
      const r=widgetTooltipAnchor.getBoundingClientRect(),anchor={x:r.x,y:r.y,width:r.width,height:r.height};
      const fields=Array.from(widgetTooltipBox.children).map(field=>({className:field.className,strong:field.tagName==='STRONG',fontSize:parseFloat(getComputedStyle(field).fontSize),segments:Array.from(field.childNodes).map(node=>({text:node.textContent,period:node.nodeType===1&&node.classList.contains('tip-period'),fontSize:node.nodeType===1?parseFloat(getComputedStyle(node).fontSize):0}))}));
      const data={light:effectiveWidgetTheme()==='light',anchor,fields},signature=JSON.stringify(data);
      if(signature!==tooltipSignature){tooltipSignature=signature;desktop.showTooltip(data)}
    };
    const resetTooltipSignature=()=>tooltipSignature='';
    document.addEventListener('pointerover',resetTooltipSignature);document.addEventListener('focusin',resetTooltipSignature);
    // Typography updates are coalesced into the same sizing request as state updates.
    const fontStyle=document.getElementById('widget-font-overrides');
    new MutationObserver(requestFit).observe(fontStyle,{childList:true,characterData:true,subtree:true});
  }else{
    desktop.onOpenTool(tool=>{if(Object.hasOwn(window.MeridianToolShortcuts.tools,tool))navigate(tool)});
    document.querySelector('[data-page="packaging"]')?.remove();document.getElementById('page-packaging')?.remove();delete names.packaging;
    const originalApplyTheme=applyAppTheme;
    applyAppTheme=()=>{originalApplyTheme();desktop.setTitleBarTheme(effectiveAppTheme())};
    desktop.setTitleBarTheme(effectiveAppTheme());
    function displayPreferences(next){
      preferences=next;
      syncAssistantPreferences(next);
      const startup=document.getElementById('launch-at-login'),minimized=document.getElementById('start-minimized');
      startup.classList.toggle('on',!!next.launchAtLogin);startup.setAttribute('aria-checked',String(!!next.launchAtLogin));startup.disabled=!next.available;
      minimized.classList.toggle('on',!!next.startMinimized);minimized.setAttribute('aria-checked',String(!!next.startMinimized));
      const status=document.getElementById('desktop-preferences-status');status.classList.toggle('error',!!next.startupBlocked);status.textContent=next.startupBlocked?'Meridian 的启动项已被 Windows 禁用，可重新开启开机启动。':'';
    }
    async function setPreference(button,patch){
      button.disabled=true;
      try{displayPreferences(await desktop.setPreferences(patch))}catch(error){const status=document.getElementById('desktop-preferences-status');status.textContent=error.message.replace(/^Error invoking remote method '[^']+': Error: /,'');status.classList.add('error')}finally{button.disabled=button.id==='launch-at-login'&&!preferences.available}
    }
    document.getElementById('launch-at-login').onclick=event=>setPreference(event.currentTarget,{launchAtLogin:!preferences.launchAtLogin});
    document.getElementById('start-minimized').onclick=event=>setPreference(event.currentTarget,{startMinimized:!preferences.startMinimized});
    desktop.onPreferences(displayPreferences);displayPreferences(preferences);
  }
  desktop.onState(next=>{
    if(!next||JSON.stringify(next)===JSON.stringify(state))return;
    receiving=true;
    try{
      state={...defaults,...next};delete state.theme;
      document.documentElement.dataset.appTheme=state.appTheme;
      try{state.fontConfig=validateFontConfig(state.fontConfig)}catch(_){state.fontConfig={...defaultFontConfig}}
      localStorage.setItem('meridian-framework-v1',JSON.stringify(state));
      renderList();applyFontConfig();syncControls();
      if(document.activeElement!==fontEditor)fontEditor.value=JSON.stringify(state.fontConfig,null,2);
    }finally{receiving=false}
  });
  // Rebind after the native widget has been moved outside the manager preview.
  renderWidget();applyFontConfig();
  desktop.ready(state);
})();
