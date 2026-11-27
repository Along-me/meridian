function platformOptions(platform=process.platform){
  const mac=platform==='darwin';
  return {
    mac,
    icon:mac?'icon.png':'icon.ico',
    manager:mac?{titleBarStyle:'hiddenInset',trafficLightPosition:{x:16,y:16}}:{titleBarStyle:'hidden',titleBarOverlay:{color:'#1b1b1b',symbolColor:'#ededed',height:48}},
    widget:mac?{type:'panel',hiddenInMissionControl:true}:{}
  };
}
function configureWidgetSpaces(window,platform=process.platform){
  if(platform==='darwin')window.setVisibleOnAllWorkspaces(true,{visibleOnFullScreen:true,skipTransformProcessType:true});
}
module.exports={platformOptions,configureWidgetSpaces};
