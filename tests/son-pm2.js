const shell = require('shelljs')

// need to use pm2 start tests/xp-pm2.js --no-autorestart
const round = 3
const commands = [
  "node --max_old_space_size=100000 ./tests/query-normal-test-wo-webrtc --config ./tests/configs/full-son.js",
]

let rounds = []
for(let i = 0; i< round; i++) {
  rounds.push(i)
}

rounds.reduce((acc, r) => acc.then(() => {
  return exec(command)
}), Promise.resolve()).then(() => {
  console.log('RPS+SON finished all rounds.')
})

function exec(command) {
  return new Promise((resolve, reject) => {
    const child = shell.exec(command, {async: true})
    child.stdout.on('data', (data) => {
      console.log(data)
    });
    child.stderr.on('data', (data) => {
      console.log(data)
    });
    child.on('close', (code) => {
      console.log(`Command: ${command} exited with code ${code}`);
      resolve()
    });
  })
}
