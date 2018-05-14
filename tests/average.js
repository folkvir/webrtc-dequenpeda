const shell = require('shelljs')
const csv = require('fast-csv')
const commander = require('commander')
const path = require('path')
const fs = require('fs')

console.log('[WARNING] it requires gnuplot')

if (!shell.which('git')) {
  shell.echo('Sorry, this script requires gnuplot');
  shell.exit(1);
}

const head = "auto-round-"
const patterns = [
  "full-rps",
  "full-half",
  "full-quarter",
  "full-son-only",
  "full-son-half",
  "full-son-quarter"
]

commander.option('-p, --path <path>', 'path to all results', (e) => path.resolve(e)).parse(process.argv)

if(!commander.path) commander.help()

patterns.reduce((acc, pattern) => acc.then(() => {
  return average(pattern)
}), Promise.resolve()).then(() => {
  console.log('Finished to process average')
  shell.exec(`gnuplot -e "path='${commander.path}/'" ${path.join(__dirname, './plots/completeness-static.gnuplot')}`)
  // // dont try this or you will regret this
  // shell.ls('-R', commander.path+'/**/last*.json').forEach(file => {
  //   shell.exec('python3 ./graphs/graph.py '+file, {async: true})
  // })
})

function average(pattern) {
  console.log('Processing %s...', pattern)
  return new Promise((resolve, reject) => {
    const p = commander.path+'/'+head+'*-'+pattern+'*/'+'global-completeness.csv'
    console.log('Reading %s ...', p)
    const files = shell.ls('-R', p)
    let results = []
    files.reduce((acc, cur) => acc.then(() => {
      return read(cur).then((r) => {
        results.push(r)
        return Promise.resolve()
      }).catch(e => Promise.reject(e))
    }), Promise.resolve()).then(() => {
      console.log('Number of files to process average: ', results.length)
      const average = []
      fs.writeFileSync(commander.path+'/'+pattern+'-global-completeness.csv', ["round","globalcompleteness","globalcompletenesscompleted","globalcompletenessincresults","messages","messagesround","messagesbound","completeQueries","queriesNumber","obtainedresults","wantedresults","timedout"].join(',')+'\n', 'utf8')


      let messagesround = 0
      for(let i =0; i<results[0].length; ++i) {
        const topush = {
          round: 0,
          globalcompleteness: 0,
          globalcompletenesscompleted: 0,
          globalcompletenessincresults: 0,
          messages: 0,
          messagesround: 0,
          bound: 0,
          completeQueries: 0,
          queriesNumber: 0,
          obtainedresults: 0,
          wantedresults: 0,
          timedout: 0
        }
        for(let j = 0; j<results.length;++j) {
          const val = results[j][i]
          // console.log(val, Object.values(val).length)
          topush.round = parseFloat(val.round)
          topush.completeQueries = parseFloat(val.completeQueries)
          topush.queriesNumber = parseFloat(val.queriesNumber)
          topush.wantedresults = parseFloat(val.wantedresults)
          topush.timedout = parseFloat(val.timedout)
          topush.bound = topush.queriesNumber * 10
          topush.obtainedresults += parseFloat(val.obtainedresults)
          topush.globalcompleteness += parseFloat(val.globalcompleteness)
          topush.globalcompletenesscompleted += parseFloat(val.globalcompletenesscompleted)
          topush.globalcompletenessincresults += parseFloat(val.globalcompletenessincresults)
          topush.messages += parseFloat(val.messages)
        }
        topush.obtainedresults = topush.obtainedresults / results.length
        topush.globalcompleteness = topush.globalcompleteness / results.length
        topush.globalcompletenesscompleted = topush.globalcompletenesscompleted / results.length
        topush.globalcompletenessincresults = topush.globalcompletenessincresults / results.length
        topush.messages = topush.messages / results.length
        topush.messagesround = topush.messages - messagesround
        messagesround = topush.messages
        const towrite = Object.values(topush)
        // console.log(topush.messagesround)

        fs.appendFileSync(commander.path+'/'+pattern+'-global-completeness.csv', towrite.join(',')+'\n', 'utf8')
      }
      resolve()
    }).catch(e => {
      reject(e)
    })
  })
}

function read(file) {
  console.log('reading %s', file)
  return new Promise((resolve, reject) => {
    let stream = fs.createReadStream(file);
    const results = []
    let csvStream = csv({headers: true})
        .on("data", function(data){
             results.push(data)
        })
        .on("end", function(){
             resolve(results)
        });
    stream.pipe(csvStream);
  })
}
