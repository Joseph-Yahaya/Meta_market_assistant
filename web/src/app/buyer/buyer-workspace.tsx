"use client";
import Link from "next/link";
import dynamic from "next/dynamic";
import { useCallback,useEffect,useRef,useState } from "react";
import VoiceQuery from "./voice-query";
import {catalogMatches} from "@/lib/catalog-match";
import {directionsUrl} from "@/lib/directions";
import type {BuyerResults,CatalogProduct,NearbyShop} from "./types";
import "leaflet/dist/leaflet.css";
const BuyerMap=dynamic(()=>import("./buyer-map"),{ssr:false,loading:()=> <div className="map-placeholder">Preparing the map… The shop list is available below.</div>});
type ActiveSearch={productId:string;latitude:number;longitude:number;radiusKm:number;runId:number};
const areas=[{name:"Kubwa market area · demo pin",latitude:9.151,longitude:7.324},{name:"Kubwa east · demo pin",latitude:9.145,longitude:7.335},{name:"Kubwa north · demo pin",latitude:9.161,longitude:7.317}];
const productName=(p:CatalogProduct)=>`${p.brand} ${p.name} · ${p.variant} · ${p.size}`;
const errorText=(error:unknown)=>{
  const code=error instanceof Error?error.message:"";
  const map:Record<string,string>={DATABASE_UNAVAILABLE:"Search is temporarily unavailable. Please try again shortly.",DEMO_DISCOVERY_DISABLED:"Buyer discovery is not enabled yet.",SESSION_NOT_CONFIGURED:"Buyer search is not connected yet.",INVALID_SEARCH:"Choose a product and valid search coordinates.",TOO_MANY_ATTEMPTS:"You have searched or reported too quickly. Please wait before trying again.",DAILY_LIMIT_REACHED:"Daily voice limit reached. Please type your search instead.",SEARCH_EXPIRED:"Your search expired. Please search again.",FEEDBACK_EXPIRED:"This result expired. Refresh the search before sending your report.",INVALID_FEEDBACK:"This report could not be verified. Refresh the search and try again."};
  return map[code]||"The connection was interrupted. Try again; old availability may have changed.";
};
async function jsonRequest<T>(url:string,body?:unknown,signal?:AbortSignal):Promise<T> {
  const response=await fetch(url,{method:body?"POST":"GET",headers:body?{"Content-Type":"application/json"}:undefined,body:body?JSON.stringify(body):undefined,signal:signal||AbortSignal.timeout(15000),cache:"no-store"});
  const data=await response.json();if(!response.ok)throw new Error(data.error?.code||"REQUEST_FAILED");return data as T;
}

