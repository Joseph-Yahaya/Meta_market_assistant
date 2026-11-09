"use client";
import { useEffect,useRef,useState } from "react";
import L from "leaflet";
import type {NearbyShop} from "./types";
type Props={latitude:number;longitude:number;shops:NearbyShop[];selected:string|null;route:{points:[number,number][];attribution:string}|null;onPin:(lat:number,lng:number)=>void;onShop:(shop:NearbyShop)=>void};
export default function BuyerMap({latitude,longitude,shops,selected,route,onPin,onShop}:Props) {
  const container=useRef<HTMLDivElement>(null),map=useRef<L.Map|null>(null),layer=useRef<L.LayerGroup|null>(null),attribution=useRef<string|null>(null);
  const first=useRef([latitude,longitude] as [number,number]),handlers=useRef({onPin,onShop});
  const [tileError,setTileError]=useState(false);
  useEffect(()=>{handlers.current={onPin,onShop};},[onPin,onShop]);
  useEffect(()=>{
    if(!container.current)return;
    const instance=L.map(container.current,{center:first.current,zoom:14,scrollWheelZoom:false});map.current=instance;
    const tiles=L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png",{maxZoom:19,attribution:'&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'}).addTo(instance);
    tiles.on("tileerror",()=>setTileError(true));layer.current=L.layerGroup().addTo(instance);
    instance.on("click",e=>handlers.current.onPin(Number(e.latlng.lat.toFixed(6)),Number(e.latlng.lng.toFixed(6))));
    const observer=new ResizeObserver(()=>instance.invalidateSize());observer.observe(container.current);
    return()=>{observer.disconnect();instance.remove();map.current=null;layer.current=null;};
  },[]);
  useEffect(()=>{
    if(!map.current||!layer.current)return;
    layer.current.clearLayers();
    const center=L.latLng(latitude,longitude);
    const pin=L.marker(center,{draggable:true,title:"Your search pin",keyboard:true,icon:L.divIcon({className:"buyer-search-pin",html:"",iconSize:[22,22],iconAnchor:[11,11]})});pin.bindTooltip("Your search pin: drag to move");pin.on("dragend",()=>{const moved=pin.getLatLng();handlers.current.onPin(Number(moved.lat.toFixed(6)),Number(moved.lng.toFixed(6)));});pin.addTo(layer.current);
    shops.forEach((shop,index)=>{
      const marker=L.marker([shop.latitude,shop.longitude],{title:shop.name,keyboard:true,
        icon:L.divIcon({className:`buyer-map-marker${selected===shop.shop_id?" selected":""}`,html:String(index+1),iconSize:[30,36],iconAnchor:[15,36]})});
      const description=document.createElement("div"),name=document.createElement("strong"),landmark=document.createElement("p");
      name.textContent=shop.name;landmark.textContent=shop.landmark;description.append(name,landmark);
      marker.bindPopup(description);marker.on("click",()=>handlers.current.onShop(shop));marker.addTo(layer.current!);
    });
    if(route&&route.points.length>1)L.polyline(route.points,{color:"#9b6d28",weight:5,opacity:0.9}).addTo(layer.current);
  },[latitude,longitude,shops,selected,route]);
  useEffect(()=>{
    const control=map.current?.attributionControl;if(!control)return;
    if(attribution.current)control.removeAttribution(attribution.current);
    attribution.current=route?route.attribution:null;
    if(attribution.current)control.addAttribution(attribution.current);
  },[route]);
  useEffect(()=>{map.current?.setView([latitude,longitude],14,{animate:false});},[latitude,longitude]);
  return <div className="buyer-map-wrap"><div ref={container} className="buyer-map" role="region" aria-label="Map of nearby simulated shops; drag the search pin or click to choose a search pin"/>{tileError&&<p className="map-warning" role="status">Some map tiles could not load. Shop details and distances remain available in the list.</p>}<p className="hint">Drag the blue search pin or click the map to move it. Numbered pins: simulated shops. A road line appears only after you tap Show route on a shop.</p>{route&&<p className="hint">Road line: {route.attribution}.</p>}</div>;
}
