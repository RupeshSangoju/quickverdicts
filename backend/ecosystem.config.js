// =============================================
// PM2 Ecosystem Configuration
// =============================================
// For production deployment with PM2 process manager
//
// Usage:
//   pm2 start ecosystem.config.js --env production
//   pm2 reload ecosystem.config.js
//   pm2 stop all
//   pm2 logs

module.exports = {
  apps: [
    {
      // Application name
      name: 'quickverdicts-backend',

      // Script to run
      script: './index.js',

      // Instances (use 'max' to utilize all CPU cores, or specify a number)
      instances: process.env.PM2_INSTANCES || 'max',

      // Execution mode: 'cluster' for load balancing, 'fork' for single instance
      exec_mode: 'cluster',

      // Watch for file changes and restart (disable in production)
      watch: false,

      // Maximum memory before restart (helps prevent memory leaks)
      max_memory_restart: '1G',

      // Environment variables for production
      env_production: {
        NODE_ENV: 'production',
        PORT: 4000,
        HOST: '0.0.0.0',
      },

      // Environment variables for development
      env_development: {
        NODE_ENV: 'development',
        PORT: 4000,
        HOST: '0.0.0.0',
      },

      // Logging
      error_file: './logs/err.log',
      out_file: './logs/out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,

      // Auto restart configuration
      autorestart: true,
      max_restarts: 10,
      min_uptime: '10s',

      // Kill timeout
      kill_timeout: 5000,

      // Wait time before restart
      wait_ready: true,
      listen_timeout: 10000,

      // Graceful shutdown
      shutdown_with_message: true,

      // Advanced features
      instance_var: 'INSTANCE_ID',
    },
  ],

  // Deployment configuration (optional)
  deploy: {
    production: {
      user: 'node',
      host: 'your-server.com',
      ref: 'origin/main',
      repo: 'git@github.com:your-repo/quickverdicts.git',
      path: '/var/www/quickverdicts-backend',
      'post-deploy': 'npm install && pm2 reload ecosystem.config.js --env production',
    },
  },
};
