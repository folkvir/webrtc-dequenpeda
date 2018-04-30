const shell = require('shelljs')
const uniqid = require('uniqid')
const id = uniqid()
commands = [
  "pm2 start ./tests/loaders/auto-shuffle/rps-pm2.js --no-autorestart --name rps"+id,
  "pm2 start ./tests/loaders/auto-shuffle/son-pm2.js --no-autorestart --name son"+id,
  "pm2 start ./tests/loaders/auto-shuffle/rps-pm2-half.js --no-autorestart --name rps-half"+id,
  "pm2 start ./tests/loaders/auto-shuffle/son-pm2-half.js --no-autorestart --name son-half"+id,
  "pm2 start ./tests/loaders/auto-shuffle/rps-pm2-quarter.js --no-autorestart --name rps-quarter"+id,
  "pm2 start ./tests/loaders/auto-shuffle/son-pm2-quarter.js --no-autorestart --name son-quarter"+id,
]

commands.forEach(command => {
    shell.exec(command)
})
