const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path'),assert=require('node:assert/strict');
const events=[];let instance;
class FakeWindow{
  constructor(options){this.options=options;this.visible=false;this.webContents={setWindowOpenHandler(){},on(){},send(){}};instance=this}
  setAlwaysOnTop(){events.push('topmost')}
  setIgnoreMouseEvents(){}
  loadFile(){}
  isDestroyed(){return false}
  isVisible(){return this.visible}
  setBounds(){}
  showInactive(){this.visible=true;events.push('showInactive')}
  moveTop(){events.push('raise')}
  hide(){this.visible=false}
}
const owner={isDestroyed:()=>false,getContentBounds:()=>({x:0,y:0,width:250,height:350})};
const moduleObject={exports:{}};
vm.runInNewContext(fs.readFileSync(path.join(__dirname,'tooltip-window.cjs'),'utf8'),{module:moduleObject,__dirname,require:name=>name==='electron'?{BrowserWindow:FakeWindow,screen:{getDisplayMatching:()=>({workArea:{x:0,y:0,width:1920,height:1080}})}}:require(name)});
const tooltip=moduleObject.exports(owner);assert.equal(instance.options.parent,owner);assert.equal(instance.options.focusable,false);
events.length=0;tooltip.raise();assert.equal(events.length,0,'Hidden tooltip must not be raised');
tooltip.show({anchor:{x:10,y:10,width:200,height:80},fields:[]});tooltip.measure(120);
assert.deepEqual(events,['showInactive','topmost','raise']);
events.length=0;events.push('widget raised');tooltip.raise();assert.deepEqual(events,['widget raised','topmost','raise']);
tooltip.hide();events.length=0;tooltip.raise();assert.equal(events.length,0);assert.equal(instance.isVisible(),false);
console.log('Tooltip ownership, inactive showing, visible re-raising and hidden suppression passed.');
