const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path'),assert=require('node:assert/strict');
const events=[],messages=[];let instance;
class FakeWindow{
  constructor(options){this.options=options;this.bounds={x:0,y:0,width:options.width,height:options.height};this.visible=false;this.listeners={};this.webContents={setWindowOpenHandler(){},on:(name,fn)=>this.listeners[name]=fn,send:(_channel,data)=>messages.push(data)};instance=this}
  setAlwaysOnTop(){events.push('topmost')}
  setIgnoreMouseEvents(){}
  loadFile(){}
  isDestroyed(){return false}
  isVisible(){return this.visible}
  getBounds(){return {...this.bounds}}
  setBounds(value){this.bounds={...value};events.push('bounds')}
  showInactive(){this.visible=true;events.push('showInactive')}
  moveTop(){events.push('raise')}
  hide(){this.visible=false}
}
const owner={isDestroyed:()=>false,getContentBounds:()=>({x:0,y:0,width:250,height:350})};
const moduleObject={exports:{}};
vm.runInNewContext(fs.readFileSync(path.join(__dirname,'tooltip-window.cjs'),'utf8'),{module:moduleObject,__dirname,require:name=>name==='electron'?{BrowserWindow:FakeWindow,screen:{getDisplayMatching:()=>({workArea:{x:0,y:0,width:1920,height:1080}})}}:require(name)});
const tooltip=moduleObject.exports(owner);assert.equal(instance.options.parent,owner);assert.equal(instance.options.focusable,false);
events.length=0;tooltip.raise();assert.equal(events.length,0,'Hidden tooltip must not be raised');
instance.listeners['did-finish-load']();
const clock={anchor:{x:10,y:10,width:200,height:80},fields:[]};
tooltip.show(clock);assert.equal(instance.isVisible(),false,'Wait for content paint and measurement before showing');
const first=messages.at(-1).revision;tooltip.measure({revision:first,height:120});
assert.deepEqual(events,['bounds','showInactive','topmost','raise']);
events.length=0;tooltip.show(clock);tooltip.measure({revision:messages.at(-1).revision,height:120});assert.deepEqual(events,[],'Clock refresh must not re-show or resize an unchanged window');
events.length=0;events.push('widget raised');tooltip.raise();assert.deepEqual(events,['widget raised','topmost','raise']);
tooltip.hide();events.length=0;tooltip.raise();assert.equal(events.length,0);assert.equal(instance.isVisible(),false);
tooltip.show(clock);const obsolete=messages.at(-1).revision;tooltip.hide();tooltip.show({...clock,kind:'control'});
const current=messages.at(-1);assert.equal(current.width,220);
tooltip.measure({revision:obsolete,height:300});assert.equal(instance.isVisible(),false,'Late measurements cannot show a different hover request');
tooltip.measure({revision:current.revision,height:60});assert.equal(instance.getBounds().height,60);assert.equal(instance.getBounds().width,220);
tooltip.hide();events.length=0;tooltip.measure({revision:current.revision,height:60});assert.deepEqual(events,[],'Measurements arriving after pointer leave cannot reopen the bubble');
console.log('Tooltip paint gating, stale measurement rejection, live-update stability, shrinking, ownership and topmost passed.');