export default function BuyerWorkspace() {
  const [catalog,setCatalog]=useState<CatalogProduct[]>([]),[catalogError,setCatalogError]=useState(""),[catalogRetry,setCatalogRetry]=useState(0);
  const [query,setQuery]=useState(""),[product,setProduct]=useState<CatalogProduct|null>(null),[area,setArea]=useState("0");
  const [latitude,setLatitude]=useState("9.151"),[longitude,setLongitude]=useState("7.324"),[radius,setRadius]=useState("5"),[locating,setLocating]=useState(false);
  const [active,setActive]=useState<ActiveSearch|null>(null),[rows,setRows]=useState<NearbyShop[]>([]),[loading,setLoading]=useState(false),[error,setError]=useState(""),[notice,setNotice]=useState("");
  const [lastUpdated,setLastUpdated]=useState<Date|null>(null),[refresh,setRefresh]=useState(0),[hasMore,setHasMore]=useState(false),[paused,setPaused]=useState(false);
  const [selected,setSelected]=useState<string|null>(null),[mapEnabled,setMapEnabled]=useState(false),[feedbackBusy,setFeedbackBusy]=useState<string|null>(null),[reported,setReported]=useState<Record<string,boolean>>({}),[metaEnabled,setMetaEnabled]=useState(false);
  const tokenRef=useRef({runId:0,token:""});
  useEffect(()=>{
    let current=true;
    async function load(){try{const products:CatalogProduct[]=[];let offset:number|null=0;do{const page:{products:CatalogProduct[];nextOffset:number|null}=await jsonRequest(`/api/products?offset=${offset}`);products.push(...page.products);offset=page.nextOffset;}while(offset!==null&&products.length<1000);if(current){setCatalog(products);setCatalogError("");}}catch(error){if(current)setCatalogError(errorText(error));}}
    void load();void jsonRequest<{metaConfigured:boolean}>("/api/status").then(value=>{if(current)setMetaEnabled(value.metaConfigured);}).catch(()=>{});
    return()=>{current=false;};
  },[catalogRetry]);
  useEffect(()=>{
    if(!active)return;
    let disposed=false,timer:ReturnType<typeof setTimeout>|undefined,controller:AbortController|undefined,inFlight=false;
    if(tokenRef.current.runId!==active.runId)tokenRef.current={runId:active.runId,token:""};
    async function update() {
      if(disposed||inFlight)return;
      if(document.hidden||!navigator.onLine){setPaused(true);timer=setTimeout(update,5000);return;}
      inFlight=true;controller=new AbortController();const timeout=setTimeout(()=>controller?.abort(),12000);
      try {
        const result=await jsonRequest<BuyerResults>("/api/buyer/search",{...active,searchToken:tokenRef.current.token||undefined},controller.signal);
        if(disposed)return;
        tokenRef.current={runId:active!.runId,token:result.searchToken};setRows(result.shops);setHasMore(result.nextOffset!==null);setLastUpdated(new Date());setError("");setPaused(false);
        setSelected(previous=>result.shops.some(shop=>shop.shop_id===previous)?previous:null);
      }catch(error){if(!disposed){if(error instanceof Error&&error.message==="SEARCH_EXPIRED")tokenRef.current.token="";setError(errorText(error));}}
      finally{clearTimeout(timeout);inFlight=false;if(!disposed){setLoading(false);timer=setTimeout(update,5000);}}
    }
    function resume(){if(!document.hidden&&navigator.onLine){if(timer)clearTimeout(timer);void update();}else setPaused(true);}
    void update();document.addEventListener("visibilitychange",resume);window.addEventListener("online",resume);window.addEventListener("offline",resume);
    return()=>{disposed=true;if(timer)clearTimeout(timer);controller?.abort();document.removeEventListener("visibilitychange",resume);window.removeEventListener("online",resume);window.removeEventListener("offline",resume);};
  },[active,refresh]);

  function invalidate(){setActive(null);setRows([]);setLastUpdated(null);setSelected(null);setError("");setNotice("");setLoading(false);setReported({});}
  function chooseProduct(value:CatalogProduct){invalidate();setProduct(value);setQuery(productName(value));}
  function search(event:React.FormEvent){event.preventDefault();setNotice("");if(!product){setError("Choose the exact product and size from the suggestions first.");return;}
    const lat=Number(latitude),lng=Number(longitude);if(!latitude.trim()||!longitude.trim()||!Number.isFinite(lat)||Math.abs(lat)>90||!Number.isFinite(lng)||Math.abs(lng)>180){setError("Choose a valid search location.");return;}
    setRows([]);setSelected(null);setReported({});setError("");setLoading(true);setLastUpdated(null);setActive({productId:product.id,latitude:lat,longitude:lng,radiusKm:Number(radius),runId:Date.now()});
  }
  const pinChanged=useCallback((lat:number,lng:number)=>{setLatitude(String(lat));setLongitude(String(lng));setArea("custom");setActive(null);setRows([]);setLastUpdated(null);setSelected(null);setLoading(false);setNotice("Search pin updated. Select Find nearby shops to search this area.");},[]);
  function useMyLocation(){
    if(!("geolocation" in navigator)){setNotice("Your device did not share a location. Choose a demo area or drag the map pin instead.");return;}
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      position=>{invalidate();setLatitude(String(Number(position.coords.latitude.toFixed(6))));setLongitude(String(Number(position.coords.longitude.toFixed(6))));setArea("custom");setLocating(false);setNotice("Using your device location. Select Find nearby shops to search this area.");},
      ()=>{setLocating(false);setNotice("Your device did not share a location. Choose a demo area or drag the map pin instead.");},
      {timeout:15000,maximumAge:60000});
  }
  const shopOpened=useCallback((shop:NearbyShop)=>{setSelected(shop.shop_id);void jsonRequest("/api/buyer/feedback",{token:shop.feedbackToken,kind:"shop_open"}).catch(()=>{/* Optional measurement must not block the shop details. */});},[]);
  async function report(shop:NearbyShop,found:boolean){setFeedbackBusy(shop.shop_id);setNotice("");try{await jsonRequest("/api/buyer/feedback",{token:shop.feedbackToken,kind:"visit_report",found});setReported(previous=>({...previous,[shop.shop_id]:found}));setNotice("Thank you. Your visit report helps check availability; it does not change the trader’s stock record.");setRefresh(value=>value+1);}catch(error){setNotice(errorText(error));}finally{setFeedbackBusy(null);}}
  const suggestions=catalog.filter(p=>catalogMatches(query,p)).slice(0,9);
  const mapLat=Number(latitude),mapLng=Number(longitude),safeLat=Number.isFinite(mapLat)&&Math.abs(mapLat)<=85?mapLat:9.151,safeLng=Number.isFinite(mapLng)&&Math.abs(mapLng)<=180?mapLng:7.324;

  return <div className="workspace buyer-workspace"><header className="topbar"><Link className="brand" href="/buyer"><span className="brand-mark">M</span><span>AI Market<span className="brand-light"> Assistant</span></span></Link><span className="demo-badge">DEMO · SIMULATED DATA</span><Link className="buyer-trader-link" href="/">Trader workspace ↗</Link></header>
    <main className="buyer-main"><section className="buyer-intro"><span className="eyebrow">EXPLORE YOUR LOCAL MARKET</span><h1>Find it nearby.<br/><span>Before you make the trip.</span></h1><p>Search provision shops around Kubwa. Choose the exact item, check estimated availability, and find the shop by its landmark.</p><span className="buyer-account-note">No buyer account needed · fictional shops and stock</span></section>
      <form className="buyer-search-panel" onSubmit={search}><div className="buyer-query"><label>What are you looking for?<input placeholder="Try Indomie, rice or milk" maxLength={120} value={query} onChange={e=>{invalidate();setProduct(null);setQuery(e.target.value);}}/></label>
        {!product&&<div className="buyer-suggestions" aria-label="Product suggestions">{query.trim()?suggestions.length?suggestions.map(p=><button type="button" key={p.id} onClick={()=>chooseProduct(p)}><strong>{p.brand} {p.name}</strong><span>{p.variant} · {p.size} · {p.unit}</span></button>):<p className="hint">No catalog match. Try a shorter brand or product name; we will not guess a match.</p>:<div className="popular-searches"><span>Try:</span>{["Indomie","Rice","Milk"].map(value=><button key={value} type="button" onClick={()=>setQuery(value)}>{value}</button>)}</div>}</div>}
        {product&&<div className="chosen-product"><span>✓ Exact item selected: {product.variant} · {product.size} · {product.unit}</span><button className="text-button" type="button" onClick={()=>{invalidate();setProduct(null);setQuery("");}}>Change</button></div>}
        {catalogError&&<p className="notice" role="status">{catalogError} <button className="text-button" type="button" onClick={()=>setCatalogRetry(value=>value+1)}>Retry catalog</button></p>}
        <VoiceQuery enabled={metaEnabled} onTranscript={value=>{invalidate();setProduct(null);setQuery(value);setNotice("Review the transcript and choose the exact variant. Search has not been submitted.");}}/>
      </div><div className="buyer-location"><label>Search around<select value={area} onChange={e=>{invalidate();setArea(e.target.value);if(e.target.value!=="custom"){const point=areas[Number(e.target.value)];setLatitude(String(point.latitude));setLongitude(String(point.longitude));}}}>{areas.map((point,index)=><option key={point.name} value={index}>{point.name}</option>)}<option value="custom">Custom pin</option></select></label><label>Distance<select value={radius} onChange={e=>{invalidate();setRadius(e.target.value);}}>{[1,2,5,10,25,50].map(km=><option key={km} value={km}>{km} km</option>)}</select></label>
        {area==="custom"&&<p className="hint">Custom pin from your device or the map. Drag the map pin or use your device location to move it.</p>}
        <div className="inline-actions"><button type="button" className="secondary" disabled={locating} onClick={useMyLocation}>{locating?"Reading your location…":"Use my location"}</button><button className="primary" disabled={!product||loading}>{loading?"Finding nearby stock…":"Find nearby shops"}</button></div><p className="hint">Choose a demo area, use your device location, or drag the map pin. Your coordinates are used for this search and are not saved in search records.</p>
      </div></form>
      {(error||notice)&&<p className={error?"notice":"buyer-note"} role="status">{error||notice}</p>}
      <div className="buyer-results-heading"><div><span className="eyebrow">NEARBY SHOPS</span><h2>{active?loading?"Checking availability…":`${rows.length}${hasMore?"+":""} shops with estimated stock`:(product?"Ready to search this area":"Choose a product to start")}</h2><p className="hint">{active?`Within ${active.radiusKm} km · nearest first · straight-line distance, not walking distance`:"Shop pins and stock are simulated. Availability is always an estimate."}</p></div>{active&&<button className="secondary" onClick={()=>{setLoading(true);setRefresh(value=>value+1);}} disabled={loading}>Refresh results</button>}</div>
      {active&&<p className="buyer-live-status" role="status"><span className={paused||error?"status-dot paused":"status-dot"}/>{paused?"Updates paused while offline or in the background.":error?"Updates interrupted. Displayed results may be out of date.":"Stock refreshes automatically every 5 seconds."}{lastUpdated&&<span>Last checked {lastUpdated.toLocaleTimeString("en-NG",{hour:"2-digit",minute:"2-digit",second:"2-digit",timeZone:"Africa/Lagos"})} WAT</span>}</p>}
      <div className="buyer-result-grid"><section className="buyer-list" aria-label="Nearby shop results">{!active?<div className="buyer-empty"><span>↗</span><h3>A shorter search through the market.</h3><p>Pick a brand and pack size above, then choose your search area. The list works even when the map cannot load.</p></div>:loading&&!rows.length?<div className="buyer-empty" role="status"><h3>Checking nearby shelves…</h3><p>Finding fresh stock estimates for the exact item you chose.</p></div>:!rows.length?<div className="buyer-empty"><h3>{error?"Availability could not be checked":"No recently confirmed stock nearby"}</h3><p>{error?"Please retry when your connection returns. We will not present an outage as an empty market.":"This may mean the item is out of stock, the records are stale, or it is outside your radius. Try a wider area or another pack size."}</p>{!error&&Number(radius)<50&&<button className="secondary" onClick={()=>{invalidate();setRadius(String(Math.min(Number(radius)*2,50)));setNotice("Radius increased. Select Find nearby shops to search again.");}}>Widen the search radius</button>}</div>:rows.map((shop,index)=><article className={`buyer-shop-card${selected===shop.shop_id?" selected":""}`} key={shop.shop_id}><div className="buyer-shop-top"><span className="shop-number">{index+1}</span><div><h3>{shop.name}</h3><span className="shop-category">Provision shop · simulated</span></div><span className="shop-distance">{Number(shop.distance_km)<1?`${Math.round(Number(shop.distance_km)*1000)} m`:`${Number(shop.distance_km).toFixed(1)} km`}</span></div><p className="shop-landmark">{shop.landmark}</p><div className="shop-availability"><span className="availability-pill">Estimated available</span><span>{shop.confidence==="high"?"Recently confirmed":"Confirmation getting older"}</span></div><p className="hint">Last confirmed {new Date(shop.confirmed_at).toLocaleString("en-NG",{dateStyle:"medium",timeStyle:"short",timeZone:"Africa/Lagos"})} WAT</p><button className="text-button shop-details-button" onClick={()=>shopOpened(shop)}>{selected===shop.shop_id?"Shop selected":"Select shop"}</button> <a className="text-button shop-details-button" href={directionsUrl(shop.latitude,shop.longitude)} target="_blank" rel="noreferrer">Get directions ↗</a><div className="buyer-feedback"><p>After visiting, was this exact item available?</p><div><button className={reported[shop.shop_id]===true?"feedback-button active":"feedback-button"} disabled={feedbackBusy===shop.shop_id} onClick={()=>report(shop,true)}>Found it</button><button className={reported[shop.shop_id]===false?"feedback-button active":"feedback-button"} disabled={feedbackBusy===shop.shop_id} onClick={()=>report(shop,false)}>Not found</button></div>{shop.shop_id in reported&&<small>Your report was recorded. You can correct it with the other choice.</small>}</div></article>)}</section>
        <aside className="buyer-map-panel"><div className="buyer-map-heading"><div><span className="eyebrow">GET YOUR BEARINGS</span><h3>Shops on the map</h3></div>{mapEnabled&&<button className="text-button" onClick={()=>setMapEnabled(false)}>Hide map</button>}</div>{mapEnabled?<BuyerMap latitude={safeLat} longitude={safeLng} shops={rows} selected={selected} onPin={pinChanged} onShop={shopOpened}/>:<div className="map-placeholder"><span>⌖</span><h3>Your shop list is ready without a map.</h3><p>Load OpenStreetMap to see shop pins or drag the search pin.</p><button className="secondary" onClick={()=>setMapEnabled(true)}>Load OpenStreetMap</button><p className="hint">Map tiles come from OpenStreetMap; loading the map shares the viewed area with that service.</p></div>}<div className="buyer-trust-note"><strong>A useful estimate, not a promise.</strong><p>Stock can change between a search and a visit. Stale records are hidden, and visit reports help check availability.</p></div></aside>
      </div>{hasMore&&<p className="hint">Showing the 50 nearest eligible shops. Narrow the radius for a smaller set.</p>}
    </main><footer className="footer">AI Market Assistant · Bringing local trade closer.<span>No buyer signup · no route calculation · all demo listings simulated</span></footer></div>;
}
