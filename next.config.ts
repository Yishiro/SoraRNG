import type { NextConfig } from 'next';
const config: NextConfig = {
  // Keep normal local builds; Docker uses a minimal standalone Node server.
  output: process.env.SORA_STANDALONE === '1' ? 'standalone' : undefined,
  // OAuth codes and state must not appear in development request logs.
  logging: { incomingRequests: { ignore: [/^\/api\/auth\//] } },
};
export default config;
