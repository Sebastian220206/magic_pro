/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,

  // `standalone` emits `.next/standalone/server.js` with its own trimmed
  // `node_modules`, which is what the Dockerfile copies. It is opt-in because
  // Vercel does its own bundling and does not want it — leaving it on
  // unconditionally just makes every deploy slower for no benefit.
  output: process.env.BUILD_STANDALONE === '1' ? 'standalone' : undefined,

  /**
   * The single source of truth for response headers.
   *
   * `vercel.json` also had a `headers` block, and none of its cache rules ever
   * reached production: for a Next.js project Vercel deploys the routing this
   * function produces, and the vercel.json entries are not merged in. The
   * security headers below appeared to work only because they were duplicated
   * in both files. Confirmed against the live deployment — /worklets/, /wasm/
   * and /audio/ were all serving `max-age=0, must-revalidate` despite a
   * year-long immutable rule sitting in vercel.json.
   *
   * Defining them here also means they apply to `next start` and the Docker
   * image, not only to Vercel.
   */
  async headers() {
    /**
     * Content-addressed or versioned assets that never change under the same
     * name. The General MIDI bank is the one that matters: ~31 MB, fetched
     * before any instrument can sound, and revalidated on every page load
     * without this. If a bank is ever replaced, change its filename rather
     * than weakening the rule.
     */
    const immutable = [
      { key: 'Cache-Control', value: 'public, max-age=31536000, immutable' },
    ];

    return [
      {
        source: '/soundfonts/:path*',
        headers: immutable,
      },
      {
        source: '/worklets/:path*',
        headers: immutable,
      },
      {
        source: '/wasm/:path*',
        headers: immutable,
      },
      {
        source: '/audio/:path*',
        headers: immutable,
      },
      {
        // Auth responses set cookies and must never be held by a shared cache.
        source: '/api/auth/:path*',
        headers: [
          { key: 'Cache-Control', value: 'no-store, no-cache, must-revalidate' },
        ],
      },
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
