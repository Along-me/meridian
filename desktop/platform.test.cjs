const assert=require('node:assert/strict');
const {platformOptions,configureWidgetSpaces}=require('./platform.cjs');
const mac=platformOptions('darwin'),win=platformOptions('win32');
assert.equal(mac.manager.titleBarStyle,'hiddenInset');assert.equal(mac.widget.type,'panel');assert.equal(mac.manager.titleBarOverlay,undefined);
assert.equal(win.manager.titleBarStyle,'hidden');assert(win.manager.titleBarOverlay);assert.equal(win.icon,'icon.ico');assert.equal(mac.icon,'icon.png');
let calls=[];const window={setVisibleOnAllWorkspaces:(...args)=>calls.push(args)};
configureWidgetSpaces(window,'win32');assert.equal(calls.length,0);
configureWidgetSpaces(window,'darwin');assert.deepEqual(calls,[[true,{visibleOnFullScreen:true,skipTransformProcessType:true}]]);
console.log('Platform titlebar, icon and macOS fullscreen workspace options passed.');
