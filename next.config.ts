import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  agentRules: false,
  // Stock, quotes, and sessions are request-specific. Cache Components would
  // force every portal route behind a Suspense boundary for cookies().
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  serverExternalPackages: ["xlsx"],
};

export default nextConfig;
