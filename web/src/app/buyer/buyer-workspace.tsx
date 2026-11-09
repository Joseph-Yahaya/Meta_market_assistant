"use client";
import Link from "next/link";
import dynamic from "next/dynamic";
import { useCallback,useEffect,useRef,useState } from "react";
import VoiceQuery from "./voice-query";
import {catalogMatches,matchCatalogProducts} from "@/lib/catalog-match";
import {groupShopsByShop} from "@/lib/shop-groups";
import {directionsUrl} from "@/lib/directions";
import {widenMessage} from "@/lib/search-radius";
import {locationErrorMessage} from "@/lib/geolocation";
import type {BuyerResults,CatalogProduct,NearbyShop} from "./types";
import "leaflet/dist/leaflet.css";
const BuyerMap=dynamic(()=>import("./buyer-map"),{ssr:false,loading:()=> <div className="map-placeholder">Preparing the map… The shop list is available below.</div>});
type ActiveSearch={productId:string;latitude:number;longitude:number;radiusKm:number;runId:number};
const areas=[{name:"Kubwa market area · demo pin",latitude:9.151,longitude:7.324},{name:"Kubwa east · demo pin",latitude:9.145,longitude:7.335},{name:"Kubwa north · demo pin",latitude:9.161,longitude:7.317}];
const productName=(p:CatalogProduct)=>`${p.brand} ${p.name} · ${p.variant} · ${p.size}`;
const distanceText=(km:number)=>km<1?`${Math.round(km*1000)} m`:`${km.toFixed(1)} km`;
const errorText=(error:unknown)=>{
  const code=error instanceof Error?error.message:"";
  const map:Record<string,string>={DATABASE_UNAVAILABLE:"Search is temporarily unavailable. Please try again shortly.",DEMO_DISCOVERY_DISABLED:"Buyer discovery is not enabled yet.",SESSION_NOT_CONFIGURED:"Buyer search is not connected yet.",INVALID_SEARCH:"That search was not valid. Type a product name and try again.",TOO_MANY_ATTEMPTS:"You have searched or reported too quickly. Please wait before trying again.",DAILY_LIMIT_REACHED:"Daily voice limit reached. Please type your search instead.",AI_CONSENT_REQUIRED:"Tick the AI consent box to use AI search, or search without it.",SEARCH_EXPIRED:"Your search expired. Please search again.",FEEDBACK_EXPIRED:"This result expired. Refresh the search before sending your report.",INVALID_FEEDBACK:"This report could not be verified. Refresh the search and try again."};
  return map[code]||"The connection was interrupted. Try again; old availability may have changed.";
};
async function jsonRequest<T>(url:string,body?:unknown,signal?:AbortSignal):Promise<T> {
  const response=await fetch(url,{method:body?"POST":"GET",headers:body?{"Content-Type":"application/json"}:undefined,body:body?JSON.stringify(body):undefined,signal:signal||AbortSignal.timeout(15000),cache:"no-store"});
  const data=await response.json();if(!response.ok)throw new Error(data.error?.code||"REQUEST_FAILED");return data as T;
}

