"use client";
import { useEffect, useRef, useState } from "react";
import { shouldHideAfterBlur } from "@/lib/password-field";
type Pending={id:string;name:string;brand:string;variant:string;size:string;unit:string;category:string;flag_reason:string|null;created_at:string;shop_name:string};
type DemandPhoto={id:string;kind:string;key:string;cell:string;status:string;created_at:string;label:string|null};
const messages:Record<string,string>={
  OPERATOR_DISABLED:"Product review is not enabled on this server.",
  INVALID_OPERATOR_CODE:"That access code is incorrect.",
  INVALID_REVIEW:"That review request is invalid.",
  NOT_PENDING:"This product was already reviewed.",
  PHOTO_MISSING:"No photo was kept for this product.",
  REQUEST_FAILED:"Could not finish this request. Check the connection and try again.",
};
const friendly=(error:unknown)=>error instanceof Error?(messages[error.message]||messages.REQUEST_FAILED):messages.REQUEST_FAILED;
const time=(value:string)=>new Date(value).toLocaleString("en-NG",{dateStyle:"medium",timeStyle:"short",timeZone:"Africa/Lagos"});
export default function OperatorPage(){
  const [code,setCode]=useState(""),[pending,setPending]=useState<Pending[]|null>(null),[photos,setPhotos]=useState<Record<string,string>>({}),[busy,setBusy]=useState(""),[notice,setNotice]=useState(""),[rowNote,setRowNote]=useState<{id:string;text:string}|null>(null),[showCode,setShowCode]=useState(false),[capsOn,setCapsOn]=useState(false),[dPhotos,setDPhotos]=useState<DemandPhoto[]|null>(null),[dUrls,setDUrls]=useState<Record<string,string>>({});
  const noticeRef=useRef<HTMLParagraphElement|null>(null);
  const awaySince=useRef<number|null>(null);
  useEffect(()=>{noticeRef.current?.scrollIntoView({block:"nearest"});},[notice]);
  useEffect(()=>{
    const mark=()=>{awaySince.current=Date.now();};
    const back=()=>{if(shouldHideAfterBlur(awaySince.current,Date.now()))setShowCode(false);awaySince.current=null;};
    const vis=()=>{if(document.hidden)mark();else back();};
    window.addEventListener("blur",mark);window.addEventListener("focus",back);document.addEventListener("visibilitychange",vis);
    return()=>{window.removeEventListener("blur",mark);window.removeEventListener("focus",back);document.removeEventListener("visibilitychange",vis);};
  },[]);
  async function load(){
    if(!code.trim()){setNotice("Enter the owner access code first.");return;}
    setBusy("load");setNotice("");
    try {
      const data=await (await fetch("/api/operator/custom-products",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({accessCode:code}),cache:"no-store",signal:AbortSignal.timeout(40000)})).json().catch(()=>null);
      if(!data||!Array.isArray(data.pending))throw new Error(data?.error?.code||"REQUEST_FAILED");
      setPending(data.pending);setPhotos({});
      if(!data.pending.length)setNotice("No flagged products are waiting for review.");
    }catch(error){setNotice(friendly(error));}finally{setBusy("");}
  }
  async function review(productId:string,approve:boolean){
    setBusy(productId);setNotice("");setRowNote(null);
    try {
      const response=await fetch("/api/operator/review",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({accessCode:code,productId,approve}),cache:"no-store",signal:AbortSignal.timeout(40000)});
      const data=await response.json().catch(()=>null);
      if(!response.ok)throw new Error(data?.error?.code||"REQUEST_FAILED");
      setPending(list=>(list||[]).filter(p=>p.id!==productId));
      setNotice(approve?"Approved. Buyers can now see this product.":"Rejected. The product stays hidden from buyers.");
    }catch(error){setRowNote({id:productId,text:friendly(error)});}finally{setBusy("");}
  }
  async function viewPhoto(productId:string){
    if(photos[productId]){setPhotos(prev=>{const next={...prev};delete next[productId];return next;});return;}
    setBusy(productId);setNotice("");setRowNote(null);
    try {
      const response=await fetch("/api/operator/photo",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({accessCode:code,productId}),cache:"no-store",signal:AbortSignal.timeout(40000)});
      if(!response.ok){const data=await response.json().catch(()=>null);throw new Error(data?.error?.code||"REQUEST_FAILED");}
      const url=URL.createObjectURL(await response.blob());
      setPhotos(prev=>({...prev,[productId]:url}));
    }catch(error){setRowNote({id:productId,text:friendly(error)});}finally{setBusy("");}
  }
  async function postDemand(path:string,body:unknown){
    const response=await fetch(path,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(body),cache:"no-store",signal:AbortSignal.timeout(40000)});
    const data=await response.json().catch(()=>null);
    if(!response.ok)throw new Error(data?.error?.code||"REQUEST_FAILED");
    return data;
  }
  async function loadDemandPhotos(){
    if(!code.trim()){setNotice("Enter the owner access code first.");return;}
    setBusy("demand-list");setNotice("");
    try {
      const data=await postDemand("/api/operator/demand-photos",{accessCode:code});
      setDPhotos(data.photos);setDUrls({});
      if(!data.photos.length)setNotice("No demand photos are stored.");
    }catch(error){setNotice(friendly(error));}finally{setBusy("");}
  }
  async function viewDemandPhoto(photoId:string){
    if(dUrls[photoId]){setDUrls(prev=>{const next={...prev};delete next[photoId];return next;});return;}
    setBusy(photoId);setNotice("");
    try {
      const response=await fetch("/api/operator/demand-photo",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({accessCode:code,photoId,action:"view"}),cache:"no-store",signal:AbortSignal.timeout(40000)});
      if(!response.ok){const data=await response.json().catch(()=>null);throw new Error(data?.error?.code||"REQUEST_FAILED");}
      const url=URL.createObjectURL(await response.blob());
      setDUrls(prev=>({...prev,[photoId]:url}));
    }catch(error){setNotice(friendly(error));}finally{setBusy("");}
  }
  async function deleteDemandPhoto(photoId:string){
    setBusy(photoId);setNotice("");
    try {
      await postDemand("/api/operator/demand-photo",{accessCode:code,photoId,action:"delete"});
      setDPhotos(list=>(list||[]).filter(p=>p.id!==photoId));
      setDUrls(prev=>{const next={...prev};delete next[photoId];return next;});
      setNotice("Photo deleted.");
    }catch(error){setNotice(friendly(error));}finally{setBusy("");}
  }
  return <div className="workspace">
    <header className="topbar"><span className="brand"><span className="brand-mark">M</span>Market Assistant <span className="brand-light">· Owner review</span></span></header>
    <main className="dashboard">
      <div className="panel">
        <h2>Flagged products</h2>
        <p className="muted">New trader products that automatic checks flagged wait here. Approve to show them to buyers, or reject to keep them hidden. Photos are kept only for review.</p>
        <div className="field-row">
          <label>Owner access code<span className="password-row"><input type={showCode?"text":"password"} autoComplete="off" value={code} onChange={e=>setCode(e.target.value)} placeholder="Access code" onKeyDown={e=>setCapsOn(e.getModifierState("CapsLock"))} onKeyUp={e=>setCapsOn(e.getModifierState("CapsLock"))} onBlur={()=>setCapsOn(false)}/><button type="button" className="password-toggle" aria-pressed={showCode} aria-label={showCode?"Hide access code":"Show access code"} onClick={()=>setShowCode(v=>!v)}>{showCode?"Hide":"Show"}</button></span>{capsOn&&<span className="hint" role="status">Caps Lock is on</span>}</label>
        </div>
        <div className="inline-actions"><button className="primary" disabled={busy==="load"||!code.trim()} onClick={load}>{busy==="load"?"Loading…":"Show flagged products"}</button></div>
        {notice&&<p className="notice" role="status" ref={noticeRef}>{notice}</p>}
        {pending!==null&&!pending.length&&<div className="empty-state"><strong>Nothing waiting</strong><p>New flagged products will appear here for review.</p></div>}
        {pending!==null&&pending.length>0&&pending.map(p=><div key={p.id} className="stock-row">
          <div><strong>{p.brand?`${p.brand} `:""}{p.name} · {p.size}</strong>
            <p className="hint">Unit: {p.unit} · Category: {p.category} · Shop: {p.shop_name}</p>
            <p className="hint">Flag: {p.flag_reason||"manual review"} · Added {time(p.created_at)}</p>
            {photos[p.id]&&<img className="preview" src={photos[p.id]} alt="Kept product photo"/>}
          </div>
          <div className="stock-number">
            <div className="inline-actions">
              <button className="text-button" disabled={busy===p.id} onClick={()=>viewPhoto(p.id)}>{photos[p.id]?"Hide photo":"View photo"}</button>
              <button className="primary" disabled={busy===p.id} onClick={()=>review(p.id,true)}>Approve</button>
              <button className="secondary" disabled={busy===p.id} onClick={()=>review(p.id,false)}>Reject</button>
            </div>
            {rowNote&&rowNote.id===p.id&&<p className="notice" role="status">{rowNote.text}</p>}
          </div>
        </div>)}
      </div>
      <div className="panel">
        <h2>Demand photos</h2>
        <p className="muted">Buyer photos held for unmet-demand alerts. Pending photos join an alert only if 5 or more people search for the item; active photos expire with the alert or after 7 days. No visitor counts are shown here.</p>
        <div className="inline-actions"><button className="primary" disabled={busy==="demand-list"||!code.trim()} onClick={loadDemandPhotos}>{busy==="demand-list"?"Loading…":"Show demand photos"}</button></div>
        {dPhotos!==null&&!dPhotos.length&&<div className="empty-state"><strong>No photos stored</strong><p>New demand photos will appear here for review.</p></div>}
        {dPhotos!==null&&dPhotos.length>0&&dPhotos.map(p=><div key={p.id} className="stock-row">
          <div><strong>{p.label||p.key}</strong>
            <p className="hint">Status: {p.status} · Added {time(p.created_at)}</p>
            {dUrls[p.id]&&<img className="preview" src={dUrls[p.id]} alt="Demand photo"/>}
          </div>
          <div className="stock-number">
            <div className="inline-actions">
              <button className="text-button" disabled={busy===p.id} onClick={()=>viewDemandPhoto(p.id)}>{dUrls[p.id]?"Hide photo":"View photo"}</button>
              <button className="secondary" disabled={busy===p.id} onClick={()=>deleteDemandPhoto(p.id)}>Remove</button>
            </div>
          </div>
        </div>)}
      </div>
    </main>
  </div>;
}
