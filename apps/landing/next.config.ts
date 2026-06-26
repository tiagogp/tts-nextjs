import path from "node:path";
import type { NextConfig } from "next";

// The landing reuses the desktop app's UI (src/* of the repo root) through the
// `@/*` tsconfig alias. `externalDir` lets Next compile those files even though
// they live outside this app's directory; `outputFileTracingRoot` points file
// tracing at the monorepo root so the build resolves the shared sources.
const nextConfig: NextConfig = {
  experimental: {
    externalDir: true,
  },
  outputFileTracingRoot: path.join(__dirname, "..", ".."),
};

export default nextConfig;
