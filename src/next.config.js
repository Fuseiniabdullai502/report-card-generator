
/** @type {import('next').NextConfig} */
const nextConfig = {
  /* config options here */
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'placehold.co',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'upload.wikimedia.org',
        port: '',
        pathname: '/**',
      },
      {
        protocol: "https",
        hostname: "firebasestorage.googleapis.com",
        port: "",
        pathname: "/**",
      },
    ],
  },
  webpack: (
    config,
    { buildId, dev, isServer, defaultLoaders, nextRuntime, webpack }
  ) => {
    if (isServer) {
      config.externals.push(
        'handlebars',
        'express',
        '@opentelemetry/api',
        '@opentelemetry/sdk-trace-base',
        '@opentelemetry/sdk-trace-node',
        '@opentelemetry/semantic-conventions',
        'firebase-admin',
        'long'
      );
    }
    return config
  },
};

module.exports = nextConfig;
