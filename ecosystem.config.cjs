// PM2 ecosystem configuration for the `outlethub` production web service.
//
// SECURITY: do NOT add passwords, JWT secrets, API keys, or credentials to this
// file. The remaining required environment variables (DATABASE_URL,
// JWT_ACCESS_SECRET, JWT_REFRESH_SECRET, REDIS_URL, CLIENT_URL, SMTP_*, etc.)
// must be merged into the `env` block from the current VPS process before first
// start (run `pm2 env outlethub` on the server). Keep secret values on the
// server only.

module.exports = {
  apps: [
    {
      name: "outlethub",
      cwd: "./server",
      script: "npm",
      args: "start",
      env: {
        NODE_ENV: "production",
        TRUSTED_PROXY_MODE: "forwarded",
        TRUSTED_PROXY_IPS: "127.0.0.1",
      },
    },
  ],
};
