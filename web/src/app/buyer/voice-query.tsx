"use client";
import { useEffect,useRef,useState } from "react";
import {pcmToWav} from "@/lib/audio";
export default function VoiceQuery({enabled,onTranscript}:{enabled:boolean;onTranscript:(text:string)=>void}) {
  const [consent,setConsent]=useState(false),[busy,setBusy]=useState(false),[recording,setRecording]=useState(false),[message,setMessage]=useState("");
  const recorder=useRef<MediaRecorder|null>(null),stream=useRef<MediaStream|null>(null),timer=useRef<ReturnType<typeof setTimeout>|null>(null),discard=useRef(false),mounted=useRef(true);
  useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;discard.current=true;if(timer.current)clearTimeout(timer.current);if(recorder.current?.state==="recording")recorder.current.stop();stream.current?.getTracks().forEach(t=>t.stop());};},[]);
  async function transcribe(blob:Blob) {
    setBusy(true);setMessage("");
    try {
      if(blob.size>4000000)throw new Error("Keep audio to 30 seconds and under 4 MB.");
      const context=new AudioContext();const decoded=await context.decodeAudioData(await blob.arrayBuffer()).finally(()=>context.close());
      if(decoded.duration<=0||decoded.duration>30.2)throw new Error("Keep audio to 30 seconds or less.");
      const offline=new OfflineAudioContext(1,Math.ceil(decoded.duration*24000),24000),source=offline.createBufferSource();source.buffer=decoded;source.connect(offline.destination);source.start();
      const converted=await offline.startRendering(),wav=pcmToWav(converted.getChannelData(0));
      const response=await fetch("/api/buyer/transcribe",{method:"POST",headers:{"Content-Type":"audio/wav"},body:new Uint8Array(wav),signal:AbortSignal.timeout(40000)});
      const data=await response.json();if(!response.ok)throw new Error(data.error?.code==="META_NOT_CONFIGURED"?"Voice is not connected yet. Type your search instead.":"Transcription did not finish. Please type your search instead.");
      if(mounted.current){onTranscript(data.transcript);setMessage("Check the transcript and choose the exact product before searching.");}
    }catch(error){if(mounted.current)setMessage(error instanceof Error?error.message:"Please type your search instead.");}
    finally{if(mounted.current)setBusy(false);}
  }
  async function start() {
    try {
      if(!navigator.mediaDevices?.getUserMedia||typeof MediaRecorder==="undefined")throw new Error("Recording is unavailable. Upload audio or type instead.");
      stream.current=await navigator.mediaDevices.getUserMedia({audio:true});discard.current=false;
      const instance=new MediaRecorder(stream.current),chunks:Blob[]=[];recorder.current=instance;
      instance.ondataavailable=e=>{if(e.data.size)chunks.push(e.data);};
      instance.onstop=()=>{if(timer.current)clearTimeout(timer.current);stream.current?.getTracks().forEach(t=>t.stop());if(mounted.current){setRecording(false);if(!discard.current)void transcribe(new Blob(chunks,{type:instance.mimeType}));}chunks.length=0;};
      instance.start();setRecording(true);timer.current=setTimeout(()=>{if(instance.state==="recording")instance.stop();},29000);
    }catch(error){stream.current?.getTracks().forEach(t=>t.stop());setMessage(error instanceof Error?error.message:"Microphone permission was unavailable. Type instead.");}
  }
  return <details className="buyer-voice"><summary>Search by voice</summary><p className="hint">Voice is optional. Audio is sent to Meta and is not saved by this app. Language accuracy still needs live testing.</p>{!enabled&&<p className="hint">Voice is not connected yet. Text search works without it.</p>}<label className="check"><input type="checkbox" checked={consent} disabled={busy} onChange={e=>{setConsent(e.target.checked);if(!e.target.checked&&recording){discard.current=true;recorder.current?.stop();}}}/><span>I agree to send this recording to Meta for transcription.</span></label><div className="inline-actions"><button type="button" className="secondary" disabled={!enabled||!consent||busy} onClick={()=>recording?recorder.current?.stop():void start()}>{recording?"Stop recording":"Record search"}</button>{recording&&<button type="button" className="text-button" onClick={()=>{discard.current=true;recorder.current?.stop();}}>Discard</button>}<label className="file-label">Or upload audio<input type="file" aria-label="Upload search audio" accept="audio/*" disabled={!enabled||!consent||busy||recording} onChange={e=>{const file=e.target.files?.[0];e.target.value="";if(file)void transcribe(file);}}/></label></div>{(busy||message)&&<p className="hint" role="status">{busy?"Transcribing…":message}</p>}</details>;
}
