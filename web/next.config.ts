import type { NextConfig } from "next";
const nextConfig: NextConfig = { output: "standalone", serverExternalPackages:["@electric-sql/pglite","pg"],
  outputFileTracingExcludes:{"/*":["./.local-demo/**","./.env*"]} };
export default nextConfig;
