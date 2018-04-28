const shell = require('shelljs')

commands = [
  "pm2 start ./tests/loaders/rps-pm2.js --no-autorestart",
  "pm2 start ./tests/loaders/son-pm2.js --no-autorestart",
  "pm2 start ./tests/loaders/rps-pm2-half.js --no-autorestart",
  "pm2 start ./tests/loaders/son-pm2-half.js --no-autorestart",
  "pm2 start ./tests/loaders/rps-pm2-quarter.js --no-autorestart",
  "pm2 start ./tests/loaders/son-pm2-quarter.js --no-autorestart",
]

commands.forEach(command => {
    shell.exec(command)
})
