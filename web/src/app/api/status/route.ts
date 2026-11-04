import { json } from "@/server/http";
export const runtime="nodejs";
export async function GET() {
  const localDemo=process.env.NODE_ENV!=="production" && process.env.LOCAL_DEMO_DATABASE==="true";
  return json({demo:true,localDemo,accountsConfigured:process.env.DEMO_MODE==="true" && (Boolean(process.env.DATABASE_URL)||localDemo) && (process.env.SESSION_SECRET?.length??0)>=32,
    metaConfigured:process.env.ENABLE_META_CALLS==="true" && Boolean(process.env.MODEL_API_KEY),verifiedConnection:false});
}
