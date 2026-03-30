module.exports = {
  apps: [
    {
      name: 'wa-gtm-worker',
      script: './src/index.js',
      cwd: __dirname,
      interpreter: 'node',
      node_args: '--experimental-specifier-resolution=node',
      env: {
        NODE_ENV: 'production',
      },
      // Restart management
      max_restarts: 10,
      min_uptime: 5000,
      restart_delay: 3000,
      autorestart: true,

      // Logging
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
      error_file: './logs/worker-error.log',
      out_file: './logs/worker-out.log',
      merge_logs: true,

      // Resource limits
      max_memory_restart: '500M',

      // Watch (disabled in production)
      watch: false,
    },
  ],
};
