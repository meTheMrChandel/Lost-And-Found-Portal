import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  /* config options here */
  cacheComponents: true,
  partialPrefetching: true,
  experimental: {
    agentUpgrade: "security",
    // Every page loads its data in the browser after the client-side auth check, so
    // dev-mode instant-navigation validation only flagged pages that can never be instant
    // (e.g. all of /admin). Validate only segments that opt in with `export const instant`.
    instantInsights: {
      validationLevel: "manual-warning",
    },
  },
  // Tailwind is wired up in postcss.config.mjs, which both Turbopack (dev) and webpack (build) read
};

export default nextConfig;
