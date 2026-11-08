import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { requireActor } from "@/server/auth";
import { ownedShop } from "@/server/entry-service";
import { database } from "@/server/db";
import { ApiError, failure, json, requireSameOrigin } from "@/server/http";
import { limitAuth } from "@/server/accounts";
import { validateCustomProduct, checkCustomFlags, CUSTOM_PRODUCT_LIMIT_PER_DAY } from "@/lib/custom-products";
import { mapCategory, normalizeSize } from "@/lib/proposal-polish";
import { stripImageMetadata, validateImageBytes } from "@/lib/image";
export const runtime="nodejs";
// Interim shelf for cropped trader photos until hosted storage is decided.
// Ignored local folder; never committed.
const UPLOAD_DIR=path.join(process.cwd(),".local-uploads");
export async function POST(request: Request) {
  try {
    requireSameOrigin(request);
    const actor=await requireActor();
    const form=await request.formData().catch(()=>null);
    if(!form)throw new ApiError(400,"INVALID_PRODUCT");
    const shopId=await ownedShop(actor,form.get("shopId"));
    await limitAuth("custom-product",actor,30);
    let product;
    try {
      // The app already split brand, short name and variant; the server only
      // re-applies the idempotent size and category normalization, then validates.
      const rawName=String(form.get("name")??""),rawBrand=String(form.get("brand")??"");
      const category=mapCategory(String(form.get("category")??""),rawName,rawBrand)||"provisions";
      product=validateCustomProduct({name:rawName,brand:rawBrand,size:normalizeSize(String(form.get("size")??"")),unit:String(form.get("unit")??""),category,variant:String(form.get("variant")??"")});
    } catch(error) {throw new ApiError(400,(error as Error).message);}
    const photo=form.get("photo");
    if(!photo||typeof photo!=="object"||typeof (photo as File).arrayBuffer!=="function")throw new ApiError(400,"PHOTO_REQUIRED");
    const bytes=new Uint8Array(await (photo as File).arrayBuffer());
    let photoType;
    try {photoType=validateImageBytes(bytes).type;}
    catch(error){const code=(error as Error).message;throw new ApiError(code==="IMAGE_TOO_LARGE"?413:400,code);}
    const quota=await database().query("SELECT count(*)::int n FROM products WHERE created_by=$1 AND created_at>=(date_trunc('day',now() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC')",[actor]);
    if(quota.rows[0].n>=CUSTOM_PRODUCT_LIMIT_PER_DAY)throw new ApiError(409,"PRODUCT_DAILY_LIMIT");
    const catalog=(await database().query("SELECT name,brand,variant,size FROM products WHERE shop_id IS NULL OR shop_id=$1",[shopId])).rows;
    const {duplicate,flags}=checkCustomFlags(product,catalog);
    if(duplicate)throw new ApiError(409,"DUPLICATE_PRODUCT");
    if(form.get("typed")==="true")flags.push("typed-name");
    let clean:Uint8Array;
    try {clean=stripImageMetadata(bytes,photoType);}
    catch(error){throw new ApiError(400,(error as Error).message);}
    const filename=`${randomUUID()}.jpg`;
    await mkdir(UPLOAD_DIR,{recursive:true});
    await writeFile(path.join(UPLOAD_DIR,filename),clean);
    const status=flags.length?"pending":"approved";
    let id:string;
    try {
      const inserted=await database().query(`INSERT INTO products(name,brand,variant,size,unit,category,perishable,shop_id,status,photo_path,flag_reason,created_by)
        VALUES($1,$2,$3,$4,$5,$6,false,$7,$8,$9,$10,$11) RETURNING id`,
        [product.name,product.brand,product.variant,product.size,product.unit,product.category,shopId,status,filename,flags.join(",")||null,actor]);
      id=inserted.rows[0].id;
    } catch(error){if((error as {code?:string}).code==="23505")throw new ApiError(409,"DUPLICATE_PRODUCT");throw error;}
    return json({product:{id,...product,status},status,
      message:status==="approved"?"Saved. Shoppers can now find it.":"Saved for your shop. It stays hidden from shoppers until review passes."});
  } catch(error) {return failure(error);}
}
