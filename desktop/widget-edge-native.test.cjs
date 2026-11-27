const assert=require('node:assert/strict');
const {screen}=require('electron');
module.exports=async({manager,widget,getState,getDock,setCursor,refresh,place})=>{
  const delay=ms=>new Promise(r=>setTimeout(r,ms));
  const saved=JSON.parse(JSON.stringify(getState())),original=widget.getBounds();
  async function waitFor(check,label){for(let i=0;i<100;i++){if(check())return;await delay(50)}assert.fail(label+' '+JSON.stringify({bounds:widget.getBounds(),dock:getDock(),visible:widget.isVisible()}))}
  try{
    await manager.webContents.executeJavaScript(`state.edgeSnap=true;state.edgeHide=true;state.pinned=true;state.autoHideHeader=false;state.widgetSizes[state.widgetStyle]={width:400,height:132};save()`);
    await delay(300);
    widget.showInactive();
    const area=screen.getDisplayMatching(original).workArea;
    for(const hiddenHeader of [false,true]){
    for(const [index,edge] of ['top','left','right','bottom'].entries()){
      await widget.webContents.executeJavaScript(`state.widgetStyle=${JSON.stringify(['classic','compact','cards','analog'][index])};state.autoHideHeader=${hiddenHeader};state.widgetSizes[state.widgetStyle]={width:400,height:132};save();renderWidget();syncControls()`);
      await delay(200);
      const bounds={x:area.x+100,y:area.y+100,width:400,height:132};
      if(edge==='top')bounds.y=area.y;
      if(edge==='left')bounds.x=area.x;
      if(edge==='right')bounds.x=area.x+area.width-bounds.width;
      if(edge==='bottom')bounds.y=area.y+area.height-bounds.height;
      setCursor({x:bounds.x+30,y:bounds.y+30});
      place(bounds);await delay(150);
      for(let cycle=0;cycle<2;cycle++){
        setCursor({x:area.x+area.width/2,y:area.y+area.height/2});
        await waitFor(()=>getDock().hidden,'Native '+edge+' did not hide');
        if(process.platform==='darwin')assert.equal(widget.isVisible(),false);
        else assert(edge==='top'?widget.getBounds().y<area.y:edge==='left'?widget.getBounds().x<area.x:edge==='right'?widget.getBounds().x>bounds.x:widget.getBounds().y>bounds.y);
        setCursor({x:edge==='right'?area.x+area.width-2:bounds.x+2,y:edge==='bottom'?area.y+area.height-2:bounds.y+2});
        await waitFor(()=>!getDock().hidden,'Native '+edge+' did not reveal');
        assert.equal(widget.getBounds().width>100,true);assert.equal(widget.getBounds().height>50,true);
        await delay(550);
        assert.equal(await widget.webContents.executeJavaScript(`getComputedStyle(document.querySelector('#widget .widget-top')).visibility`),hiddenHeader?'hidden':'visible');
        assert.equal(widget.isAlwaysOnTop(),true,'Reveal must restore native topmost');
      }
    }
    }
    console.log('Four styles retain header visibility through repeated edge hiding and recall, with native topmost.');
  }finally{
    await manager.webContents.executeJavaScript('state='+JSON.stringify(saved)+';save()');
    widget.setBounds(original);refresh();setCursor(null);
  }
};
