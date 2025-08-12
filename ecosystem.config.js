module.exports = {
  apps: [
    {
      name: 'discord-bot-lgc',
      script: 'index.js',
      watch: ['.'],
      ignore_watch: ['node_modules', 'data', 'logs', '*.log'],
      watch_options: {
        followSymlinks: false,
        usePolling: true,
      },
      autorestart: true,
      restart_delay: 1000,
      env: {
        NODE_ENV: 'development',
      },
      env_production: {
        NODE_ENV: 'production',
        watch: false,
      },
    },
  ],
}
