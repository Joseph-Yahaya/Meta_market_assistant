import pg from "pg";
import {migrate} from "./migrate.mjs";
import {generateDemo,seedDemo} from "./demo-data.mjs";
if(!process.env.DATABASE_URL){console.error("Release requires database configuration.");process.exit(1);}
const db=new pg.Client({connectionString:process.env.DATABASE_URL});
try{
  await db.connect();await migrate(db);console.log("Release migrations applied.");
  if(process.env.DEMO_MODE==="true"&&process.env.ALLOW_DEMO_SEED==="true"){
    const count=(await db.query("SELECT count(*)::int n FROM shops")).rows[0].n;
    if(count===0){
      const date=process.env.DEMO_AS_OF||new Date().toLocaleDateString("en-CA",{timeZone:"Africa/Lagos"});
      await seedDemo(db,generateDemo(20261103,date));console.log("Fictional demo dataset seeded into empty database.");
    }else console.log("Existing dataset retained; seed skipped.");
  }
}catch{console.error("Release database setup failed. Connection details suppressed.");process.exitCode=1;}
finally{await db.end();}
