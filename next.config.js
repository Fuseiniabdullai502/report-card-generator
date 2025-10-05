

/** @type {import('next').NextConfig} */
const nextConfig = {
  /* config options here */
  experimental: {
    unstable_allowDynamic: [
      // This is required for the Genkit dependency 'require-in-the-middle'
      '**/node_modules/require-in-the-middle/index.js',
    ],
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'placehold.co',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https' ,
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
};

module.exports = nextConfig;
