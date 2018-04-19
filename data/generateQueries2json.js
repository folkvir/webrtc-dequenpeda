const fs = require('fs')
const path = require('path')
const readline = require('readline')

const config = {
  datasets: [
    { dir: "./diseasome", global: "queries.txt", queries: 'queries2execute.txt' },
    { dir: "./geocoordinates", global: "queries.txt", queries: 'queries2execute.txt' },
    { dir: "./linkedmdb", global: "queries.txt", queries: 'queries2execute.txt' }
  ]
}

const globalQueries = []
config.datasets.reduce((datasetAcc, dataset) => datasetAcc.then((res) => {
  return new Promise((resolve, reject) => {
    const queries = []
    const queries2execute = []
    const queriesPath = path.resolve(dataset.dir+'/queries/', dataset.global)
    const queries2executePath = path.resolve(dataset.dir+'/queries/', dataset.queries)
    console.log(dataset, queriesPath, queries2executePath)
    let lineReader = readline.createInterface({
      input: fs.createReadStream(queries2executePath)
    })

    lineReader.on('line', function (line) {
      queries2execute.push(parseInt(line))
    })

    lineReader.on('close', () => {
      console.log('Number of queries 2 execute: ', queries2execute.length)
      let lineReader2 = readline.createInterface({
        input: fs.createReadStream(queriesPath)
      })
      let count = 1
      lineReader2.on('line', function (line) {
        queries2execute.includes(count) && queries.push(line)
        count++
      })
      lineReader2.on('close', function (line) {
        console.log('Queries found: ', queries.length)
        fs.writeFileSync(path.resolve(dataset.dir+'/queries/', 'queries.json'), JSON.stringify(queries, null, '\t'), 'utf8')
        globalQueries.push(...queries)
        resolve()
      })
    })
  })
}), Promise.resolve()).then(() => {
  fs.writeFileSync(path.resolve(__dirname, 'globalQueries2execute.json'), JSON.stringify(globalQueries, null, '\t'), 'utf8')
  console.log('Generated.', globalQueries.length, 'queries.')
}).catch(e => {
  console.error(e)
})
