function createWidgetGeometry({getWindow,getWorkArea}){
  let requested=null,actualSize=null,contentY=null;
  function reset(){requested=null;actualSize=null;contentY=null}
  function fit(value){
    const window=getWindow();if(!window||window.isDestroyed()||!value||![value.width,value.height].every(Number.isFinite))return;
    const width=Math.max(110,Math.round(value.width)),height=Math.max(1,Math.round(value.height));
    if(![width,height].every(n=>Number.isSafeInteger(n)&&n<=2147483647))return;
    const headerHeight=Math.max(0,Math.round(Number(value.headerHeight)||0)),bounds=window.getBounds();
    if(contentY===null)contentY=bounds.y+headerHeight;
    const next={width,height,headerHeight},area=getWorkArea(bounds),y=Math.round(Math.max(area.y,contentY-headerHeight));
    const sameRequest=requested&&Object.keys(next).every(key=>requested[key]===next[key]);
    // Native DPI rounding is stable after a resize; do not feed it back into the requested size.
    if(sameRequest&&actualSize&&bounds.width===actualSize.width&&bounds.height===actualSize.height&&Math.abs(bounds.y-y)<=2)return;
    requested=next;window.setBounds({x:bounds.x,y,width,height},false);
    const applied=window.getBounds();actualSize={width:applied.width,height:applied.height};
  }
  function moved(){const window=getWindow();if(!requested||!window||window.isDestroyed())return;const bounds=window.getBounds();contentY=bounds.y+requested.headerHeight;actualSize={width:bounds.width,height:bounds.height}}
  function size(){const window=getWindow();return requested?{width:requested.width,height:requested.height}:window?.getBounds()}
  return {fit,moved,size,reset};
}
module.exports={createWidgetGeometry};
