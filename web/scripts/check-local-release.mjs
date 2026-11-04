// Runs only against the isolated local synthetic demo. Never calls Meta or Railway.
import {spawnSync} from "node:child_process";
const origin="http://127.0.0.1:3000";
try {
  const status=await (await fetch(origin+"/api/status",{signal:AbortSignal.timeout(120000)})).json();
  if(!status.localDemo||!status.accountsConfigured||status.metaConfigured)throw Error("LOCAL_RELEASE_REQUIRES_ISOLATED_DEMO_AND_DISABLED_META");
  const health=await fetch(origin+"/api/health",{signal:AbortSignal.timeout(120000)});
  if(health.status!==200||(await health.json()).status!=="ready")throw Error("LOCAL_DATABASE_NOT_READY");
  for(const script of ["check-local-trader.mjs","check-local-buyer.mjs","check-local-alerts.mjs"]){
    const result=spawnSync(process.execPath,[`scripts/${script}`],{stdio:"inherit",timeout:300000});
    if(result.error||result.status!==0)throw Error(`LOCAL_CHECK_FAILED: ${script}`);
  }
  console.log("Local release checks passed. Live voice, hosted PostgreSQL, network/device tests, deployment and competition acceptance are NOT certified by this check.");
}catch(error){console.error(error instanceof Error?error.message:"LOCAL_RELEASE_CHECK_FAILED");process.exitCode=1;}
