"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import StockInsights from "./stock-insights";
import { pcmToWav, normaliseVolume, trimSilence } from "@/lib/audio";
import { cleanEntryText, likelyAction } from "@/lib/entry-text";
import { prepareProductPhoto } from "@/lib/image-prep";
import { validateCustomProduct, findClosestProducts, isRegulatedProduct, mergeProposals } from "@/lib/custom-products";
import { polishProposal, pluralizeUnit } from "@/lib/proposal-polish";
import { shouldHideAfterBlur } from "@/lib/password-field";
import type { PolishedProposal } from "@/lib/proposal-polish";
import { catalogWords } from "@/lib/catalog-match";
import type { ImageProposal } from "@/lib/meta-client";
import { locationErrorMessage } from "@/lib/geolocation";
import { nairaToKobo } from "@/lib/money";
import type { StockEntry } from "@/lib/entries";
import type { ExtractedEntry } from "@/lib/meta-client";

type Product={id:string;name:string;brand:string;variant:string;size:string;unit:string;perishable:boolean;status:string};
type PhotoData={bytes:Uint8Array<ArrayBuffer>;url:string};
type NewProductFlow=null|{stage:"capture";hint:string}
  |{stage:"preview";hint:string;photo:PhotoData;back:PhotoData|null}
  |{stage:"proposal";hint:string;photo:PhotoData;back:PhotoData|null;proposal:PolishedProposal}
  |{stage:"units";hint:string;photo:PhotoData;proposal:PolishedProposal;unit:string}
  |{stage:"duplicates";hint:string;photo:PhotoData;proposal:PolishedProposal;unit:string;closest:Product[]}
  |{stage:"typed";hint:string;photo:PhotoData;typedName:string;typedBrand:string;typedSize:string;unit:string};
type Shop={id:string;name:string;landmark:string;location_verified:boolean};
type Batch={batch_id:string;product_id:string;name:string;brand:string;size:string;unit:string;expiry_date:string|null;estimated_qty:number;confirmed_at:string|null};
type Event={id:string;product_id:string;batch_id:string;name:string;brand:string;size:string;unit:string;qty_delta:number;event_type:string;event_at:string};
type Review={token:string;entry:StockEntry;product:Product;expiresInSeconds:number};
const messages:Record<string,string>={
  DATABASE_UNAVAILABLE:"The account and stock service is not connected yet. Nothing has been confirmed saved.",
  DEMO_ACCOUNTS_DISABLED:"Account signup is not connected yet. Please return after the demo database is ready.",
  SESSION_NOT_CONFIGURED:"Account sessions are not connected yet.",SIGN_IN_REQUIRED:"Please sign in to your shop.",SESSION_EXPIRED:"Your session expired. Please sign in again.",
  INVALID_LOGIN:"The email or password is incorrect.",INVALID_EMAIL:"Enter a valid email address.",PASSWORD_MINIMUM_10_CHARACTERS:"Use a password between 10 and 128 characters.",
  ACCOUNT_CANNOT_BE_CREATED_TRY_LOGIN:"This account could not be created. Try signing in if you already registered.",
  META_NOT_CONFIGURED:"AI is not connected yet. You can enter the details manually below.",META_REQUEST_FAILED:"AI could not process this entry. Please use the manual form.",
  META_TIMEOUT_OR_NETWORK:"AI did not finish in time. Try again or enter the details manually.",META_RATE_LIMITED:"The AI service is busy. Wait a moment or use the manual form.",
  INVALID_MODEL_RESPONSE:"AI returned an unclear entry. Please enter the details manually.",NO_CLEAR_TRANSCRIPT:"No clear speech was found. Try a short recording or type instead.",
  INSUFFICIENT_STOCK_RECOUNT_REQUIRED:"That sale exceeds available stock. Check the quantity or recount the batch first.",
  CONFIRMATION_EXPIRED:"This review expired. Review the details again before saving.",STOCK_CHANGED_REVIEW_AGAIN:"The batch changed while you were reviewing it. Refresh stock and recount again.",
  INVALID_CONFIRMATION:"This review is no longer valid. Please create a new review.",TOO_MANY_ATTEMPTS:"Too many attempts. Please wait 15 minutes before trying again.",DAILY_LIMIT_REACHED:"Daily AI limit reached. Continue with the manual form below; limits reset tomorrow.",
  PRODUCT_UNAVAILABLE:"This product is no longer available. Pick another product.",REGULATED_PRODUCT:"Medicines and regulated goods cannot be added here.",DUPLICATE_PRODUCT:"This product is already in the list. Please use the existing one.",PRODUCT_DAILY_LIMIT:"You have added 10 new products today. Please try again tomorrow.",INVALID_PRODUCT_NAME:"Give the product a name between 2 and 80 characters.",INVALID_PRODUCT_BRAND:"Keep the brand within 80 characters.",INVALID_PRODUCT_VARIANT:"Keep the variant within 40 characters.",INVALID_PRODUCT_SIZE:"Give the size within 40 characters, for example 70g.",INVALID_PRODUCT_UNIT:"Choose piece, pack, carton or bottle.",INVALID_PRODUCT_CATEGORY:"Choose a valid product category.",PHOTO_REQUIRED:"A photo is required to add a product.",IMAGE_TYPE_UNSUPPORTED:"Please choose a JPEG, PNG or WebP photo.",IMAGE_TOO_LARGE:"That photo is too large. Try a smaller one.",IMAGE_UNREADABLE:"That photo could not be read. Try another one.",IMAGE_METADATA_PRESENT:"That photo still has hidden location data. Please retake it in the app.",NOT_A_PRODUCT:"That photo does not show a product. Please retake it.",
  UNDO_EXPIRED:"That entry is older than a minute and can no longer be undone. Correct it with a recount.",UNDO_BLOCKED:"This entry cannot be undone because stock changed afterwards. Correct it with a recount.",AUDIO_UNREADABLE:"This audio file could not be decoded in your browser. Try a WAV or MP3 file instead.",OPENING_EXISTS:"Opening stock already exists for this product. Use restock or recount instead.",INVALID_DATE:"Enter a valid date.",
  INVALID_BATCH:"Choose the correct batch for this product.",AUDIO_LIMIT_30_SECONDS:"Keep recordings to 30 seconds or less.",INVALID_WAV:"The recording could not be read. Try another recording or type instead.",
};
async function api<T>(path:string,options?:RequestInit):Promise<T> {
  const response=await fetch(path,{...options,signal:AbortSignal.timeout(40000),cache:"no-store"});
  const data=await response.json();
  if(!response.ok)throw new Error(data.error?.code||"REQUEST_FAILED");
  return data as T;
}
const post=<T,>(path:string,body:unknown)=>api<T>(path,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(body)});
const label=(p:{brand:string;name:string;size:string})=>`${p.brand} ${p.name} · ${p.size}`;
const friendly=(error:unknown)=>error instanceof Error?(messages[error.message]||(error.name==="TimeoutError"?"The connection timed out. Retry the same review to avoid recording twice.":"Could not finish this request. Check the connection and try again.")):"Could not finish this request.";
const time=(value:string)=>new Date(value).toLocaleString("en-NG",{dateStyle:"medium",timeStyle:"short",timeZone:"Africa/Lagos"});

