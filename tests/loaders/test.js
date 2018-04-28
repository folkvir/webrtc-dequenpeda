const shell = require('shelljs')

commands = [
  "pm2 start ./tests/loaders/test-pm2.js --no-autorestart",
]

commands.forEach(command => {
    shell.exec(command)
})
