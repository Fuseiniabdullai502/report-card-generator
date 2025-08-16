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
    ],
  },
   webpack: (
    config,
    { isServer }
  ) => {
    if (isServer) {
      // These packages are required by Genkit, but cause trouble with webpack.
      // Mark them as external so they're not packaged.
      config.externals.push('dtrace-provider', 'opentelemetry-instrumentation-grpc', 'require-in-the-middle', 'handlebars');
    }
    
    return config
  }
};

module.exports = nextConfig;
