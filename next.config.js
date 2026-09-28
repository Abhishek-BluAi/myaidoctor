/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  allowedDevOrigins: [
    "http://192.168.233.128",
    "http://192.168.233.128:3000",
    "http://localhost",
    "http://localhost:3000",
  ],
};

module.exports = nextConfig;
