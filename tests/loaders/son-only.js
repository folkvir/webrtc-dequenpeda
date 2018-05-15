const shell = require('shelljs')
const uniqid = require('uniqid')
const id = uniqid()
commands = [
  "pm2 start ./tests/loaders/auto-shuffle/son-pm2.js --no-autorestart --name auto-son-"+id,
  "pm2 start ./tests/loaders/auto-shuffle/son-pm2-half.js --no-autorestart --name auto-son-half-"+id,
  "pm2 start ./tests/loaders/auto-shuffle/son-pm2-quarter.js --no-autorestart --name auto-son-quarter-"+id
]

commands.forEach(command => {
    shell.exec(command)
})
