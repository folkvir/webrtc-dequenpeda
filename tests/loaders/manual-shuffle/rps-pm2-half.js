const shell = require('shelljs')
const config = require('../config')

const round = config.rounds
const commands = [
  "node --max_old_space_size=100000 ./tests/query-normal-test-wo-webrtc --manualshuffle --config ./tests/configs/full-half.js",
]

let rounds = []
for(let i = 0; i< round; i++) {
  rounds.push(i)
}

rounds.reduce((acc, r, ind) => acc.then(() => {
  return exec(commands[0] + " --name manual-round-"+ind)
}), Promise.resolve()).then(() => {
  console.log('RPS finished all rounds.')
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
