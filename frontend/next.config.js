/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  async rewrites() {
    return {
      afterFiles: [
        {
          source: '/bind',
          destination: 'http://localhost:8000/bind',
        },
        {
          source: '/track',
          destination: 'http://localhost:8000/track',
        },
        {
          source: '/trackings',
          destination: 'http://localhost:8000/trackings',
        },
        {
          source: '/packet-status',
          destination: 'http://localhost:8000/packet-status',
        },
        {
          source: '/bindings',
          destination: 'http://localhost:8000/bindings',
        },
      ],
    };
  },
};

module.exports = nextConfig;

