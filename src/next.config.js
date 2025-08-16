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
    config.externals.push({
      '@opentelemetry/instrumentation': 'commonjs @opentelemetry/instrumentation',
      '@opentelemetry/sdk-node': 'commonjs @opentelemetry/sdk-node',
      'dotenv': 'commonjs dotenv',
      'express': 'commonjs express',
      'firebase-functions': 'commonjs firebase-functions',
      'firebase-admin': 'commonjs firebase-admin',
      'request-ip': 'commonjs request-ip',
      'util': 'commonjs util',
      'handlebars': 'commonjs handlebars',
      'best-effort-json-parser': 'commonjs best-effort-json-parser',
    })
    return config
  },
};

module.exports = nextConfig;
