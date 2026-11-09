import "server-only";
import path from "node:path";
import { pathToFileURL } from "node:url";
import type { Pool } from "pg";
import type { PGlite } from "@electric-sql/pglite";
import { migrate } from "../../scripts/migrate.mjs";
import { generateDemo, seedDemo } from "../../scripts/demo-data.mjs";
import { seedDemand } from "../../scripts/seed-demand.mjs";

type LocalState={ready:Promise<PGlite>;tail:Promise<void>};
const globalState=globalThis as typeof globalThis & {marketLocalState?:LocalState};
async function openEngine() {
  const {PGlite}=await import("@electric-sql/pglite");
  const db=new PGlite(path.join(process.cwd(),".local-demo"));
  const folder=pathToFileURL(path.join(process.cwd(),"db","migrations")+path.sep);
  await migrate(db,folder);
  const count=await db.query<{count:number}>("SELECT count(*)::integer AS count FROM shops");
  if(count.rows[0].count===0) {
    const date=new Date().toLocaleDateString("en-CA",{timeZone:"Africa/Lagos"});
    await seedDemo(db,generateDemo(20261103,date));
  }
  if(process.env.DEMO_MODE==="true")await seedDemand(db);
  return db;
}
export function localDemoPool(): Pick<Pool,"query"|"connect"> {
  // PGlite is an isolated, single-connection development engine, never production.
  if(process.env.NODE_ENV==="production" || process.env.LOCAL_DEMO_DATABASE!=="true")throw new Error("LOCAL_DEMO_DISABLED");
  const state=globalState.marketLocalState??={ready:openEngine(),tail:Promise.resolve()};
  async function acquire() {
    const prior=state.tail;let unlock!:()=>void;
    state.tail=new Promise<void>(resolve=>{unlock=resolve;});await prior;return unlock;
  }
  const adapter={
    async query(sql:string,values:unknown[]=[]) {
      const release=await acquire();try{return await (await state.ready).query(sql,values);}finally{release();}
    },
    async connect() {
      const release=await acquire();let released=false;
      try {
        const db=await state.ready;
        return {query:(sql:string,values:unknown[]=[])=>{if(released)throw new Error("CLIENT_RELEASED");return db.query(sql,values);},
          release:()=>{if(!released){released=true;release();}}};
      }catch(error){release();throw error;}
    },
  };
  // Implements the query/connect subset used by the app; it intentionally has no pool/server lifecycle APIs.
  return adapter as unknown as Pick<Pool,"query"|"connect">;
}
