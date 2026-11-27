const assert=require('node:assert/strict');
const {snapToEdges,hiddenBounds,cursorNearEdge,createEdgeHover}=require('./widget-edge.cjs');
const area={x:0,y:0,width:1920,height:1080};
const bounds={x:12,y:200,width:240,height:330};
const snapped=snapToEdges(bounds,area);
assert.deepEqual(snapped.edges,['left']);
assert.equal(snapped.bounds.x,0);
assert.equal(snapped.edge,'left');
assert.equal(snapToEdges({x:30,y:200,width:240,height:330},area).edge,'left');
assert.equal(snapToEdges({x:500,y:400,width:240,height:330},area).edge,null);
assert.equal(hiddenBounds({x:0,y:200,width:240,height:330},area,'left').x,-234);
assert.equal(hiddenBounds({x:1680,y:200,width:240,height:330},area,'right').x,1914);
assert.equal(cursorNearEdge({x:2,y:300},area,'left'),true);
assert.equal(cursorNearEdge({x:400,y:300},area,'left'),false);
assert.equal(cursorNearEdge({x:2,y:800},area,'left',6,10,{x:0,y:200,width:240,height:330}),false,'Only the widget edge segment recalls it');
let clock=0,point={x:100,y:250},visible=true,dragging=false,polls=0,cancels=0,hideCount=0,revealCount=0;
const dock={edge:'left',hidden:false,visibleBounds:{x:0,y:200,width:240,height:330}};
const window={isDestroyed:()=>false,isVisible:()=>visible,getBounds:()=>({...dock.visibleBounds})};
const hover=createEdgeHover({getWindow:()=>window,getCursor:()=>point,getDock:()=>dock,getArea:()=>area,isDragging:()=>dragging,now:()=>clock,
  schedule:()=>{polls++;return 1},cancel:()=>cancels++,hide:()=>{hideCount++;dock.hidden=true},reveal:()=>{revealCount++;dock.hidden=false}});
function advance(ms){clock+=ms;hover.tick()}
hover.start();hover.start();assert.equal(polls,1);
advance(1000);assert.equal(hideCount,0,'Do not hide while hovered');
for(let i=0;i<3;i++){
  point={x:800,y:700};advance(0);advance(600);assert.equal(dock.hidden,false);advance(100);assert.equal(dock.hidden,true);
  point={x:2,y:800};advance(100);assert.equal(dock.hidden,true);
  point={x:2,y:250};advance(100);assert.equal(dock.hidden,false);advance(1000);assert.equal(dock.hidden,false);
}
assert.equal(hideCount,3);assert.equal(revealCount,3,'Polling must continue after every reveal');
point={x:800,y:700};dragging=true;advance(2000);assert.equal(hideCount,3);
dragging=false;visible=false;advance(2000);assert.equal(hideCount,3,'Respect OS-hidden windows');
visible=true;advance(0);advance(300);point={x:100,y:250};advance(0);point={x:800,y:700};advance(0);advance(400);assert.equal(hideCount,3,'Re-entry cancels the previous leave delay');
hover.stop();assert.equal(cancels,1);
visible=false;dock.hidden=true;point={x:2,y:250};hover.tick();assert.equal(dock.hidden,false,'macOS can recall an intentionally hidden native window');visible=true;
const secondArea={x:-1920,y:-200,width:1920,height:1080};
assert.equal(snapToEdges({x:-1910,y:100,width:240,height:330},secondArea).bounds.x,-1920);
assert.equal(hiddenBounds({x:-1920,y:100,width:240,height:330},secondArea,'left').x,-2154);
console.log('Edge snapping, repeated hover/leave cycles, scoped recall, drag and system visibility suppression, negative display coordinates passed.');
