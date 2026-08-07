/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,

  // `standalone` emits `.next/standalone/server.js` with its own trimmed
  // `node_modules`, which is what the Dockerfile copies. It is opt-in because
  // Vercel does its own bundling and does not want it — leaving it on
  // unconditionally just makes every deploy slower for no benefit.
  output: process.env.BUILD_STANDALONE === '1' ? 'standalone' : undefined,

  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          // Cross-Origin Isolation (required for SharedArrayBuffer + AudioWorklet shared memory transport)
          { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
          { key: 'Cross-Origin-Embedder-Policy', value: 'require-corp' },
          { key: 'Cross-Origin-Resource-Policy', value: 'cross-origin' },

          // Security
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          {
            key: 'Permissions-Policy',
            value: [
              'camera=()',
              'microphone=(self)',
              'midi=(self)',
              'display-capture=(self)',
              'clipboard-write=(self)',
              'clipboard-read=(self)',
            ].join(', '),
          },
        ],
      },
    ];
  },
};

module.exports = nextConfig;
