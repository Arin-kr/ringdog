/** @type {import('next').NextConfig} */
const nextConfig = {
  // Produces a minimal standalone server bundle for the Docker runtime
  // stage (see Dockerfile) instead of requiring the full node_modules tree.
  output: "standalone",
  reactStrictMode: true,
  // Lets the Datadog RUM SDK start the JS Self-Profiling API (browser
  // profiling); without it the profiler fails with "js-profiling is not
  // allowed in this document".
  async headers() {
    return [{ source: "/:path*", headers: [{ key: "Document-Policy", value: "js-profiling" }] }];
  },
};

module.exports = nextConfig;
