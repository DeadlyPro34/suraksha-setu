/** @type {import('next').NextConfig} */
const nextConfig = {};

nextConfig.rewrites = async () => {
  const backendUrl = (process.env.BACKEND_INTERNAL_URL || "http://localhost:8000").replace(/\/$/, "");
  return [
    {
      source: "/_api/:path*",
      destination: `${backendUrl}/:path*`,
    },
  ];
};

module.exports = nextConfig;
