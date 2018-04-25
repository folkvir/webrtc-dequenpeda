const shell = require('shelljs')
const commander = require('commander')
const path = require('path')
const fs = require('fs')

commander
  .option('-f, --file <file>', '', (e) => path.resolve(e))
  .parse(process.argv)

if(!commander.file) commander.help()
