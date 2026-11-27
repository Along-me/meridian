const {spawnSync}=require('node:child_process');
const path=require('node:path');
const tests=[
  'desktop/updates.test.cjs','desktop/quick-launch.test.cjs',
  'verify-comparison.cjs','verify-conversions.cjs','verify-currency.cjs','verify-currency-providers.cjs',
  'desktop/currency-service.test.cjs','desktop/widget-drag.test.cjs','desktop/widget-geometry.test.cjs',
  'desktop/widget-visibility.test.cjs','desktop/widget-edge.test.cjs','desktop/header-overlay.test.cjs','desktop/tooltip-window.test.cjs',
  'desktop/login-items.test.cjs','desktop/platform.test.cjs','verify-presets.cjs'
];
for(const file of ['desktop/prepare.cjs',...tests]){
  const result=spawnSync(process.execPath,[file],{cwd:path.join(__dirname,'..'),stdio:'inherit'});
  if(result.error)throw result.error;
  if(result.status!==0)process.exit(result.status||1);
}
console.log('All '+tests.length+' test suites passed.');
