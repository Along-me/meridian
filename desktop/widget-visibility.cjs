function createWidgetVisibility({getWindow,locate=()=>{}}){
  function isShowing(){const window=getWindow();return !!window&&!window.isDestroyed()&&window.isVisible()&&!window.isMinimized()}
  function show({focus=true}={}){
    const window=getWindow();if(!window||window.isDestroyed())return false;
    if(window.isMinimized())window.restore();locate(window);
    // Explicit recall must also re-show windows hidden by the shell while still marked enabled.
    if(focus){window.show();window.focus();window.moveTop()}else window.showInactive();
    return true;
  }
  return {show,isShowing};
}
module.exports={createWidgetVisibility};
