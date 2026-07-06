/** @type {import('next').NextConfig} */
const nextConfig = {
  // Produces a minimal standalone server bundle for the Docker runtime
  // stage (see Dockerfile) instead of requiring the full node_modules tree.
  output: "standalone",
  reactStrictMode: true,
};

module.exports = nextConfig;
