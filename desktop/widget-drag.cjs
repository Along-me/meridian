function createWidgetDrag({getWindow,getCursor,getSize,onMove=()=>{},onDrop=()=>{},canDrag,schedule=setInterval,cancel=clearInterval}){
  let operation=null,timer=null;
  function end(){
    const finished=operation;
    if(timer!==null)cancel(timer);timer=null;operation=null;
    if(finished?.moved)onDrop(finished);
  }
  function step(){
    const window=getWindow();
    if(!operation||!window||window.isDestroyed()||window!==operation.window||!canDrag()){end();return}
    const point=getCursor(),dx=point.x-operation.cursor.x,dy=point.y-operation.cursor.y;
    if(!operation.moved&&Math.hypot(dx,dy)<4)return;
    operation.moved=true;
    const x=Math.round(operation.bounds.x+dx),y=Math.round(operation.bounds.y+dy),position=window.getPosition();
    if(position[0]!==x||position[1]!==y){window.setBounds({x,y,width:operation.size.width,height:operation.size.height},false);onMove()}
  }
  function begin(){
    end();const window=getWindow();if(!window||window.isDestroyed()||!canDrag())return;
    operation={window,bounds:window.getBounds(),size:getSize?getSize():window.getBounds(),cursor:getCursor(),moved:false};timer=schedule(step,16);timer?.unref?.();
  }
  return {begin,end,isDragging:()=>operation!==null};
}
module.exports={createWidgetDrag};
