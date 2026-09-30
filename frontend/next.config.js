/** @type {import('next').NextConfig} */
const nextConfig = {};

nextConfig.rewrites = async () => {
  const backendUrl = (process.env.BACKEND_INTERNAL_URL || "http://127.0.0.1:5000").replace(/\/$/, "");
  return [
    {
      source: "/_api/:path*",
      destination: `${backendUrl}/:path*`,
    },
  ];
};

module.exports = nextConfig;
