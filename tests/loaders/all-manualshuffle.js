const shell = require('shelljs')
const uniqid = require('uniqid')
const id = uniqid()
commands = [
  "pm2 start ./tests/loaders/manual-shuffle/rps-pm2.js --no-autorestart --name manual-rps-"+id,
  "pm2 start ./tests/loaders/manual-shuffle/son-pm2.js --no-autorestart --name manual-son-"+id,
  "pm2 start ./tests/loaders/manual-shuffle/rps-pm2-half.js --no-autorestart --name manual-rps-half-"+id,
  "pm2 start ./tests/loaders/manual-shuffle/son-pm2-half.js --no-autorestart --name manual-son-half-"+id,
  "pm2 start ./tests/loaders/manual-shuffle/rps-pm2-quarter.js --no-autorestart --name manual-rps-quarter-"+id,
  "pm2 start ./tests/loaders/manual-shuffle/son-pm2-quarter.js --no-autorestart --name manual-son-quarter-"+id,
]

commands.forEach(command => {
    shell.exec(command)
})
