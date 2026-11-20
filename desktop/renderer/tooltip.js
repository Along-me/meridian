window.meridianTooltip.onData(data=>{
  document.body.classList.toggle('light',data.light);document.body.classList.toggle('control-tip',data.kind==='control');
  const box=document.getElementById('tooltip');box.replaceChildren();
  for(const field of data.fields){
    const element=document.createElement(field.strong?'strong':'span');element.className=field.className;element.style.fontSize=field.fontSize+'px';
    for(const segment of field.segments){const node=document.createElement(segment.period?'em':'span');node.textContent=segment.text;if(segment.period)node.style.fontSize=segment.fontSize+'px';element.appendChild(node)}
    box.appendChild(element);
  }
  window.meridianTooltip.measure(Math.ceil(document.body.scrollHeight));
});
