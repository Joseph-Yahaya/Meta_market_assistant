import {spawnSync} from "node:child_process";
import {existsSync,cpSync,mkdirSync} from "node:fs";
import path from "node:path";
import {pathToFileURL} from "node:url";
const root=process.cwd();
const setup=spawnSync(process.execPath,[path.join(root,"scripts/release.mjs")],{stdio:"inherit"});
if(setup.status!==0){console.error("Database release setup failed; server was not started.");process.exit(1);}
let server=path.join(root,"server.js");
if(!existsSync(server)){
  const standalone=path.join(root,".next/standalone");
  mkdirSync(path.join(standalone,".next"),{recursive:true});
  cpSync(path.join(root,".next/static"),path.join(standalone,".next/static"),{recursive:true});
  if(existsSync(path.join(root,"public")))cpSync(path.join(root,"public"),path.join(standalone,"public"),{recursive:true});
  server=path.join(standalone,"server.js");
}
await import(pathToFileURL(server).href);
