// Generate the existing clock artwork without Windows-only drawing libraries.
const fs=require('node:fs'),path=require('node:path'),zlib=require('node:zlib');
const directory=path.join(__dirname,'assets');fs.mkdirSync(directory,{recursive:true});
function crc32(bytes){let crc=0xffffffff;for(const byte of bytes){crc^=byte;for(let i=0;i<8;i++)crc=(crc>>>1)^((crc&1)?0xedb88320:0)}return (crc^0xffffffff)>>>0}
function chunk(name,data){const type=Buffer.from(name),size=Buffer.alloc(4),crc=Buffer.alloc(4);size.writeUInt32BE(data.length);crc.writeUInt32BE(crc32(Buffer.concat([type,data])));return Buffer.concat([size,type,data,crc])}
function segmentDistance(x,y,ax,ay,bx,by){const t=Math.max(0,Math.min(1,((x-ax)*(bx-ax)+(y-ay)*(by-ay))/((bx-ax)**2+(by-ay)**2)));return Math.hypot(x-ax-t*(bx-ax),y-ay-t*(by-ay))}
function image(size,template=false){
  const raw=Buffer.alloc((size*4+1)*size),background=[34,55,71],accent=[101,206,247],hand=[234,246,252];
  for(let y=0;y<size;y++)for(let x=0;x<size;x++){
    let alpha=0,r=0,g=0,b=0;
    for(const dy of [.25,.75])for(const dx of [.25,.75]){
      const px=(x+dx)/size,py=(y+dy)/size,d=Math.hypot(px-.5,py-.5);
      const rim=Math.abs(d-.36)<.0275,hands=Math.min(segmentDistance(px,py,.5,.5,.5,.29),segmentDistance(px,py,.5,.5,.67,.6))<.0235;
      const color=template?(rim||hands?[0,0,0]:null):hands?hand:rim?accent:d<.475?background:null;
      if(color){alpha++;r+=color[0];g+=color[1];b+=color[2]}
    }
    const offset=y*(size*4+1)+1+x*4;if(alpha){raw[offset]=Math.round(r/alpha);raw[offset+1]=Math.round(g/alpha);raw[offset+2]=Math.round(b/alpha);raw[offset+3]=Math.round(alpha*255/4)}
  }
  const header=Buffer.alloc(13);header.writeUInt32BE(size);header.writeUInt32BE(size,4);header[8]=8;header[9]=6;
  return Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',header),chunk('IDAT',zlib.deflateSync(raw)),chunk('IEND',Buffer.alloc(0))]);
}
fs.writeFileSync(path.join(directory,'icon.png'),image(1024));
fs.writeFileSync(path.join(directory,'tray.png'),image(32));
fs.writeFileSync(path.join(directory,'trayTemplate.png'),image(18,true));
fs.writeFileSync(path.join(directory,'trayTemplate@2x.png'),image(36,true));
const icoImage=image(256),ico=Buffer.alloc(22);ico.writeUInt16LE(1,2);ico.writeUInt16LE(1,4);ico.writeUInt16LE(1,10);ico.writeUInt16LE(32,12);ico.writeUInt32LE(icoImage.length,14);ico.writeUInt32LE(22,18);
fs.writeFileSync(path.join(directory,'icon.ico'),Buffer.concat([ico,icoImage]));
console.log('Generated application and macOS template menu bar icons.');
