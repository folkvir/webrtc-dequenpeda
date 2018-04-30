const shell = require('shelljs')
const commander = require('commander')
const path = require('path')

commander
  .option('-i, --input <inoput>', 'Input path to results dir')
  .parse(process.argv)

if(!commander.input) commander.help()

try {
  const p = path.resolve(commander.input)
  computeGlobalCompleteness(p)
  computeGlobalMessageCompleteness(p)
} catch (e) {
  throw e
}

function computeGlobalCompleteness(p) {
  const plotScriptPath = path.resolve(path.join(__dirname, "./plots/completeness.gnuplot"))
  const plot = `gnuplot -e "input='${p}/*/global-completeness.csv'" -e "outputname='${p}/globalcompleteness.png'" ${plotScriptPath}`
  console.log(plot)
  const plotExec = shell.exec(plot)
}

function computeGlobalMessageCompleteness(p) {
  const plotScriptPath = path.resolve(path.join(__dirname, "./plots/message.gnuplot"))
  const plot = `gnuplot -e "input='${p}/*/global-completeness.csv'" -e "outputname='${p}/messages.png'" ${plotScriptPath}`
  console.log(plot)
  const plotExec = shell.exec(plot)
}
