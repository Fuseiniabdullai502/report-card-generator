

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
    // This is the correct way to handle server-only packages in Next.js.
    // They should not be bundled for the client.
    if (!isServer) {
        config.externals.push(
            'firebase-admin'
        );
    }
    return config
  },
};

module.exports = nextConfig;


