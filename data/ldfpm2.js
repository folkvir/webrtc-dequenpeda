const shell = require('shelljs')
try {
  if (!shell.which('ldf-server')) {
    shell.exec('nopm install -g ldf-server')
  }
} catch (e) {
  console.error(e)
  process.exit(1)
}
shell.exec('ldf-server ldfconfignormal.json 5678 12')
