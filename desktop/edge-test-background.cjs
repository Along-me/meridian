// Manual Windows regression aid: a neutral foreground window behind the real
// widget. Use with electron desktop/edge-test-background.cjs, then move the
// pointer between its center and the widget edge without activating the widget.
const {app,BrowserWindow,screen}=require('electron');
app.setName('Meridian Edge Test');
app.whenReady().then(()=>{
  const area=screen.getPrimaryDisplay().workArea;
  const window=new BrowserWindow({...area,frame:false,title:'Meridian edge test background',backgroundColor:'#e8edf3',webPreferences:{nodeIntegration:false,contextIsolation:true,sandbox:true}});
  window.loadURL('data:text/html;charset=utf-8,'+encodeURIComponent('<!doctype html><title>Meridian edge test background</title><body style="margin:0;background:#e8edf3;font:24px Segoe UI;color:#24303c;display:grid;place-items:center;height:100vh"><div>Meridian edge test background<br><small>Move to the top edge to reveal the clock. Move back here to hide it.<br>Alt+F4 closes this test window.</small></div>'));
});
app.on('window-all-closed',()=>app.quit());
