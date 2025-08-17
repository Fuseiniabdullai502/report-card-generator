
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
    { isServer }
  ) => {
    if (isServer) {
      config.externals.push(
        'handlebars',
        'express',
        'firebase-admin',
        'long',
        '@opentelemetry/api',
        '@opentelemetry/core',
        '@opentelemetry/instrumentation',
        '@opentelemetry/resources',
        '@opentelemetry/sdk-trace-base',
        '@opentelemetry/sdk-trace-node',
        '@opentelemetry/semantic-conventions',
        'require-in-the-middle',
        'async_hooks',
        '@opentelemetry/exporter-jaeger',
        '@opentelemetry/exporter-trace-otlp-grpc',
        'grpc'
      );
    }
    return config
  },
};

module.exports = nextConfig;
