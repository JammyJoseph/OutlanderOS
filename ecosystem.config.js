module.exports = {
  apps: [
    {
      name: 'outlanderos',
      script: 'node_modules/.bin/next',
      args: 'start -p 3000',
      instances: 1, // Keep at 1 for now (4GB server)
      exec_mode: 'fork',
      max_memory_restart: '3G',
      env: {
        NODE_ENV: 'production',
        NODE_OPTIONS: '--max-old-space-size=3584',
      },
      error_file: '/root/.pm2/logs/outlanderos-error.log',
      out_file: '/root/.pm2/logs/outlanderos-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
      max_restarts: 10,
      restart_delay: 5000,
      watch: false,
    },
  ],
}
