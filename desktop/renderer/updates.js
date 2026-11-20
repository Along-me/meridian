(() => {
  const desktop=window.meridianDesktop;if(!desktop||document.body.classList.contains('desktop-widget'))return;
  const section=document.createElement('section');section.className='app-update-settings';section.innerHTML='<div class="section-head settings-head"><h2>版本与更新</h2></div><div class="panel"><div class="setting-row"><div class="setting-label">'+icon('clock')+'<div><h3>启动时检查更新</h3><p>仅检查，下载和安装需手动确认。</p></div></div><button type="button" class="toggle" id="update-automatic" role="switch" aria-label="启动时检查更新"></button></div><div class="setting-row"><div><h3 id="update-version"></h3><p id="update-status" class="update-status" role="status"></p></div><div class="update-actions"><button type="button" id="update-check">检查更新</button><button type="button" class="primary hidden" id="update-download">下载新版</button><button type="button" class="primary hidden" id="update-install">退出并安装新版</button></div></div><details id="update-notes-wrap" class="hidden"><summary>更新说明</summary><pre id="update-notes"></pre></details></div><button type="button" class="ghost update-release-link" id="update-releases">GitHub 版本下载</button>';
  document.querySelector('#page-assistant .assistant-settings').appendChild(section);let state=null,noticeVersion='';
  function render(next){
    state=next;const automatic=document.getElementById('update-automatic');automatic.classList.toggle('on',!!next.automatic);automatic.setAttribute('aria-checked',String(!!next.automatic));automatic.disabled=!next.supported;
    document.getElementById('update-version').textContent='当前版本 '+next.currentVersion;
    const labels={idle:'可检查是否有新版本',unsupported:'请在安装版中检查更新',checking:'正在检查…',current:'已是最新版本',available:'发现新版本 '+next.availableVersion,downloading:'正在下载 '+Math.round(next.progress)+'%',downloaded:'新版已下载，安装时将退出当前应用',installing:'正在退出并启动安装程序…',error:next.error};
    const status=document.getElementById('update-status');status.textContent=labels[next.status]||'';status.classList.toggle('error',next.status==='error');
    const busy=['checking','downloading','installing'].includes(next.status);document.getElementById('update-check').disabled=!next.supported||busy||next.status==='downloaded';
    document.getElementById('update-download').classList.toggle('hidden',next.status!=='available');document.getElementById('update-install').classList.toggle('hidden',next.status!=='downloaded');
    document.getElementById('update-notes-wrap').classList.toggle('hidden',!next.notes);document.getElementById('update-notes').textContent=next.notes;
    if(next.status==='available'&&noticeVersion!==next.availableVersion){noticeVersion=next.availableVersion;toast('发现新版本 '+next.availableVersion+'，可在助手设置中下载。')}
  }
  desktop.onUpdate(render);desktop.updateStatus().then(render);
  async function action(name){try{render(await desktop[name]())}catch(_){document.getElementById('update-status').textContent='操作未完成，请稍后再试。'}}
  document.getElementById('update-check').onclick=()=>action('checkUpdates');document.getElementById('update-download').onclick=()=>action('downloadUpdate');document.getElementById('update-install').onclick=()=>action('installUpdate');
  document.getElementById('update-automatic').onclick=async()=>{if(!state)return;try{await desktop.setPreferences({autoCheckUpdates:!state.automatic});render(await desktop.updateStatus())}catch(_){toast('更新偏好未保存')}};
  document.getElementById('update-releases').onclick=()=>desktop.openReleases();
})();
