export const MAX_AUDIO_BYTES=1500000;
export function validateWav(bytes: Uint8Array) {
  const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);
  const tag=(offset:number)=>String.fromCharCode(...bytes.slice(offset,offset+4));
  if(bytes.length<44 || bytes.length>MAX_AUDIO_BYTES || tag(0)!=="RIFF" || tag(8)!=="WAVE" || view.getUint32(4,true)+8!==bytes.length)throw new Error("INVALID_WAV");
  let rate=0,dataBytes=0,formatFound=false,dataFound=false;
  for(let offset=12;offset+8<=bytes.length;) {
    const size=view.getUint32(offset+4,true),start=offset+8;
    if(start+size>bytes.length)throw new Error("INVALID_WAV");
    if(tag(offset)==="fmt ") {
      if(formatFound || size<16 || view.getUint16(start,true)!==1 || view.getUint16(start+2,true)!==1 || view.getUint16(start+14,true)!==16)throw new Error("INVALID_WAV");
      rate=view.getUint32(start+4,true);
      if(![16000,24000].includes(rate) || view.getUint32(start+8,true)!==rate*2 || view.getUint16(start+12,true)!==2)throw new Error("INVALID_WAV");
      formatFound=true;
    }
    if(tag(offset)==="data") {if(dataFound || size%2)throw new Error("INVALID_WAV");dataBytes=size;dataFound=true;}
    offset=start+size+(size%2);
  }
  if(!formatFound || !dataFound || dataBytes===0 || dataBytes/(rate*2)>30)throw new Error("AUDIO_LIMIT_30_SECONDS");
}
// Peak-normalise quiet recordings so soft speech is audible. Near-silent
// input is returned unchanged so background noise is not amplified.
export function normaliseVolume(samples: Float32Array,targetPeak=0.89): Float32Array {
  let peak=0;
  for(const s of samples){const a=Math.abs(s);if(a>peak)peak=a;}
  if(peak<0.02||peak>=targetPeak)return samples;
  const gain=targetPeak/peak,out=new Float32Array(samples.length);
  for(let i=0;i<samples.length;i++)out[i]=samples[i]*gain;
  return out;
}
// Trim leading and trailing silence (10 ms frames under -34 dB RMS),
// keeping a short margin so word edges are never clipped.
export function trimSilence(samples: Float32Array,rate=24000,marginMs=150): Float32Array {
  const frame=Math.max(1,Math.floor(rate/100)),margin=Math.floor(rate*marginMs/1000);
  const loud=(from:number)=>{const end=Math.min(samples.length,from+frame);let sum=0;for(let j=from;j<end;j++)sum+=samples[j]*samples[j];return Math.sqrt(sum/(end-from))>0.02;};
  let start=0,end=samples.length,found=false;
  while(start<end){if(loud(start)){found=true;break;}start+=frame;}
  if(!found)return new Float32Array(0);
  while(end>start&&!loud(Math.max(start,end-frame)))end-=frame;
  start=Math.max(0,start-margin);end=Math.min(samples.length,end+margin);
  return start>=end?new Float32Array(0):samples.slice(start,end);
}
export function pcmToWav(samples: Float32Array,rate=24000): Uint8Array {
  const buffer=new ArrayBuffer(44+samples.length*2),view=new DataView(buffer);
  const word=(offset:number,text:string)=>{for(let i=0;i<text.length;i++)view.setUint8(offset+i,text.charCodeAt(i));};
  word(0,"RIFF");view.setUint32(4,36+samples.length*2,true);word(8,"WAVE");word(12,"fmt ");
  view.setUint32(16,16,true);view.setUint16(20,1,true);view.setUint16(22,1,true);
  view.setUint32(24,rate,true);view.setUint32(28,rate*2,true);view.setUint16(32,2,true);view.setUint16(34,16,true);
  word(36,"data");view.setUint32(40,samples.length*2,true);
  for(let i=0;i<samples.length;i++){const value=Math.max(-1,Math.min(1,samples[i]));view.setInt16(44+i*2,value<0?value*32768:value*32767,true);}
  return new Uint8Array(buffer);
}