export default function TraderWorkspace() {
  const [status,setStatus]=useState<{accountsConfigured:boolean;metaConfigured:boolean;textModel?:string;voiceModel?:string}|null>(null);
  const [authTab,setAuthTab]=useState<"login"|"signup">("login");
  const [account,setAccount]=useState({email:"",password:"",ownerName:"",shopName:"",landmark:"",latitude:"9.151",longitude:"7.324",demoNoticeAccepted:false}),[showPassword,setShowPassword]=useState(false),[capsOn,setCapsOn]=useState(false);
  const [shops,setShops]=useState<Shop[]>([]),[shopId,setShopId]=useState("");
  const [stock,setStock]=useState<Batch[]>([]),[events,setEvents]=useState<Event[]>([]),[products,setProducts]=useState<Product[]>([]);
  const [refresh,setRefresh]=useState(0),[busy,setBusy]=useState(""),[notice,setNotice]=useState(""),[receipt,setReceipt]=useState(""),[photoNotice,setPhotoNotice]=useState("");
  const [text,setText]=useState(""),[filter,setFilter]=useState(""),[productId,setProductId]=useState("");
  const [action,setAction]=useState<StockEntry["action"]>("sale"),[quantity,setQuantity]=useState("1"),[price,setPrice]=useState(""),[expiry,setExpiry]=useState("");
  const [batchId,setBatchId]=useState(""),[correction,setCorrection]=useState<string|null>(null),[review,setReview]=useState<Review|null>(null);
  const [clarification,setClarification]=useState(""),[clarified,setClarified]=useState(false),[suggestedUnit,setSuggestedUnit]=useState<string|null>(null),[unitChecked,setUnitChecked]=useState(false);
  const [recording,setRecording]=useState(false),[audioConsent,setAudioConsent]=useState(false);const [processed,setProcessed]=useState<{transcript:string;action:string;quantity:string;unit:string;item:string}|null>(null);
  const [locating,setLocating]=useState(false),[pinFromDevice,setPinFromDevice]=useState(false);
  const [actionPreset,setActionPreset]=useState<"sale"|"restock"|"recount"|null>(null),[askAction,setAskAction]=useState<{highlight:"sale"|"restock"|null;heard:string|null}|null>(null),[undo,setUndo]=useState<{commandId:string;left:number}|null>(null);
  const [addPhoto,setAddPhoto]=useState<NewProductFlow>(null);
  const discardRecording=useRef(false);
  const recorder=useRef<MediaRecorder|null>(null),stream=useRef<MediaStream|null>(null),recordTimer=useRef<ReturnType<typeof setTimeout>|null>(null),mounted=useRef(true);
  const noticeRef=useRef<HTMLDivElement|null>(null),photoNoticeRef=useRef<HTMLParagraphElement|null>(null),rejectedPhoto=useRef<string|null>(null),awaySince=useRef<number|null>(null);
  const product=products.find(p=>p.id===productId),shop=shops.find(s=>s.id===shopId);
  const mismatch=Boolean(product&&suggestedUnit&&product.unit!==suggestedUnit);

  useEffect(()=>{
    let active=true;mounted.current=true;
    api<{accountsConfigured:boolean;metaConfigured:boolean;textModel?:string;voiceModel?:string}>("/api/status").then(value=>{if(active)setStatus(value);}).catch(()=>{if(active)setNotice("Could not reach the account service. Please refresh shortly.");});
    api<{shops:Shop[]}>("/api/auth/session").then(data=>{if(active){setShops(data.shops);setShopId(data.shops[0]?.id||"");}}).catch(()=>{});
    return()=>{active=false;mounted.current=false;if(recordTimer.current)clearTimeout(recordTimer.current);if(recorder.current?.state==="recording")recorder.current.stop();stream.current?.getTracks().forEach(t=>t.stop());};
  },[]);
  useEffect(()=>{
    if(!shopId)return;let active=true;
    async function load() {
      try {
        const inventory=await api<{stock:Batch[];events:Event[]}>(`/api/shops/${shopId}/stock`);
        const catalog:Product[]=[];let offset:number|null=0;
        do {const page:{products:Product[];nextOffset:number|null}=await api<{products:Product[];nextOffset:number|null}>(`/api/products?scope=shop&offset=${offset}`);catalog.push(...page.products);offset=page.nextOffset;}while(offset!==null&&catalog.length<1000);
        if(active){setStock(inventory.stock);setEvents(inventory.events);setProducts(catalog);}
      } catch(error){if(active)setNotice(friendly(error));}
    }
    void load();return()=>{active=false;};
  },[shopId,refresh]);
  useEffect(()=>{
    if(!undo)return;
    const timer=setTimeout(()=>setUndo(u=>u&&u.left>1?{...u,left:u.left-1}:null),1000);
    return()=>clearTimeout(timer);
  },[undo]);
  useEffect(()=>{noticeRef.current?.scrollIntoView({block:"nearest"});},[notice,receipt]);
  useEffect(()=>{photoNoticeRef.current?.scrollIntoView({block:"nearest"});},[photoNotice]);
  useEffect(()=>{
    const mark=()=>{awaySince.current=Date.now();};
    const back=()=>{if(shouldHideAfterBlur(awaySince.current,Date.now()))setShowPassword(false);awaySince.current=null;};
    const vis=()=>{if(document.hidden)mark();else back();};
    window.addEventListener("blur",mark);window.addEventListener("focus",back);document.addEventListener("visibilitychange",vis);
    return()=>{window.removeEventListener("blur",mark);window.removeEventListener("focus",back);document.removeEventListener("visibilitychange",vis);};
  },[]);

  function setShopPin(){
    if(!("geolocation" in navigator)){setNotice(locationErrorMessage(2,"keep the demo pin"));return;}
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      position=>{setAccount(a=>({...a,latitude:String(Number(position.coords.latitude.toFixed(6))),longitude:String(Number(position.coords.longitude.toFixed(6)))}));setPinFromDevice(true);setLocating(false);setNotice("Shop location set from your device.");},
      error=>{setLocating(false);setNotice(locationErrorMessage(error.code,"keep the demo pin"));},
      {timeout:15000,maximumAge:60000});
  }
  async function authenticate(event:React.FormEvent) {
    event.preventDefault();setBusy("account");setNotice("");
    try {
      const body=authTab==="signup"?{...account,latitude:Number(account.latitude),longitude:Number(account.longitude)}:{email:account.email,password:account.password};
      await post(`/api/auth/${authTab}`,body);
      const session=await api<{shops:Shop[]}>("/api/auth/session");setShops(session.shops);setShopId(session.shops[0]?.id||"");
      setAccount(a=>({...a,password:""}));setShowPassword(false);setCapsOn(false);
    } catch(error){setNotice(friendly(error));} finally{setBusy("");}
  }
  async function signOut() {
    setBusy("logout");
    try {await api("/api/auth/session",{method:"DELETE"});setShops([]);setShopId("");setStock([]);setEvents([]);setProducts([]);setReview(null);setText("");setReceipt("");setNotice("");setShowPassword(false);setCapsOn(false);}
    catch(error){setNotice(friendly(error));}finally{setBusy("");}
  }
  function changeProduct(id:string) {setExpiry("");setProductId(id);setBatchId("");setCorrection(null);setReview(null);setUnitChecked(false);}
  const actionLabel={sale:"Sale",restock:"Restock",recount:"Recount"} as const;
  function actionIcon(value:"sale"|"restock"|"recount"){
    if(value==="sale")return <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true"><path d="M9 2v10m0 0L5 8m4 4l4-4M3 15h12" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"/></svg>;
    if(value==="restock")return <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true"><path d="M9 16V6m0 0L5 10m4-4l4 4M3 3h12" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"/></svg>;
    return <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true"><rect x="2" y="2" width="14" height="14" rx="3" stroke="currentColor" strokeWidth="2" fill="none"/><path d="M6 9l3 3 5-6" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"/></svg>;
  }
  function pickAction(value:"sale"|"restock"|"recount"){setActionPreset(value);setAction(value);setAskAction(null);setNotice(`Action set to ${actionLabel[value]}. Say or type just the product and quantity.`);}
  function actionButtons(highlight:"sale"|"restock"|"recount"|null){
    return (["sale","restock","recount"] as const).map(value=><button key={value} type="button" className={`action-pick${value===highlight?" suggested":""}`} aria-pressed={actionPreset===value} onClick={()=>pickAction(value)}>{actionIcon(value)}<span>{actionLabel[value]}</span></button>);
  }
  async function interpret() {
    setBusy("interpret");setNotice("");setReview(null);
    try {
      const {text:cleaned}=cleanEntryText(text);
      if(!cleaned.trim()){setNotice("Say or type the product and quantity first.");return;}
      const {extraction:e}=await post<{extraction:ExtractedEntry}>("/api/entries/interpret",{shopId,text:cleaned,...(actionPreset?{actionPreset}:{})});
      if(e.action)setAction(e.action);setQuantity(e.quantity===null?"":String(e.quantity));setPrice(e.unitPriceNaira||"");
      setFilter(e.item);changeProduct("");setSuggestedUnit(e.unit);setClarified(false);setProcessed(p=>({transcript:p?.transcript||"",action:e.action||"unclear",quantity:e.quantity===null?"unclear":String(e.quantity),unit:e.unit||"unclear",item:e.item||"unclear"}));
      setClarification(e.needsClarification?(e.question||"Some details are unclear. Correct the fields below before reviewing."):"");
      if(e.needsClarification&&!e.action){const guess=likelyAction(text);setAskAction({highlight:guess?.action??null,heard:guess?.heard??null});}else setAskAction(null);
      setNotice("Check the suggested details and choose the exact product below. Nothing has been saved.");
    }catch(error){setNotice(friendly(error));}finally{setBusy("");}
  }
  async function prepare(event:React.FormEvent) {
    event.preventDefault();setNotice("");setReceipt("");
    if(!product){setNotice("Choose the exact product and pack size first.");return;}
    if(clarification&&!clarified){setNotice("Resolve the unclear details before reviewing.");return;}
    if(askAction){setNotice("Choose the action first: Sale, Restock or Recount.");return;}
    if(mismatch&&!unitChecked){setNotice(`Confirm that the quantity is in ${product.unit}s, not ${suggestedUnit}s.`);return;}
    const count=Number(quantity);
    if(!quantity.trim()||!Number.isSafeInteger(count)||count<0||count>100000||(["sale","restock"].includes(action)&&count===0)){setNotice("Enter a whole quantity within 0–100,000; sales and restocks must be above zero.");return;}
    setBusy("prepare");
    try {
      const entry={productId,action,quantity:count,batchId:action==="recount"?batchId:null,correctsEventId:action==="recount"?correction:null,
        expiryDate:["opening","restock"].includes(action)&&expiry?expiry:null,unitPriceKobo:action==="recount"?null:nairaToKobo(price)};
      setReview(await post<Review>("/api/entries/prepare",{shopId,entry}));
    }catch(error){setNotice(error instanceof Error&&error.message.startsWith("Use a price")?error.message:friendly(error));}finally{setBusy("");}
  }
  function unitIcon(value:string){
    if(value==="piece")return <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true"><rect x="5" y="5" width="8" height="8" stroke="currentColor" strokeWidth="2" fill="none"/></svg>;
    if(value==="pack")return <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true"><g stroke="currentColor" strokeWidth="1.6" fill="none"><rect x="3" y="3" width="5" height="5"/><rect x="10" y="3" width="5" height="5"/><rect x="3" y="10" width="5" height="5"/><rect x="10" y="10" width="5" height="5"/></g></svg>;
    if(value==="carton")return <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true"><path d="M3 6l6-3 6 3v9l-6 3-6-3zM3 6l6 3 6-3M9 9v9" stroke="currentColor" strokeWidth="1.6" fill="none" strokeLinejoin="round"/></svg>;
    return <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true"><path d="M7 2h4v3l2 3v7a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V8l2-3z" stroke="currentColor" strokeWidth="1.6" fill="none" strokeLinejoin="round"/></svg>;
  }
  function unitButtons(selected:string,guess:string|null,onPick:(u:string)=>void){
    return (["piece","pack","carton","bottle"] as const).map(u=><button key={u} type="button" className={`action-pick${u===guess&&u!==selected?" suggested":""}`} aria-pressed={selected===u} onClick={()=>onPick(u)}>{unitIcon(u)}<span>{u[0].toUpperCase()+u.slice(1)}</span></button>);
  }
  async function postPhoto(url:string,bytes:Uint8Array<ArrayBuffer>,mime:string){
    const response=await fetch(url,{method:"POST",headers:{"Content-Type":mime},body:bytes,cache:"no-store",signal:AbortSignal.timeout(90000)});
    const data=await response.json().catch(()=>null);if(!response.ok)throw new Error(data?.error?.code||"REQUEST_FAILED");return data;
  }
  function closePhotoPanel(){
    if(addPhoto&&addPhoto.stage!=="capture"){
      URL.revokeObjectURL(addPhoto.photo.url);
      if((addPhoto.stage==="preview"||addPhoto.stage==="proposal")&&addPhoto.back)URL.revokeObjectURL(addPhoto.back.url);
    }
    rejectedPhoto.current=null;setPhotoNotice("");setAddPhoto(null);
  }
  async function capturePhoto(file:File,which:"photo"|"back"){
    if(!addPhoto)return;setBusy("photo");setPhotoNotice("");
    try {
      const prepared=await prepareProductPhoto(file);
      const bytes=new Uint8Array(prepared.bytes);
      const data={bytes,url:URL.createObjectURL(new Blob([bytes],{type:"image/jpeg"}))};
      if(addPhoto.stage==="preview"){const old=which==="back"?addPhoto.back:addPhoto.photo;if(old)URL.revokeObjectURL(old.url);}
      rejectedPhoto.current=null;
      setAddPhoto(flow=>{
        if(!flow)return flow;
        if(flow.stage==="capture")return {stage:"preview",hint:flow.hint,photo:data,back:null};
        if(flow.stage==="preview")return which==="back"?{...flow,back:data}:{...flow,photo:data};
        return flow;
      });
    }catch(error){setPhotoNotice(friendly(error));}finally{setBusy("");}
  }
  async function analyzePhotos(){
    if(!addPhoto||addPhoto.stage!=="preview")return;
    const sig=`${addPhoto.photo.bytes.length}:${Array.from(addPhoto.photo.bytes.slice(0,8)).join(",")}`;
    if(rejectedPhoto.current===sig){setPhotoNotice("That photo was already rejected. Take a different photo or tap Cancel.");return;}
    setBusy("photo");setPhotoNotice("");
    try {
      const first=await postPhoto("/api/images/analyze",addPhoto.photo.bytes,"image/jpeg");
      let proposal:ImageProposal=first.proposal;
      if(addPhoto.back){
        const second=await postPhoto("/api/images/analyze",addPhoto.back.bytes,"image/jpeg");
        proposal=mergeProposals(proposal,second.proposal);
      }
      if(isRegulatedProduct({name:proposal.name||"",brand:proposal.brand||"",category:proposal.category||""})){closePhotoPanel();setNotice(friendly(new Error("REGULATED_PRODUCT")));return;}
      setAddPhoto({stage:"proposal",hint:addPhoto.hint,photo:addPhoto.photo,back:addPhoto.back,proposal:polishProposal(proposal)});
    }catch(error){
      if(error instanceof Error&&error.message==="NOT_A_PRODUCT"){rejectedPhoto.current=sig;setPhotoNotice(friendly(error));return;}
      const photo=addPhoto.photo;
      setAddPhoto({stage:"typed",hint:addPhoto.hint,photo,typedName:"",typedBrand:"",typedSize:"",unit:"piece"});
      setPhotoNotice("The photo could not be read. Type the name instead.");
    }finally{setBusy("");}
  }
  function answerProposal(yes:boolean){
    if(!addPhoto||addPhoto.stage!=="proposal")return;
    if(!yes){setAddPhoto({stage:"typed",hint:addPhoto.hint,photo:addPhoto.photo,typedName:"",typedBrand:"",typedSize:"",unit:addPhoto.proposal.unit||"piece"});setPhotoNotice("Describe it yourself. Nothing has been saved.");return;}
    setAddPhoto({stage:"units",hint:addPhoto.hint,photo:addPhoto.photo,proposal:addPhoto.proposal,unit:addPhoto.proposal.unit||"piece"});
  }
  function continueToDuplicates(){
    if(!addPhoto||addPhoto.stage!=="units")return;
    const closest=findClosestProducts(catalogWords(`${addPhoto.proposal.name||""} ${addPhoto.proposal.brand||""}`),products);
    setAddPhoto({stage:"duplicates",hint:addPhoto.hint,photo:addPhoto.photo,proposal:addPhoto.proposal,unit:addPhoto.unit,closest});
  }
  async function saveCustom(typed:boolean){
    const flow=addPhoto;
    if(!flow||(flow.stage!=="duplicates"&&flow.stage!=="typed"))return;
    setBusy("photo");setPhotoNotice("");
    try {
      const polished=flow.stage==="duplicates"?flow.proposal:polishProposal({name:flow.typedName,brand:flow.typedBrand,size:flow.typedSize,unit:flow.unit,category:""});
      const fields={name:polished.name,brand:polished.brand,variant:polished.variant,size:polished.size||"Standard",unit:flow.unit,category:polished.category};
      try {validateCustomProduct(fields);} catch(error){setPhotoNotice(friendly(error));return;}
      const form=new FormData();
      form.set("shopId",shopId);form.set("name",fields.name);form.set("brand",fields.brand);form.set("variant",fields.variant);form.set("size",fields.size);form.set("unit",fields.unit);form.set("category",fields.category);
      if(typed)form.set("typed","true");
      form.set("photo",new Blob([flow.photo.bytes],{type:"image/jpeg"}),"photo.jpg");
      const response=await fetch("/api/products/custom",{method:"POST",body:form,cache:"no-store",signal:AbortSignal.timeout(60000)});
      const data=await response.json().catch(()=>null);
      if(!response.ok)throw new Error(data?.error?.code||"REQUEST_FAILED");
      closePhotoPanel();changeProduct(data.product.id);setFilter("");setAction("restock");setActionPreset("restock");setAskAction(null);setRefresh(v=>v+1);
      setNotice(data.message||"Saved.");
    }catch(error){setPhotoNotice(friendly(error));}finally{setBusy("");}
  }
  async function undoEntry() {
    if(!undo)return;setBusy("undo");setNotice("");
    try {
      const result=await post<{estimatedQty:number}>("/api/entries/undo",{shopId,commandId:undo.commandId});
      setReceipt(`Entry undone. The reversal is recorded in history; estimate is now ${result.estimatedQty}.`);setUndo(null);setRefresh(v=>v+1);
    }catch(error){setNotice(friendly(error));if(error instanceof Error&&["UNDO_EXPIRED","UNDO_BLOCKED"].includes(error.message))setUndo(null);}finally{setBusy("");}
  }
  async function confirm() {
    if(!review)return;setBusy("confirm");setNotice("");
    try {
      const result=await post<{estimatedQty:number;replayed:boolean;commandId:string}>("/api/entries/confirm",{token:review.token});
      setReceipt(result.replayed?"This entry was already recorded. No second change was made.":`${review.entry.action==="recount"?"Recount":"Stock entry"} recorded. ${label(review.product)}: ${result.estimatedQty} ${pluralizeUnit(review.product.unit,result.estimatedQty)} estimated across batches.`);
      setReview(null);setCorrection(null);setRefresh(v=>v+1);setUndo(!result.replayed&&result.commandId?{commandId:result.commandId,left:60}:null);setText("");setFilter("");setQuantity("1");setPrice("");setExpiry("");setAction("sale");setActionPreset(null);setAskAction(null);setBatchId("");setClarification("");setClarified(false);setProcessed(null);setSuggestedUnit(null);setUnitChecked(false);
    }catch(error){setNotice(friendly(error));if(error instanceof Error&&["CONFIRMATION_EXPIRED","STOCK_CHANGED_REVIEW_AGAIN","INVALID_CONFIRMATION"].includes(error.message))setReview(null);}
    finally{setBusy("");}
  }
  async function sendAudio(blob:Blob) {
    if(!mounted.current)return;setBusy("voice");setNotice("");
    try {
      if(blob.size>4000000)throw new Error("AUDIO_LIMIT_30_SECONDS");
      const context=new AudioContext();
      let decoded:AudioBuffer;
      try {decoded=await context.decodeAudioData(await blob.arrayBuffer());}catch{throw new Error("AUDIO_UNREADABLE");}finally{await context.close();}
      if(decoded.duration>30.2||decoded.duration<=0)throw new Error("AUDIO_LIMIT_30_SECONDS");
      const offline=new OfflineAudioContext(1,Math.ceil(decoded.duration*24000),24000),source=offline.createBufferSource();
      source.buffer=decoded;source.connect(offline.destination);source.start();
      const rendered=await offline.startRendering();
      const cleaned=trimSilence(normaliseVolume(rendered.getChannelData(0)));
      if(cleaned.length<7200)throw new Error("NO_CLEAR_TRANSCRIPT");
      const wav=pcmToWav(cleaned);
      const {transcript}=await api<{transcript:string}>(`/api/entries/transcribe?shopId=${shopId}`,{method:"POST",headers:{"Content-Type":"audio/wav"},body:new Uint8Array(wav)});
      if(mounted.current){setText(transcript);setProcessed(p=>({transcript,action:p?.action||"",quantity:p?.quantity||"",unit:p?.unit||"",item:p?.item||""}));setNotice("Transcript ready. Check or edit the words in the text box before interpreting. Nothing has been saved.");}
    }catch(error){if(mounted.current)setNotice(friendly(error));}finally{if(mounted.current)setBusy("");}
  }
  async function startRecording() {
    if(!audioConsent){setNotice("Confirm you want to send audio to Meta first.");return;}
    try {
      if(!navigator.mediaDevices?.getUserMedia||typeof MediaRecorder==="undefined"){setNotice("Recording is unavailable in this browser. Upload a short audio file or type instead.");return;}
      stream.current=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:true,noiseSuppression:true,autoGainControl:true}});
      const instance=new MediaRecorder(stream.current),chunks:Blob[]=[];recorder.current=instance;discardRecording.current=false;
      instance.ondataavailable=e=>{if(e.data.size)chunks.push(e.data);};
      instance.onstop=()=>{if(recordTimer.current)clearTimeout(recordTimer.current);stream.current?.getTracks().forEach(t=>t.stop());if(mounted.current){setRecording(false);if(!discardRecording.current)void sendAudio(new Blob(chunks,{type:instance.mimeType}));}chunks.length=0;};
      instance.start();setRecording(true);recordTimer.current=setTimeout(()=>{if(instance.state==="recording")instance.stop();},29000);
    }catch{stream.current?.getTracks().forEach(t=>t.stop());setNotice("Microphone permission was unavailable. You can upload a file or type instead.");}
  }
  const filtered=products.filter(p=>filter.toLowerCase().split(/\s+/).filter(Boolean).every(word=>`${p.brand} ${p.name} ${p.variant} ${p.size}`.toLowerCase().includes(word)));
  const ownedBatches=stock.filter(b=>b.product_id===productId);

  return <div className="workspace">
    <header className="topbar"><Link className="brand" href="/"><span className="brand-mark">M</span><span>AI Market<span className="brand-light"> Assistant</span></span></Link><span className="demo-badge">DEMO · SIMULATED DATA</span><Link className="buyer-trader-link" href="/buyer">Browse market ↗</Link>{shop&&<button className="text-button" onClick={signOut} disabled={Boolean(busy)||recording}>Sign out</button>}</header>
    {!shop?<main className="auth-layout">
      <section className="welcome"><span className="eyebrow">MADE FOR LOCAL TRADE</span><h1>Your next customer<br/>should find you.</h1><p>Keep your stock fresh, spend less time with the notebook, and help nearby buyers find what they need.</p><div className="benefits"><div><span>01</span><p><strong>Say it. Check it. Save it.</strong><br/>Record a sale or restock with text or a short voice note.</p></div><div><span>02</span><p><strong>A clearer picture of your shelves.</strong><br/>Track stock estimates and recount when something changes.</p></div><div><span>03</span><p><strong>Let your shop be found.</strong><br/>Nearby buyers can search your estimated stock without creating an account.</p></div></div><small>Kubwa demo · provision shops · one owner per shop</small></section>
      <section className="auth-card" aria-label="Trader account"><div className="tabs"><button className={authTab==="login"?"active":""} onClick={()=>{setAuthTab("login");setNotice("");}}>Sign in</button><button className={authTab==="signup"?"active":""} onClick={()=>{setAuthTab("signup");setNotice("");}}>Create trader account</button></div><h2>{authTab==="login"?"Welcome back":"Bring your shop online"}</h2><p className="muted">{authTab==="login"?"Sign in to your shop’s private workspace.":"Create your trader account and add your first provision shop."}</p>
        {status&&!status.accountsConfigured&&<p className="connection-note">The account service is not connected yet. Signup and stock saves will become available after the database is connected.</p>}
        {notice&&<p className="notice" role="status">{notice}</p>}
        <form onSubmit={authenticate} className="form-stack">
          {authTab==="signup"&&<><label>Your name<input required maxLength={120} autoComplete="name" value={account.ownerName} onChange={e=>setAccount({...account,ownerName:e.target.value})}/></label><label>Shop name<input required maxLength={120} value={account.shopName} onChange={e=>setAccount({...account,shopName:e.target.value})}/></label></>}
          <label>Email<input type="email" required autoComplete="email" value={account.email} onChange={e=>setAccount({...account,email:e.target.value})}/></label>
          <label>Password<span className="password-row"><input type={showPassword?"text":"password"} required minLength={10} maxLength={128} autoComplete={authTab==="signup"?"new-password":"current-password"} value={account.password} onChange={e=>setAccount({...account,password:e.target.value})} onKeyDown={e=>setCapsOn(e.getModifierState("CapsLock"))} onKeyUp={e=>setCapsOn(e.getModifierState("CapsLock"))} onBlur={()=>setCapsOn(false)}/><button type="button" className="password-toggle" aria-pressed={showPassword} aria-label={showPassword?"Hide password":"Show password"} onClick={()=>setShowPassword(v=>!v)}>{showPassword?"Hide":"Show"}</button></span><span className="hint">At least 10 characters. Password recovery is not available in this demo.</span>{capsOn&&<span className="hint" role="status">Caps Lock is on</span>}</label>
          {authTab==="signup"&&<><label>Nearest landmark<input required maxLength={120} placeholder="e.g. near the market junction" value={account.landmark} onChange={e=>setAccount({...account,landmark:e.target.value})}/></label><div className="inline-actions"><button type="button" className="secondary" disabled={Boolean(busy)||locating} onClick={setShopPin}>{locating?"Reading your location…":"Set my shop location here"}</button></div><span className="hint">Shop pin: {account.latitude}, {account.longitude}{pinFromDevice?" (from your device)":" (illustrative Kubwa demo pin)"}. This demo does not verify shop locations.</span><label className="check"><input type="checkbox" required checked={account.demoNoticeAccepted} onChange={e=>setAccount({...account,demoNoticeAccepted:e.target.checked})}/><span>This is a demo. I will use fictitious trader and shop details.</span></label></>}
          <button className="primary" disabled={Boolean(busy)||!status?.accountsConfigured}>{busy==="account"?"Please wait…":authTab==="login"?"Sign in to your shop":"Create trader account"}</button>
        </form>
      </section>
    </main>:<main className="dashboard">
      <div className="dashboard-heading"><div><span className="eyebrow">TRADER WORKSPACE</span><h1>{shop.name}</h1><p className="muted">{shop.landmark}</p></div><button className="secondary" onClick={()=>setRefresh(v=>v+1)} disabled={Boolean(busy)}>Refresh stock</button></div>
      {shops.length>1&&<label>Choose your shop<select value={shopId} onChange={e=>{setShopId(e.target.value);setReview(null);setReceipt("");}}>{shops.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select></label>}
      <div className="stats"><div><span>Products with stock</span><strong>{new Set(stock.filter(b=>b.estimated_qty>0).map(b=>b.product_id)).size}</strong></div><div><span>Batches tracked</span><strong>{stock.length}</strong></div><div><span>Location status</span><strong className="small-stat">{shop.location_verified?"Verified":"Needs verification"}</strong></div></div>
      {/* Entry messages render inside the record panel, next to the actions. */}
      <StockInsights key={shopId} shopId={shopId} refresh={refresh}/><div className="work-grid"><section className="panel"><div ref={noticeRef}>{notice&&<p className="notice" role="status">{notice}</p>}{receipt&&<p className="success" role="status">{receipt}</p>}{undo&&<div className="inline-actions"><button className="secondary" disabled={Boolean(busy)} onClick={undoEntry}>Undo this entry ({undo.left}s)</button></div>}</div><span className="eyebrow">RECORD AN UPDATE</span><h2>What changed in your shop?</h2><p className="muted">One product at a time. Every update is reviewed before it is saved.</p>
        <div className="action-first" role="group" aria-label="Choose the action first"><span className="hint">First, what happened?</span><div className="inline-actions">{actionButtons(null)}</div></div><label className="text-entry">Type a sale, restock or recount<textarea maxLength={2000} rows={3} placeholder="Sold 3 packs of Indomie chicken noodles, 70g" value={text} onChange={e=>setText(e.target.value)}/></label>
        <div className="inline-actions"><button className="secondary" disabled={Boolean(busy)||recording||!text.trim()||!status?.metaConfigured} onClick={interpret}>{busy==="interpret"?"Understanding…":"Interpret entry"}</button><span className="hint">{status?.metaConfigured?"Check every suggested field.":"AI is not connected. Use the manual form below."}</span></div>
        <details className="voice"><summary>Use a short voice note</summary><p className="hint">Up to 30 seconds. Audio is sent to Meta for transcription and is not stored by this app. WhatsApp voice notes (.ogg) work: they are decoded and converted in your browser before upload. English/Pidgin accuracy still needs live testing.</p><label className="check"><input type="checkbox" checked={audioConsent} onChange={e=>{setAudioConsent(e.target.checked);if(!e.target.checked&&recording){discardRecording.current=true;recorder.current?.stop();}}}/><span>I agree to send this recording to Meta for transcription.</span></label><div className="inline-actions"><button className="secondary" disabled={Boolean(busy)||!audioConsent||!status?.metaConfigured} onClick={()=>recording?recorder.current?.stop():void startRecording()}>{recording?"Stop recording":"Record voice note"}</button><label className="file-label">Or upload audio<input aria-label="Upload a short audio recording" type="file" accept="audio/wav,audio/mpeg,audio/mp4,audio/ogg,audio/opus,audio/webm,.wav,.mp3,.m4a,.ogg,.opus,.webm" disabled={Boolean(busy)||recording||!audioConsent||!status?.metaConfigured} onChange={e=>{const file=e.target.files?.[0];e.target.value="";if(file)void sendAudio(file);}}/></label></div>{recording&&<><button className="text-button" onClick={()=>{discardRecording.current=true;recorder.current?.stop();}}>Discard recording</button><p role="status">Recording… stops automatically before 30 seconds.</p></>}{busy==="voice"&&<p role="status">Transcribing your recording…</p>}</details>{processed&&<section className="review" aria-label="How this was processed"><h3>How this was processed</h3><p className="hint">Transcript is editable in the text box above. Nothing is saved until you confirm.</p><dl><div><dt>Transcript</dt><dd>{processed.transcript||"Typed entry (no recording)"}</dd></div><div><dt>Parsed</dt><dd>{processed.action||"-"} | {processed.quantity||"-"} {processed.unit||""} | {processed.item||"-"}</dd></div><div><dt>Models</dt><dd>{status?.textModel||"muse-spark-1.3"} (extract) + {status?.voiceModel||"muse-voice-transcribe-1.0"} (transcribe)</dd></div></dl></section>}
        {askAction&&<section className="review" aria-label="Choose the action"><h3>Which action did you mean?</h3><p>{askAction.heard?`I heard \u201C${askAction.heard}\u201D. Did you mean ${askAction.highlight==="sale"?"Sale":"Restock"}?`:"The action was unclear, so nothing was applied. Tap the right one."}</p><div className="inline-actions">{actionButtons(askAction.highlight)}</div></section>}
        <div className="divider"/><h3>Check or enter the details</h3>
        {clarification&&<div className="clarification"><p>{clarification}</p><label className="check"><input type="checkbox" checked={clarified} onChange={e=>setClarified(e.target.checked)}/><span>I have resolved the unclear details below.</span></label></div>}
        <form className="form-stack" onSubmit={prepare} onChange={()=>setReview(null)}>
          <label>Find a product<input placeholder="Brand, name or pack size" value={filter} onChange={e=>setFilter(e.target.value)}/></label>
          <label>Exact product and size<select required value={productId} onChange={e=>changeProduct(e.target.value)}><option value="">Choose a product</option>{filtered.map(p=><option key={p.id} value={p.id}>{label(p)} · {p.unit}</option>)}</select></label>{!filtered.length&&filter.trim()&&<div className="add-photo-cta"><button type="button" className="primary" onClick={()=>setAddPhoto({stage:"capture",hint:filter})}>Not in your list. Add it with a photo</button></div>}{!filtered.length&&!filter.trim()&&<p className="hint">No products in the catalog yet.</p>}
          <div className="field-row"><label>Action<select value={action} onChange={e=>{setAction(e.target.value as StockEntry["action"]);setCorrection(null);setActionPreset(null);}}><option value="sale">Sale</option><option value="restock">Restock</option><option value="recount">Recount / correction</option><option value="opening">Opening stock</option></select></label><label>{action==="recount"?"Physical batch count":"Quantity"}{product?` (${product.unit})`:""}<input required type="number" step={1} min={action==="sale"||action==="restock"?1:0} max={100000} value={quantity} onChange={e=>{setQuantity(e.target.value);setUnitChecked(false);}}/></label></div>
          {mismatch&&<label className="check"><input type="checkbox" checked={unitChecked} onChange={e=>setUnitChecked(e.target.checked)}/><span>The suggestion used {suggestedUnit}s. I corrected the quantity to {product?.unit}s. No automatic pack conversion is applied.</span></label>}
          {action==="recount"?<><label>Batch being counted<select required value={batchId} onChange={e=>{setBatchId(e.target.value);setCorrection(null);}}><option value="">Choose the batch</option>{ownedBatches.map(b=><option key={b.batch_id} value={b.batch_id}>{b.expiry_date?`Expires ${b.expiry_date.slice(0,10)}`:"No expiry recorded"} · estimated {b.estimated_qty}</option>)}</select></label>{correction&&<p className="hint">This recount will reference the selected recent entry. The old entry stays in the history.</p>}</>:<label>Price per {product?.unit||"selling unit"} (₦, optional)<input inputMode="decimal" placeholder="e.g. 250.00" value={price} onChange={e=>setPrice(e.target.value)}/></label>}
          {["opening","restock"].includes(action)&&product?.perishable&&<label>Batch expiry (optional)<input type="date" value={expiry} onChange={e=>setExpiry(e.target.value)}/></label>}
          <button className="primary" disabled={Boolean(busy)||!product}>{busy==="prepare"?"Preparing review…":"Review this entry"}</button>
        </form>
        {addPhoto&&<section className="add-photo" aria-label="Add a product with a photo">
        {addPhoto.stage==="capture"&&<><h3>Add with a photo</h3><p className="hint">Take one clear photo of the product{addPhoto.hint.trim()?` (${addPhoto.hint.trim()})`:""}. Nothing is saved yet.</p><label className="file-label">Take a photo<input aria-label="Take a product photo" type="file" accept="image/*" capture="environment" disabled={Boolean(busy)} onChange={e=>{const file=e.target.files?.[0];if(file)void capturePhoto(file,"photo");e.target.value="";}}/></label>{photoNotice&&<p className="notice" role="status" ref={photoNoticeRef}>{photoNotice}</p>}<div className="inline-actions"><button className="text-button" onClick={closePhotoPanel} disabled={Boolean(busy)}>Cancel</button></div></>}
        {addPhoto.stage==="preview"&&<><h3>Check the photo</h3><img className="preview" src={addPhoto.photo.url} alt="Product photo preview"/><div className="inline-actions"><button className="primary" disabled={Boolean(busy)} onClick={analyzePhotos}>{busy==="photo"?"Reading the photo…":"Read this photo"}</button></div>{photoNotice&&<p className="notice" role="status" ref={photoNoticeRef}>{photoNotice}</p>}{addPhoto.back?<img className="preview" src={addPhoto.back.url} alt="Back label preview"/>:<label className="file-label">Show the back (optional)<input aria-label="Take a back label photo" type="file" accept="image/*" capture="environment" disabled={Boolean(busy)} onChange={e=>{const file=e.target.files?.[0];if(file)void capturePhoto(file,"back");e.target.value="";}}/></label>}<div className="inline-actions"><button className="text-button" onClick={closePhotoPanel} disabled={Boolean(busy)}>Cancel</button></div></>}
        {addPhoto.stage==="proposal"&&<><h3>Is this right?</h3><img className="preview" src={addPhoto.photo.url} alt="Product photo"/><dl className="proposal-fields"><div><dt>Name</dt><dd>{addPhoto.proposal.name||"—"}</dd></div><div><dt>Brand</dt><dd>{addPhoto.proposal.brand||"—"}</dd></div><div><dt>Variant</dt><dd>{addPhoto.proposal.variant}</dd></div><div><dt>Size</dt><dd>{addPhoto.proposal.size||"—"}</dd></div><div><dt>Suggested unit</dt><dd>{addPhoto.proposal.unit||"piece"}</dd></div><div><dt>Category</dt><dd>{addPhoto.proposal.category||"provisions"}</dd></div></dl><div className="inline-actions"><button className="primary" disabled={Boolean(busy)} onClick={()=>answerProposal(true)}>Yes, continue</button><button className="secondary" disabled={Boolean(busy)} onClick={()=>answerProposal(false)}>No, describe it</button></div>{photoNotice&&<p className="notice" role="status" ref={photoNoticeRef}>{photoNotice}</p>}<div className="inline-actions"><button className="text-button" onClick={closePhotoPanel} disabled={Boolean(busy)}>Cancel</button></div></>}
        {addPhoto.stage==="units"&&<><h3>How is it sold?</h3><p className="hint">Tap the right unit. No typing needed.</p><div className="inline-actions">{unitButtons(addPhoto.unit,addPhoto.proposal.unit,u=>setAddPhoto(f=>f&&f.stage==="units"?{...f,unit:u}:f))}</div><div className="inline-actions"><button className="primary" disabled={Boolean(busy)} onClick={continueToDuplicates}>Continue</button><button className="text-button" onClick={closePhotoPanel} disabled={Boolean(busy)}>Cancel</button></div>{photoNotice&&<p className="notice" role="status" ref={photoNoticeRef}>{photoNotice}</p>}</>}
        {addPhoto.stage==="duplicates"&&<><h3>Is it one of these?</h3>{addPhoto.closest.length?addPhoto.closest.map(p=><div key={p.id} className="closest-row"><span>{label(p)}</span><button className="text-button" onClick={()=>{changeProduct(p.id);setFilter(label(p));closePhotoPanel();setNotice("Using the existing product. Nothing new was saved.");}} disabled={Boolean(busy)}>Use this</button></div>):<p className="hint">No close matches in your list.</p>}<div className="inline-actions"><button className="primary" disabled={Boolean(busy)} onClick={()=>saveCustom(false)}>{busy==="photo"?"Saving…":"No, add as new"}</button><button className="text-button" onClick={closePhotoPanel} disabled={Boolean(busy)}>Cancel</button></div>{photoNotice&&<p className="notice" role="status" ref={photoNoticeRef}>{photoNotice}</p>}</>}
        {addPhoto.stage==="typed"&&<><h3>Describe it yourself</h3><p className="hint">Type the product name. Nothing is saved until you tap Save.</p><label>Product name<input required maxLength={80} value={addPhoto.typedName} onChange={e=>setAddPhoto(f=>f&&f.stage==="typed"?{...f,typedName:e.target.value}:f)}/></label><div className="field-row"><label>Brand (optional)<input maxLength={80} value={addPhoto.typedBrand} onChange={e=>setAddPhoto(f=>f&&f.stage==="typed"?{...f,typedBrand:e.target.value}:f)}/></label><label>Size (optional)<input maxLength={40} placeholder="e.g. 70g" value={addPhoto.typedSize} onChange={e=>setAddPhoto(f=>f&&f.stage==="typed"?{...f,typedSize:e.target.value}:f)}/></label></div><p className="hint">How is it sold?</p><div className="inline-actions">{unitButtons(addPhoto.unit,null,u=>setAddPhoto(f=>f&&f.stage==="typed"?{...f,unit:u}:f))}</div><div className="inline-actions"><button className="primary" disabled={Boolean(busy)} onClick={()=>saveCustom(true)}>{busy==="photo"?"Saving…":"Save this product"}</button><button className="text-button" onClick={closePhotoPanel} disabled={Boolean(busy)}>Cancel</button></div>{photoNotice&&<p className="notice" role="status" ref={photoNoticeRef}>{photoNotice}</p>}</>}
      </section>}
      {review&&<section className="review" aria-label="Confirm stock entry"><h3>Ready to record?</h3><p><strong>{label(review.product)}</strong></p><dl><div><dt>Action</dt><dd>{review.entry.action}</dd></div><div><dt>{review.entry.action==="recount"?"New batch count":"Quantity"}</dt><dd>{review.entry.quantity} {pluralizeUnit(review.product.unit,review.entry.quantity)}</dd></div>{review.entry.unitPriceKobo!==null&&<div><dt>Unit price</dt><dd>{new Intl.NumberFormat("en-NG",{style:"currency",currency:"NGN"}).format(review.entry.unitPriceKobo/100)}</dd></div>}{review.entry.expiryDate&&<div><dt>Expiry</dt><dd>{review.entry.expiryDate}</dd></div>}</dl><p className="hint">Review expires after 10 minutes. Retries of this review do not create a second entry.</p><div className="inline-actions"><button className="primary" onClick={confirm} disabled={Boolean(busy)}>{busy==="confirm"?"Saving…":"Confirm and save"}</button><button className="text-button" onClick={()=>setReview(null)} disabled={Boolean(busy)}>Cancel</button></div></section>}
      </section><aside className="panel"><span className="eyebrow">ON YOUR SHELVES</span><h2>Estimated stock</h2><p className="muted">Counts are estimates. Recount a batch to confirm what is physically there.</p>{!stock.length?<div className="empty-state"><strong>No stock recorded yet</strong><p>Choose a product and use “Opening stock” to add your first batch.</p></div>:<div className="stock-list">{stock.map(b=><div className="stock-row" key={b.batch_id}><div><strong>{label(b)}</strong><p className="hint">{b.expiry_date?`Expiry ${b.expiry_date.slice(0,10)}`:"No expiry recorded"}</p><p className="hint">{b.confirmed_at?`Confirmed ${time(b.confirmed_at)}`:"Needs a recount"}</p></div><div className="stock-number"><strong>{b.estimated_qty}</strong><span>{pluralizeUnit(b.unit,b.estimated_qty)}</span><button className="text-button" disabled={Boolean(busy)} onClick={()=>{setFilter("");setProductId(b.product_id);setAction("recount");setBatchId(b.batch_id);setQuantity(String(b.estimated_qty));setCorrection(null);setReview(null);setClarification("");setSuggestedUnit(null);}}>Recount</button></div></div>)}</div>}
        <div className="divider"/><h3>Recent updates</h3>{!events.length?<p className="hint">Confirmed entries will appear here.</p>:<div className="history-list">{events.map(e=><div className="history-row" key={e.id}><div><strong>{e.event_type} · {e.qty_delta>0?"+":""}{e.qty_delta} {pluralizeUnit(e.unit,Math.abs(e.qty_delta))}</strong><p>{label(e)}</p><small>{time(e.event_at)}</small></div><button className="text-button" disabled={Boolean(busy)} onClick={()=>{setFilter("");setProductId(e.product_id);setAction("recount");setBatchId(e.batch_id);setQuantity("");setCorrection(e.id);setReview(null);setClarification("");setSuggestedUnit(null);}}>Correct by recount</button></div>)}</div>}
      </aside></div>
    </main>}
    <footer className="footer">AI Market Assistant · A local market, easier to find.<span>Demo only. Browse the market without a buyer account.</span></footer>
  </div>;
}

