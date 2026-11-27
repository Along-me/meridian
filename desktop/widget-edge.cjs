// A forgiving drop zone makes edge docking practical on high-DPI displays.
const DEFAULT_THRESHOLD = 32;
const DEFAULT_PEEK = 6;

function near(value, target, threshold) {
  return Math.abs(value - target) <= threshold;
}

function snapToEdges(bounds, workArea, threshold = DEFAULT_THRESHOLD) {
  if (!bounds || !workArea) return { bounds: { ...bounds }, edges: [], edge: null, changed: false };
  const next = { ...bounds };
  const edges = [];
  if (near(bounds.x, workArea.x, threshold)) {
    next.x = workArea.x;
    edges.push('left');
  } else if (near(bounds.x + bounds.width, workArea.x + workArea.width, threshold)) {
    next.x = workArea.x + workArea.width - bounds.width;
    edges.push('right');
  }
  if (near(bounds.y, workArea.y, threshold)) {
    next.y = workArea.y;
    edges.push('top');
  } else if (near(bounds.y + bounds.height, workArea.y + workArea.height, threshold)) {
    next.y = workArea.y + workArea.height - bounds.height;
    edges.push('bottom');
  }
  const horizontal = edges.find(edge => edge === 'left' || edge === 'right');
  return { bounds: next, edges, edge: horizontal || edges[0] || null, changed: next.x !== bounds.x || next.y !== bounds.y };
}

function hiddenBounds(bounds, workArea, edge, peek = DEFAULT_PEEK) {
  const next = { ...bounds };
  if (edge === 'left') next.x = workArea.x - Math.max(0, bounds.width - peek);
  if (edge === 'right') next.x = workArea.x + workArea.width - peek;
  if (edge === 'top') next.y = workArea.y - Math.max(0, bounds.height - peek);
  if (edge === 'bottom') next.y = workArea.y + workArea.height - peek;
  return next;
}

function cursorNearEdge(point, workArea, edge, peek = DEFAULT_PEEK, margin = 10, bounds = workArea) {
  if (!point || !workArea || !edge) return false;
  const withinX = point.x >= bounds.x && point.x < bounds.x + bounds.width;
  const withinY = point.y >= bounds.y && point.y < bounds.y + bounds.height;
  if (edge === 'left' || edge === 'right') {
    const x = edge === 'left' ? workArea.x : workArea.x + workArea.width;
    return withinY && Math.abs(point.x - x) <= peek + margin;
  }
  const y = edge === 'top' ? workArea.y : workArea.y + workArea.height;
  return withinX && Math.abs(point.y - y) <= peek + margin;
}

// BrowserWindow has no mouse-enter/leave events. Sample the global DIP cursor in
// both states, including when another application owns the foreground window.
function createEdgeHover({getWindow,getCursor,getDock,getArea,isDragging,hide,reveal,
  now=Date.now,schedule=setInterval,cancel=clearInterval,delay=650}) {
  let timer=null,outsideSince=null;
  function reset(){outsideSince=null}
  function tick(){
    const window=getWindow(),dock=getDock();
    if(!window||window.isDestroyed()||!window.isVisible()||!dock.edge||isDragging()) {reset();return}
    const bounds=dock.hidden?dock.visibleBounds:window.getBounds();
    if(!bounds){reset();return}
    const point=getCursor(),area=getArea(bounds);
    const atEdge=cursorNearEdge(point,area,dock.edge,DEFAULT_PEEK,10,bounds);
    if(dock.hidden){reset();if(atEdge)reveal();return}
    const inside=point.x>=bounds.x&&point.x<bounds.x+bounds.width&&point.y>=bounds.y&&point.y<bounds.y+bounds.height;
    if(inside||atEdge){reset();return}
    if(outsideSince===null)outsideSince=now();
    if(now()-outsideSince>=delay){reset();hide()}
  }
  function start(){if(timer===null){timer=schedule(tick,90);timer?.unref?.()}}
  function stop(){if(timer!==null)cancel(timer);timer=null;reset()}
  return {start,stop,reset,tick};
}

module.exports = { DEFAULT_THRESHOLD, DEFAULT_PEEK, snapToEdges, hiddenBounds, cursorNearEdge,createEdgeHover };
