const shell = require('shelljs')

// need to use pm2 start tests/xp-pm2.js --no-autorestart

const commands = [
  // "node --max_old_space_size=4092 ./tests/query-normal-test-wo-webrtc --config ./tests/configs/default.js",
  "node --max_old_space_size=100000 ./tests/query-normal-test-wo-webrtc --config ./tests/configs/full.js",
  "node --max_old_space_size=100000 ./tests/query-normal-test-wo-webrtc --config ./tests/configs/full-son.js",
]

commands.forEach(command => {
  shell.exec(command)
})
