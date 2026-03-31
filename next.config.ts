import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* turbopack.root: set if Next infers wrong workspace when multiple lockfiles exist */
  serverExternalPackages: ["pdf-parse"],
};

export default nextConfig;