export default function BuyerWorkspace() {
  const [catalog,setCatalog]=useState<CatalogProduct[]>([]),[catalogError,setCatalogError]=useState(""),[catalogRetry,setCatalogRetry]=useState(0);
  const [query,setQuery]=useState(""),[matched,setMatched]=useState<CatalogProduct[]>([]),[chip,setChip]=useState("all"),[area,setArea]=useState("0"),[aiConsent,setAiConsent]=useState(false),[aiWorking,setAiWorking]=useState(false),[aiHint,setAiHint]=useState("");
  const [latitude,setLatitude]=useState("9.151"),[longitude,setLongitude]=useState("7.324"),[locating,setLocating]=useState(false),[searched,setSearched]=useState<number|null>(null);
  const [active,setActive]=useState<ActiveSearch[]>([]),[rows,setRows]=useState<NearbyShop[]>([]),[loading,setLoading]=useState(false),[error,setError]=useState(""),[notice,setNotice]=useState(""),[reportError,setReportError]=useState<{key:string;text:string}|null>(null);
  const [lastUpdated,setLastUpdated]=useState<Date|null>(null),[refresh,setRefresh]=useState(0),[hasMore,setHasMore]=useState(false),[paused,setPaused]=useState(false);
  const [selected,setSelected]=useState<string|null>(null),[mapEnabled,setMapEnabled]=useState(false),[feedbackBusy,setFeedbackBusy]=useState<string|null>(null),[reported,setReported]=useState<Record<string,boolean>>({}),[metaEnabled,setMetaEnabled]=useState(false);
  const tokenRef=useRef({runId:0,tokens:{}} as {runId:number;tokens:Record<string,string>});
  const runIdRef=useRef(0);
  const slicesRef=useRef<Record<string,NearbyShop[]>>({});
  const messageRef=useRef<HTMLParagraphElement|null>(null);
  useEffect(()=>{
    let current=true;
    async function load(){try{const products:CatalogProduct[]=[];let offset:number|null=0;do{const page:{products:CatalogProduct[];nextOffset:number|null}=await jsonRequest(`/api/products?scope=buyer&offset=${offset}`);products.push(...page.products);offset=page.nextOffset;}while(offset!==null&&products.length<1000);if(current){setCatalog(products);setCatalogError("");}}catch(error){if(current)setCatalogError(errorText(error));}}
    void load();void jsonRequest<{metaConfigured:boolean}>("/api/status").then(value=>{if(current)setMetaEnabled(value.metaConfigured);}).catch(()=>{});
    return()=>{current=false;};
  },[catalogRetry]);
  useEffect(()=>{messageRef.current?.scrollIntoView({block:"nearest"});},[error,notice]);
  useEffect(()=>{
    if(!active.length)return;
    let disposed=false,timer:ReturnType<typeof setTimeout>|undefined,controllers:AbortController[]=[],timeouts:ReturnType<typeof setTimeout>[]=[],inFlight=false;
    const runId=active[0].runId;
    if(tokenRef.current.runId!==runId){tokenRef.current={runId,tokens:{}};slicesRef.current={};}
    async function update() {
      if(disposed||inFlight)return;
      if(document.hidden||!navigator.onLine){setPaused(true);timer=setTimeout(update,5000);return;}
      inFlight=true;controllers=active.map(()=>new AbortController());timeouts=controllers.map(c=>setTimeout(()=>c.abort(),12000));
      try {
        const settled=await Promise.allSettled(active.map((s,i)=>jsonRequest<BuyerResults>("/api/buyer/search",{productId:s.productId,latitude:s.latitude,longitude:s.longitude,radiusKm:s.radiusKm,searchToken:tokenRef.current.tokens[s.productId]||undefined},controllers[i].signal)));
        if(disposed)return;
        const next:Record<string,NearbyShop[]>={...slicesRef.current};
        let okCount=0,maxSearched=0,more=false,lastReason:unknown=null;
        settled.forEach((result,i)=>{
          const pid=active[i].productId;
          if(result.status==="fulfilled"){
            okCount++;
            tokenRef.current.tokens[pid]=result.value.searchToken;
            next[pid]=result.value.shops;
            if(result.value.searchedRadiusKm>maxSearched)maxSearched=result.value.searchedRadiusKm;
            if(result.value.nextOffset!==null)more=true;
          }else{
            const code=result.reason instanceof Error?result.reason.message:"";
            if(code==="SEARCH_EXPIRED")delete tokenRef.current.tokens[pid];
            lastReason=result.reason;
          }
        });
        if(okCount){
          slicesRef.current=next;
          const merged=active.flatMap(s=>next[s.productId]||[]);
          setRows(merged);setSearched(maxSearched);setHasMore(more);setLastUpdated(new Date());setError("");setPaused(false);
          setSelected(previous=>merged.some(shop=>shop.shop_id===previous)?previous:null);
        }else if(lastReason)setError(errorText(lastReason));
      }catch(error){if(!disposed)setError(errorText(error));}
      finally{timeouts.forEach(clearTimeout);inFlight=false;if(!disposed){setLoading(false);timer=setTimeout(update,5000);}}
    }
    function resume(){if(!document.hidden&&navigator.onLine){if(timer)clearTimeout(timer);void update();}else setPaused(true);}
    void update();document.addEventListener("visibilitychange",resume);window.addEventListener("online",resume);window.addEventListener("offline",resume);
    return()=>{disposed=true;if(timer)clearTimeout(timer);controllers.forEach(c=>c.abort());document.removeEventListener("visibilitychange",resume);window.removeEventListener("online",resume);window.removeEventListener("offline",resume);};
  },[active,refresh]);

  function invalidate(){setActive([]);setRows([]);setMatched([]);setChip("all");setLastUpdated(null);setSelected(null);setError("");setNotice("");setLoading(false);setReported({});setReportError(null);setSearched(null);setAiHint("");slicesRef.current={};}
  function runSearch(products:CatalogProduct[]){
    const lat=Number(latitude),lng=Number(longitude);
    if(!latitude.trim()||!longitude.trim()||!Number.isFinite(lat)||Math.abs(lat)>90||!Number.isFinite(lng)||Math.abs(lng)>180){setError("Choose a valid search location.");return;}
    runIdRef.current+=1;const runId=runIdRef.current;
    setMatched(products);setChip("all");setRows([]);setSelected(null);setReported({});setError("");setLoading(true);setLastUpdated(null);setSearched(null);slicesRef.current={};
    setActive(products.map(p=>({productId:p.id,latitude:lat,longitude:lng,radiusKm:5,runId})));
  }
  async function search(event:React.FormEvent){
    event.preventDefault();setNotice("");setAiHint("");
    if(!query.trim()){setError("Type a product name first.");return;}
    const found=matchCatalogProducts(query,catalog);if(found.matched.length&&!found.truncated){runSearch(found.matched);return;}
    if(!aiConsent){if(!found.matched.length){setNotice("Not in our list yet. Try a brand or product name from the suggestions; we will not guess a match.");return;}setNotice(`Many variants match. Searching the first ${found.matched.length}; add a size or flavor to narrow it.`);runSearch(found.matched);return;}setAiWorking(true);
    try{const data:{source:string;products:CatalogProduct[];notInCatalog:{idea:string|null}|null;capped?:boolean;unavailable?:boolean}=await jsonRequest("/api/buyer/interpret",{query:query.trim(),consent:true});if(data.source==="ai")setAiHint("AI helped understand this search.");else if(data.capped)setAiHint("Daily AI limit reached. Showing local results instead.");else if(data.unavailable)setAiHint("AI is unavailable. Showing local results instead.");
    if(data.notInCatalog&&!data.products.length){setNotice(data.notInCatalog.idea?`Not in our list yet. Understood as "${data.notInCatalog.idea}" — try a brand or product name from the suggestions.`:"Not in our list yet. Try a brand or product name from the suggestions; we will not guess a match.");}else if(!data.products.length){setNotice("Not in our list yet. Try a brand or product name from the suggestions; we will not guess a match.");}else{if((data.capped||data.unavailable)&&found.truncated)setNotice(`Many variants match. Searching the first ${data.products.length}; add a size or flavor to narrow it.`);runSearch(data.products);}}catch{if(!found.matched.length)setNotice("Not in our list yet. Try a brand or product name from the suggestions; we will not guess a match.");else{setNotice("AI is unavailable. Showing local results instead.");runSearch(found.matched);}}finally{setAiWorking(false);}
  }
  function chooseProduct(value:CatalogProduct){setNotice("");setQuery(productName(value));runSearch([value]);}
  const pinChanged=useCallback((lat:number,lng:number)=>{invalidate();setLatitude(String(lat));setLongitude(String(lng));setArea("custom");setNotice("Search pin updated. Select Find nearby shops to search this area.");},[]);
  function useMyLocation(){
    if(!("geolocation" in navigator)){setNotice(locationErrorMessage(2,"choose a demo area or drag the map pin"));return;}
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      position=>{invalidate();setLatitude(String(Number(position.coords.latitude.toFixed(6))));setLongitude(String(Number(position.coords.longitude.toFixed(6))));setArea("custom");setLocating(false);setNotice("Using your device location. Select Find nearby shops to search this area.");},
      error=>{setLocating(false);setNotice(locationErrorMessage(error.code,"choose a demo area or drag the map pin"));},
      {timeout:15000,maximumAge:60000});
  }
  const shopOpened=useCallback((shop:NearbyShop)=>{setSelected(shop.shop_id);void jsonRequest("/api/buyer/feedback",{token:shop.feedbackToken,kind:"shop_open"}).catch(()=>{/* Optional measurement must not block the shop details. */});},[]);
  async function report(shop:NearbyShop,found:boolean){const key=`${shop.shop_id}:${shop.product_id}`;setFeedbackBusy(key);setReportError(null);try{await jsonRequest("/api/buyer/feedback",{token:shop.feedbackToken,kind:"visit_report",found});setReported(previous=>({...previous,[key]:found}));setRefresh(value=>value+1);}catch(error){setReportError({key,text:errorText(error)});}finally{setFeedbackBusy(null);}}
  const suggestions=catalog.filter(p=>catalogMatches(query,p)).slice(0,9);
  const mapLat=Number(latitude),mapLng=Number(longitude),safeLat=Number.isFinite(mapLat)&&Math.abs(mapLat)<=85?mapLat:9.151,safeLng=Number.isFinite(mapLng)&&Math.abs(mapLng)<=180?mapLng:7.324;
  const variantLabel=(id:string)=>{const p=matched.find(m=>m.id===id);return p?`${p.variant} · ${p.size} · ${p.unit}`:"This variant";};
  const groups=groupShopsByShop(rows);
  const visibleGroups=groups.map(g=>({...g,variants:g.variants.filter(v=>chip==="all"||v.product_id===chip)})).filter(g=>g.variants.length);
  const mapShops=rows.filter((row,i,arr)=>arr.findIndex(x=>x.shop_id===row.shop_id)===i);

  return <div className="workspace buyer-workspace"><header className="topbar"><Link className="brand" href="/buyer"><span className="brand-mark">M</span><span>AI Market<span className="brand-light"> Assistant</span></span></Link><span className="demo-badge">DEMO · SIMULATED DATA</span><Link className="buyer-trader-link" href="/">Trader workspace ↗</Link></header>
    <main className="buyer-main"><section className="buyer-intro"><span className="eyebrow">EXPLORE YOUR LOCAL MARKET</span><h1>Find it nearby.<br/><span>Before you make the trip.</span></h1><p>Search provision shops around Kubwa. Type what you need, check estimated availability, and find the shop by its landmark.</p><span className="buyer-account-note">No buyer account needed · fictional shops and stock</span></section>
      <form className="buyer-search-panel" onSubmit={search}><div className="buyer-query"><label>What are you looking for?<input placeholder="Try Indomie, rice or milk" maxLength={120} value={query} onChange={e=>{invalidate();setQuery(e.target.value);}}/></label>
        {!active.length&&<div className="buyer-suggestions" aria-label="Product suggestions">{query.trim()?suggestions.length?suggestions.map(p=><button type="button" key={p.id} onClick={()=>chooseProduct(p)}><strong>{p.brand} {p.name}</strong><span>{p.variant} · {p.size} · {p.unit}</span></button>):<p className="hint">Not in our list yet. Try a shorter brand or product name; we will not guess a match.</p>:<div className="popular-searches"><span>Try:</span>{["Indomie","Rice","Milk"].map(value=><button key={value} type="button" onClick={()=>setQuery(value)}>{value}</button>)}</div>}</div>}
        {Boolean(active.length)&&<div className="chosen-product"><span>{matched.length===1?`✓ Exact item: ${variantLabel(matched[0].id)}`:`✓ ${matched.length} matching variants`}</span><button className="text-button" type="button" onClick={()=>{invalidate();}}>New search</button></div>}
        {catalogError&&<p className="notice" role="status">{catalogError} <button className="text-button" type="button" onClick={()=>setCatalogRetry(value=>value+1)}>Retry catalog</button></p>}
        <VoiceQuery enabled={metaEnabled} onTranscript={value=>{invalidate();setQuery(value);setNotice("Review the transcript, then select Find nearby shops. Search has not been submitted.");}}/>
        <label className="check"><input type="checkbox" checked={aiConsent} onChange={e=>setAiConsent(e.target.checked)}/><span>Let Meta’s AI understand my words when local matching fails.</span></label><p className="hint">If ticked, your words are sent to Meta’s AI only to understand them. Search works without it.</p>
      </div><div className="buyer-location"><label>Search around<select value={area} onChange={e=>{invalidate();setArea(e.target.value);if(e.target.value!=="custom"){const point=areas[Number(e.target.value)];setLatitude(String(point.latitude));setLongitude(String(point.longitude));}}}>{areas.map((point,index)=><option key={point.name} value={index}>{point.name}</option>)}<option value="custom">Custom pin</option></select></label>
        {area==="custom"&&<p className="hint">Custom pin from your device or the map. Drag the map pin or use your device location to move it.</p>}
        <div className="inline-actions"><button type="button" className="secondary" disabled={locating} onClick={useMyLocation}>{locating?"Reading your location…":"Use my location"}</button><button className="primary" disabled={!query.trim()||loading||aiWorking}>{loading?"Finding nearby stock…":aiWorking?"Asking AI…":"Find nearby shops"}</button></div><p className="hint">Choose a demo area, use your device location, or drag the map pin. Your coordinates are used for this search and are not saved in search records.</p>
      </div></form>
      {(error||notice)&&<p className={error?"notice":"buyer-note"} role="status" ref={messageRef}>{error||notice}</p>}{aiHint&&<p className="hint" role="status">{aiHint}</p>}
      <div className="buyer-results-heading"><div><span className="eyebrow">NEARBY SHOPS</span><h2>{active.length?loading?"Checking availability…":`${visibleGroups.length}${hasMore?"+":""} shops with estimated stock`:"Type a product to start"}</h2><p className="hint">{active.length?`Within ${searched??5} km · nearest first · straight-line distance, not walking distance`:"Shop pins and stock are simulated. Availability is always an estimate."}</p></div>{Boolean(active.length)&&<button className="secondary" onClick={()=>{setLoading(true);setRefresh(value=>value+1);}} disabled={loading}>Refresh results</button>}</div>
      {Boolean(active.length)&&searched!==null&&widenMessage(5,searched)&&<p className="buyer-note" role="status">{widenMessage(5,searched)}</p>}
      {matched.length>1&&<div className="variant-chips" role="group" aria-label="Narrow to one variant"><button type="button" className={chip==="all"?"chip active":"chip"} onClick={()=>setChip("all")}>All variants</button>{matched.map(p=><button key={p.id} type="button" className={chip===p.id?"chip active":"chip"} onClick={()=>setChip(p.id)}>{p.variant} · {p.size}</button>)}</div>}
      {Boolean(active.length)&&<p className="buyer-live-status" role="status"><span className={paused||error?"status-dot paused":"status-dot"}/>{paused?"Updates paused while offline or in the background.":error?"Updates interrupted. Displayed results may be out of date.":"Stock refreshes automatically every 5 seconds."}{lastUpdated&&<span>Last checked {lastUpdated.toLocaleTimeString("en-NG",{hour:"2-digit",minute:"2-digit",second:"2-digit",timeZone:"Africa/Lagos"})} WAT</span>}</p>}
      <div className="buyer-result-grid"><section className="buyer-list" aria-label="Nearby shop results">{!active.length?<div className="buyer-empty"><span>↗</span><h3>A shorter search through the market.</h3><p>Type a brand or product name above, then choose your search area. The list works even when the map cannot load.</p></div>:loading&&!rows.length?<div className="buyer-empty" role="status"><h3>Checking nearby shelves…</h3><p>Finding fresh stock estimates for your search.</p></div>:!visibleGroups.length?<div className="buyer-empty"><h3>{error?"Availability could not be checked":"No shops found within 20 km"}</h3><p>{error?"Please retry when your connection returns. We will not present an outage as an empty market.":"We checked 5, 10 and 20 km automatically. This may mean the item is out of stock or the records are stale. Try another product."}</p></div>:visibleGroups.map((group,index)=><article className={`buyer-shop-card${selected===group.shopId?" selected":""}`} key={group.shopId}><div className="buyer-shop-top"><span className="shop-number">{index+1}</span><div><h3>{group.variants[0].name}</h3><span className="shop-category">Provision shop · simulated</span></div><span className="shop-distance">{distanceText(group.distanceKm)}</span></div><p className="shop-landmark">{group.variants[0].landmark}</p>{group.variants.map(v=><div key={v.product_id} className="shop-variant"><p><strong>{variantLabel(v.product_id)}</strong></p><div className="shop-availability"><span className="availability-pill">Estimated available</span><span>{v.confidence==="high"?"Recently confirmed":"Confirmation getting older"}</span></div><p className="hint">Last confirmed {new Date(v.confirmed_at).toLocaleString("en-NG",{dateStyle:"medium",timeStyle:"short",timeZone:"Africa/Lagos"})} WAT</p><div className="buyer-feedback"><p>After visiting, was this exact item available?</p><div><button className={reported[`${group.shopId}:${v.product_id}`]===true?"feedback-button active":"feedback-button"} disabled={feedbackBusy===`${group.shopId}:${v.product_id}`} onClick={()=>report(v,true)}>Found it</button><button className={reported[`${group.shopId}:${v.product_id}`]===false?"feedback-button active":"feedback-button"} disabled={feedbackBusy===`${group.shopId}:${v.product_id}`} onClick={()=>report(v,false)}>Not found</button></div>{`${group.shopId}:${v.product_id}` in reported&&<small>Your report was recorded. You can correct it with the other choice.</small>}{reportError&&reportError.key===`${group.shopId}:${v.product_id}`&&<p className="notice" role="status">{reportError.text}</p>}</div></div>)}<button className="text-button shop-details-button" onClick={()=>shopOpened(group.variants[0])}>{selected===group.shopId?"Shop selected":"Select shop"}</button> <a className="text-button shop-details-button" href={directionsUrl(group.variants[0].latitude,group.variants[0].longitude)} target="_blank" rel="noreferrer">Get directions ↗</a></article>)}</section>
        <aside className="buyer-map-panel"><div className="buyer-map-heading"><div><span className="eyebrow">GET YOUR BEARINGS</span><h3>Shops on the map</h3></div>{mapEnabled&&<button className="text-button" onClick={()=>setMapEnabled(false)}>Hide map</button>}</div>{mapEnabled?<BuyerMap latitude={safeLat} longitude={safeLng} shops={mapShops} selected={selected} onPin={pinChanged} onShop={shopOpened}/>:<div className="map-placeholder"><span>⌖</span><h3>Your shop list is ready without a map.</h3><p>Load OpenStreetMap to see shop pins or drag the search pin.</p><button className="secondary" onClick={()=>setMapEnabled(true)}>Load OpenStreetMap</button><p className="hint">Map tiles come from OpenStreetMap; loading the map shares the viewed area with that service.</p></div>}<div className="buyer-trust-note"><strong>A useful estimate, not a promise.</strong><p>Stock can change between a search and a visit. Stale records are hidden, and visit reports help check availability.</p></div></aside>
      </div>{hasMore&&<p className="hint">Showing the 50 nearest eligible shops.</p>}
    </main><footer className="footer">AI Market Assistant · Bringing local trade closer.<span>No buyer signup · no route calculation · all demo listings simulated</span></footer></div>;
}
