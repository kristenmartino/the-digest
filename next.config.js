/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    // Allow news article images from any domain
    remotePatterns: [{ protocol: "https", hostname: "**" }],
  },
};

module.exports = nextConfig;
