if(window.meridianDesktop?.initial.state){
  try{localStorage.setItem('meridian-framework-v1',JSON.stringify({...window.meridianDesktop.initial.state}))}catch(_){}
}
