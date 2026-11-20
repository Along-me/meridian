const assert=require('node:assert/strict'),{createWidgetGeometry}=require('./widget-geometry.cjs');
let bounds={x:400,y:200,width:522,height:132},calls=0;
const window={isDestroyed:()=>false,getBounds:()=>({...bounds}),setBounds(value){calls++;bounds={...value,width:value.width+2,height:value.height+1}}};
const geometry=createWidgetGeometry({getWindow:()=>window,getWorkArea:()=>({y:0})});
geometry.fit({width:522,height:132,headerHeight:42});assert.equal(bounds.y+42,242);
geometry.fit({width:522,height:90,headerHeight:0});assert.equal(bounds.y,242);assert.equal(bounds.height,91);
for(let index=0;index<30;index++){geometry.fit({width:522,height:132,headerHeight:42});assert.equal(bounds.y,200);geometry.fit({width:522,height:90,headerHeight:0});assert.equal(bounds.y,242)}
const stableCalls=calls;geometry.fit({width:522,height:90,headerHeight:0});assert.equal(calls,stableCalls);
bounds.width+=10;bounds.height+=8;geometry.fit({width:522,height:90,headerHeight:0});assert.equal(bounds.width,524);assert.equal(bounds.height,91,'Actual drift must be corrected even for an unchanged request');
bounds.x=600;bounds.y=500;geometry.moved();geometry.fit({width:522,height:132,headerHeight:42});assert.equal(bounds.y,458);assert.deepEqual(geometry.size(),{width:522,height:132});
geometry.reset();bounds.y=5;geometry.fit({width:522,height:90,headerHeight:0});geometry.fit({width:522,height:132,headerHeight:42});assert.equal(bounds.y,0,'Keep the header on-screen near the upper edge');geometry.fit({width:522,height:90,headerHeight:0});assert.equal(bounds.y,5);
console.log('Content anchoring, upward header expansion, DPI rounding, drift recovery and top-edge restoration passed.');
