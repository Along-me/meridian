const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path'),assert=require('node:assert/strict');
const html=fs.readFileSync(path.join(__dirname,'..','prototype.html'),'utf8');
const source=html.slice(html.indexOf('const widgetHeaderHover='),html.indexOf('function applyWidgetBackground'));
let time=0,sequence=0,hintsHidden=0;const timers=new Map(),classes=new Set(['auto-hide-header']);
const widget={matches:()=>false,querySelector:()=>null,classList:{contains:name=>classes.has(name),toggle(name,value){if(value)classes.add(name);else classes.delete(name)}}};
const state={autoHideHeader:true};
const context={state,document:{hasFocus:()=>false},hideWidgetControlTooltip:()=>hintsHidden++,setTimeout(fn,delay){const id=++sequence;timers.set(id,{fn,at:time+delay});return id},clearTimeout:id=>timers.delete(id)};
vm.runInNewContext(source+';this.update=updateWidgetHeader;',context);
function advance(ms){time+=ms;for(const [id,timer] of [...timers])if(timer.at<=time){timers.delete(id);timer.fn()}}
context.update(widget,true);advance(599);assert.equal(classes.has('header-revealed'),false);advance(1);assert.equal(classes.has('header-revealed'),true);
context.update(widget,false);advance(599);assert.equal(classes.has('header-revealed'),true);advance(1);assert.equal(classes.has('header-revealed'),false);assert.equal(hintsHidden,1);
context.update(widget,true);advance(300);context.update(widget,false);advance(1000);assert.equal(classes.has('header-revealed'),false,'Leaving before 0.6 seconds must cancel reveal');
context.update(widget,true);advance(600);context.update(widget,false);advance(200);context.update(widget,true);advance(600);assert.equal(classes.has('header-revealed'),true,'Returning before 0.6 seconds must cancel hiding');
state.autoHideHeader=false;context.update(widget,false);assert.equal(classes.has('header-revealed'),false);assert.equal(timers.size,0);
console.log('Overlay menu 0.6s reveal, 0.6s hide, cancelled entry/exit and disabled mode passed.');
