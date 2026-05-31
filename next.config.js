/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,

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
