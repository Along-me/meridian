(() => {
  let openPicker=null;
  function makeTimezonePicker(select,search){
    const nativeWrap=select.closest('.select-wrap'),currency=select.id.startsWith('currency-');
    const trigger=document.createElement('button');trigger.type='button';trigger.id=select.id+'-trigger';trigger.className='field timezone-trigger';
    trigger.setAttribute('role','combobox');trigger.setAttribute('aria-haspopup','listbox');trigger.setAttribute('aria-expanded','false');
    const text=document.createElement('span');text.className='timezone-trigger-text';trigger.appendChild(text);trigger.insertAdjacentHTML('beforeend',icon('chevron'));
    nativeWrap.before(trigger);nativeWrap.classList.add('hidden');select.tabIndex=-1;select.setAttribute('aria-hidden','true');
    const label=document.querySelector('label[for="'+select.id+'"]');if(label){label.htmlFor=trigger.id;trigger.setAttribute('aria-label',label.textContent)}
    const popup=document.createElement('div');popup.className='timezone-popover hidden';popup.id=select.id+'-popup';popup.setAttribute('aria-label',currency?'选择货币':'选择时区');
    const searchRow=document.createElement('div');searchRow.className='timezone-popover-search';searchRow.appendChild(search);
    search.classList.remove('timezone-search');search.placeholder=currency?'搜索别称、国家、货币或代码':'搜索别称、国家、城市、UTC 偏移';search.setAttribute('autocomplete','off');search.setAttribute('aria-autocomplete','list');
    const list=document.createElement('div');list.className='timezone-popover-options';list.id=select.id+'-options';list.setAttribute('role','listbox');list.setAttribute('aria-label',currency?'货币选项':'时区选项');
    search.setAttribute('aria-controls',list.id);trigger.setAttribute('aria-controls',list.id);popup.append(searchRow,list);document.body.appendChild(popup);
    let active=-1,renderSignature='';
    function choices(){return Array.from(list.querySelectorAll('[data-timezone-value]'))}
    function highlight(index,scroll=true){
      const options=choices();active=options.length&&index>=0?Math.min(index,options.length-1):-1;
      for(const [i,option] of options.entries())option.classList.toggle('keyboard-active',i===active);
      if(active>=0){search.setAttribute('aria-activedescendant',options[active].id);if(scroll)options[active].scrollIntoView({block:'nearest'})}else search.removeAttribute('aria-activedescendant');
    }
    function sync(){
      text.textContent=select.selectedOptions[0]?.textContent||(currency?'选择货币':'选择时区');trigger.title=text.textContent;trigger.disabled=select.disabled;
      if(popup.classList.contains('hidden'))return;
      const signature=JSON.stringify([select.innerHTML,select.value,search.value]);if(signature===renderSignature)return;renderSignature=signature;
      list.replaceChildren();let count=0;
      function optionNode(option){
        if(option.disabled)return;
        const node=document.createElement('button');node.type='button';node.tabIndex=-1;node.className='timezone-popover-option';node.dataset.timezoneValue=option.value;node.id=select.id+'-choice-'+count++;node.setAttribute('role','option');node.setAttribute('aria-selected',String(option.value===select.value));node.textContent=option.textContent;list.appendChild(node);
      }
      for(const child of select.children){
        if(child.tagName==='OPTGROUP'){
          if(child.label==='当前选择'&&search.value.trim())continue;
          const heading=document.createElement('div');heading.className='timezone-option-group';heading.setAttribute('role','presentation');heading.textContent=child.label;list.appendChild(heading);for(const option of child.children)optionNode(option);
        }else if(child.tagName==='OPTION')optionNode(child);
      }
      if(!count){const empty=document.createElement('div');empty.className='timezone-no-results';empty.textContent=currency?'没有匹配的货币':'没有匹配的时区';list.appendChild(empty)}
      highlight(choices().findIndex(option=>option.dataset.timezoneValue===select.value),false);
    }
    function close(focus=false){
      popup.classList.add('hidden');renderSignature='';trigger.setAttribute('aria-expanded','false');search.removeAttribute('aria-activedescendant');if(openPicker===picker)openPicker=null;if(focus)trigger.focus();
    }
    function open(){
      if(openPicker&&openPicker!==picker)openPicker.close();
      openPicker=picker;popup.classList.remove('hidden');trigger.setAttribute('aria-expanded','true');
      const r=trigger.getBoundingClientRect(),width=Math.min(Math.max(r.width,300),innerWidth-24),spaceBelow=innerHeight-r.bottom-16,spaceAbove=r.top-16,above=spaceBelow<220&&spaceAbove>spaceBelow;
      const height=Math.min(360,Math.max(120,above?spaceAbove:spaceBelow));popup.style.width=width+'px';popup.style.maxHeight=height+'px';popup.style.left=Math.max(12,Math.min(r.left,innerWidth-width-12))+'px';
      if(above){popup.style.top='auto';popup.style.bottom=Math.max(12,innerHeight-r.top+5)+'px'}else{popup.style.bottom='auto';popup.style.top=Math.max(12,r.bottom+5)+'px'}
      search.value='';search.dispatchEvent(new Event('input',{bubbles:true}));sync();search.focus();
    }
    function choose(value){
      // Restore the complete option list before applying a choice from a filtered popup.
      close();search.value='';search.dispatchEvent(new Event('input',{bubbles:true}));
      select.value=value;select.dispatchEvent(new Event('change',{bubbles:true}));sync();trigger.focus();
    }
    const picker={popup,trigger,close,open,sync};
    trigger.onclick=()=>popup.classList.contains('hidden')?open():close();
    trigger.addEventListener('keydown',event=>{if(['ArrowDown','ArrowUp'].includes(event.key)){event.preventDefault();open();highlight(event.key==='ArrowDown'?0:choices().length-1)}});
    search.addEventListener('input',sync);
    search.addEventListener('keydown',event=>{
      if(event.isComposing)return;
      if(event.key==='ArrowDown'||event.key==='ArrowUp'){event.preventDefault();highlight(active<0?(event.key==='ArrowDown'?0:choices().length-1):active+(event.key==='ArrowDown'?1:-1))}
      else if(event.key==='Enter'){event.preventDefault();const selected=choices()[active];if(selected)choose(selected.dataset.timezoneValue)}
      else if(event.key==='Escape'){event.preventDefault();close(true)}
    });
    popup.addEventListener('pointerdown',event=>{if(event.button===0&&event.pointerType!=='touch'&&event.target.closest('[data-timezone-value]'))event.preventDefault()});
    popup.addEventListener('click',event=>{const option=event.target.closest('[data-timezone-value]');if(option)choose(option.dataset.timezoneValue)});
    popup.addEventListener('keydown',event=>{if(event.key==='Escape'){event.preventDefault();close(true)}});
    popup.addEventListener('focusout',()=>queueMicrotask(()=>{if(!popup.contains(document.activeElement)&&document.activeElement!==trigger)close()}));
    select.addEventListener('change',sync);new MutationObserver(sync).observe(select,{childList:true,subtree:true,attributes:true});sync();
  }
  for(const id of ['date-from','date-to','stamp-zone','comparison-zone','currency-from','currency-to']){
    const select=document.getElementById(id),search=id==='comparison-zone'?document.getElementById('comparison-search'):document.querySelector('[data-search-for="'+id+'"]');
    if(select&&search)makeTimezonePicker(select,search);
  }
  document.addEventListener('pointerdown',event=>{if(openPicker&&!openPicker.popup.contains(event.target)&&!openPicker.trigger.contains(event.target))openPicker.close()});
  document.addEventListener('scroll',event=>{if(openPicker&&!openPicker.popup.contains(event.target))openPicker.close()},true);
  window.addEventListener('resize',()=>openPicker?.close());
  function normalizeTypedShortcut(value){
    const modifiers={ctrl:'Control',control:'Control',alt:'Alt',shift:'Shift',win:'Super',windows:'Super',super:'Super',meta:'Super'},keys={space:'Space',tab:'Tab',enter:'Enter',escape:'Escape',esc:'Escape',up:'Up',down:'Down',left:'Left',right:'Right',home:'Home',end:'End',pageup:'PageUp',pagedown:'PageDown',insert:'Insert',delete:'Delete'};
    return value.trim().split('+').map(part=>{const text=part.trim();return modifiers[text.toLowerCase()]||keys[text.toLowerCase()]||text.toUpperCase()}).join('+');
  }
  for(const input of document.querySelectorAll('[data-shortcut-tool]')){
    const tool=input.dataset.shortcutTool,control=input.closest('.quick-launch-key-control');
    const method=document.createElement('button');method.type='button';method.className='ghost';method.textContent='手动';method.dataset.manualShortcut=tool;
    const commit=document.createElement('button');commit.type='button';commit.className='primary hidden';commit.textContent='保存';commit.dataset.saveShortcut=tool;
    const originalPlaceholder=input.placeholder;
    function endManual(){input.dataset.shortcutManual='false';input.readOnly=true;input.placeholder=originalPlaceholder;method.textContent='手动';commit.classList.add('hidden')}
    async function saveManual(){const key=normalizeTypedShortcut(input.value);endManual();await saveToolShortcut(tool,key)}
    method.onclick=()=>{
      if(input.dataset.shortcutManual==='true'){endManual();syncAssistantPreferences(assistantPreferences);return}
      input.dataset.shortcutManual='true';input.readOnly=false;input.placeholder='例如 Ctrl+Alt+T';method.textContent='取消';commit.classList.remove('hidden');input.focus();input.select();
    };
    commit.onclick=saveManual;
    input.addEventListener('keydown',event=>{
      if(input.dataset.shortcutManual!=='true')return;
      if(event.key==='Enter'){event.preventDefault();saveManual()}else if(event.key==='Escape'){event.preventDefault();endManual();syncAssistantPreferences(assistantPreferences)}
    });
    input.addEventListener('paste',event=>{
      if(input.dataset.shortcutManual==='true')return;
      const text=event.clipboardData?.getData('text');if(text){event.preventDefault();saveToolShortcut(tool,normalizeTypedShortcut(text))}
    });
    control.querySelector('[data-clear-shortcut]').addEventListener('click',endManual,{capture:true});
    control.insertBefore(method,control.querySelector('[data-clear-shortcut]'));control.insertBefore(commit,control.querySelector('[data-clear-shortcut]'));
  }
  const heading=Array.from(document.querySelectorAll('#page-assistant h2')).find(node=>node.textContent==='工具快捷启动');
  if(heading){const help=document.createElement('span');help.className='color-priority-help';help.innerHTML='<button type="button" class="color-priority-info" aria-label="快捷键录制说明" aria-describedby="shortcut-capture-tip">'+icon('info')+'</button><span id="shortcut-capture-tip" class="color-priority-tip" role="tooltip">系统或其他软件可能优先截获按键，导致录制收不到组合键。可点击“手动”输入，如 Ctrl+Alt+T，再保存检测冲突。</span>';heading.appendChild(help)}
})();
