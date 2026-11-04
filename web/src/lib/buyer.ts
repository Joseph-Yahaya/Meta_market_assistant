import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";
export type SearchInput={productId:string;latitude:number;longitude:number;radiusKm:number;offset:number};
export type FeedbackTicket={shopId:string;productId:string;searchId:string;visitor:string;expires:number};
export function buyerUuid(value: unknown):value is string {return typeof value==="string" && /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(value);}
export function parseBuyerSearch(input: Record<string,unknown>):SearchInput {
  const {productId,latitude,longitude}=input,radiusKm=input.radiusKm??5,offset=input.offset??0;
  if(!buyerUuid(productId)||typeof latitude!=="number"||!Number.isFinite(latitude)||Math.abs(latitude)>90
    ||typeof longitude!=="number"||!Number.isFinite(longitude)||Math.abs(longitude)>180
    ||typeof radiusKm!=="number"||!Number.isFinite(radiusKm)||radiusKm<=0||radiusKm>50
    ||typeof offset!=="number"||!Number.isInteger(offset)||offset<0||offset>10000)throw new Error("INVALID_SEARCH");
  return {productId,latitude,longitude,radiusKm,offset};
}
export function signBuyer(scope:string,payload:Record<string,unknown>,secret:string) {
  if(secret.length<32)throw new Error("BUYER_SESSION_NOT_CONFIGURED");
  const body=Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${body}.${createHmac("sha256",secret).update(`${scope}:${body}`).digest("base64url")}`;
}
export function readBuyer(scope:string,token:unknown,secret:string,now=Date.now()):Record<string,unknown> {
  if(typeof token!=="string"||token.length>4096||secret.length<32)throw new Error("INVALID_BUYER_TOKEN");
  const [body,signature,...extra]=token.split(".");
  if(!body||!signature||extra.length)throw new Error("INVALID_BUYER_TOKEN");
  const expected=createHmac("sha256",secret).update(`${scope}:${body}`).digest(),provided=Buffer.from(signature,"base64url");
  if(provided.length!==expected.length||!timingSafeEqual(provided,expected))throw new Error("INVALID_BUYER_TOKEN");
  let payload;
  try{payload=JSON.parse(Buffer.from(body,"base64url").toString("utf8"));}catch{throw new Error("INVALID_BUYER_TOKEN");}
  if(!payload||typeof payload!=="object"||!Number.isSafeInteger(payload.expires)||payload.expires<=now)throw new Error("BUYER_TOKEN_EXPIRED");
  return payload;
}
export function visitorDigest(visitor:string,secret:string,now=Date.now()) {
  return createHmac("sha256",secret).update(`buyer-day:${new Date(now).toISOString().slice(0,10)}:${visitor}`).digest("hex");
}
export function queryDigest(input:SearchInput,secret:string) {
  return createHmac("sha256",secret).update(`buyer-query:${JSON.stringify([input.productId,input.latitude,input.longitude,input.radiusKm])}`).digest("hex");
}
export function newBuyerSession(secret:string,now=Date.now()) {
  const id=randomUUID(),expires=now+24*3600000;
  return {id,token:signBuyer("buyer-session",{id,expires},secret)};
}
