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

      // Restart policy.
      //
      // `max_restarts` counts *unstable* restarts — ones where the process died
      // before `min_uptime`. Without `min_uptime` set, pm2 treated every restart
      // as unstable, so ten crashes spread over months would permanently stop the
      // app with nothing reporting it. With a 60s stability window the counter
      // resets once the app has actually stayed up, so only a genuine crash-loop
      // exhausts the budget.
      min_uptime: '60s',
      max_restarts: 50,
      // Backs off 1s, 2s, 4s… instead of hammering a failing dependency every 5s.
      exp_backoff_restart_delay: 1000,
      watch: false,
    },
  ],
}
