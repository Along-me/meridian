let latestRevision=0;
window.meridianTooltip.onData(async data=>{
  latestRevision=data.revision;
  // Measure at the target width, including the first control/clock transition.
  document.body.style.width=data.width+'px';
  document.body.classList.toggle('light',data.light);document.body.classList.toggle('control-tip',data.kind==='control');
  const box=document.getElementById('tooltip'),content=document.createDocumentFragment();
  for(const field of data.fields){
    const element=document.createElement(field.strong?'strong':'span');element.className=field.className;element.style.fontSize=field.fontSize+'px';
    for(const segment of field.segments){const node=document.createElement(segment.period?'em':'span');node.textContent=segment.text;if(segment.period)node.style.fontSize=segment.fontSize+'px';element.appendChild(node)}
    content.appendChild(element);
  }
  box.replaceChildren(content);
  await document.fonts.ready;
  requestAnimationFrame(()=>requestAnimationFrame(()=>{
    if(latestRevision!==data.revision)return;
    // Content height can shrink; scrollHeight may include the old viewport.
    window.meridianTooltip.measure({revision:data.revision,height:Math.ceil(box.getBoundingClientRect().height+10)});
  }));
});
