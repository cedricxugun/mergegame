// A landscape viewport even in a narrow desktop side panel. The child browsing
// context maps touch coordinates itself, including when a locked phone is turned.
const url = new URL(location.href);
const embedded = window.parent !== window && url.searchParams.get('layout')==='landscape';
if (embedded || innerWidth>=innerHeight) {
  await import('./app.mjs');
  if(!embedded)matchMedia('(orientation: portrait)').addEventListener('change',event=>{if(event.matches)location.reload();});
} else {
  document.title='风暴之后 · 横屏家园';
  document.body.innerHTML='<div class="landscape-host"><iframe title="横屏家园地图" allow="autoplay; fullscreen" allowfullscreen></iframe><button type="button" class="expand-map">展开横屏预览</button></div>';
  const host=document.querySelector('.landscape-host'), frame=host.querySelector('iframe'), expand=host.querySelector('button');
  document.body.classList.add('map-shell');
  url.searchParams.set('layout','landscape');
  frame.src=url.href;
  if(url.searchParams.has('fresh')){
    const clean=new URL(location.href);clean.searchParams.delete('fresh');
    try{history.replaceState(null,'',clean.href);}catch{}
  }
  function layout() {
    const w=host.clientWidth,h=host.clientHeight;
    const upright=w<h;
    const rotated=upright&&matchMedia('(pointer:coarse)').matches;
    const width=rotated?h:upright?844:w, height=rotated?w:upright?390:h;
    const scale=upright&&!rotated?Math.min(w/width,h/height):1;
    Object.assign(frame.style,{width:width+'px',height:height+'px',transform:'translate(-50%,-50%) rotate('+(rotated?90:0)+'deg) scale('+scale+')'});
    expand.hidden=!upright||rotated;
    expand.style.top='calc(50% + '+Math.round(height*scale/2+12)+'px)';
  }
  expand.addEventListener('click',async()=>{try{await host.requestFullscreen();}catch{window.open(location.href,'_blank','noopener');}});
  new ResizeObserver(layout).observe(host);layout();
}
