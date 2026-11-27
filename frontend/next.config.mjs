const backend = (process.env.API_ORIGIN || "http://127.0.0.1:8000").replace(
  /\/$/,
  "",
);
export default {
  poweredByHeader: false,
  async rewrites() {
    return [{ source: "/api/:path*", destination: backend + "/api/:path*" }];
  },
};
