const fs = require('fs')
const path = require('path')
const shuffle = require('lodash.shuffle')
const assert = require('assert')

const config = {
  divisionfactor: 0.5,
  divisionnumber: 2, // full to quarter = 3 pieces
  datasets: [
    { name: 'diseasome', data: "../../data/diseasome/fragments/", queries: "../../data/diseasome/queries/queries.json", results: "../../data/diseasome/results/", withoutQueries: ['q91.json', 'q92.json', 'q61.json', 'q53.json']},
    { name: 'linkedmdb', data: "../../data/linkedmdb/fragments/", queries: "../../data/linkedmdb/queries/queries.json", results: "../../data/linkedmdb/results/", withoutQueries: []},
    // { name: 'geocoordinates', data: "../data/geocoordinates/fragments/", queries: "../data/geocoordinates/queries/queries.json", results: "../data/geocoordinates/results/", withoutQueries: []}
  ]
}

console.log('Number of pieces: ', config.divisionnumber)
console.log('Division factor: ', config.divisionfactor)

let round = 0
loadQueries(config).then((queries) => {
  console.log('Number of bucket: ', queries.length)

  // queries = [[1, 3], [4, 2]]
  let allinone = queries.reduce((acc, cur) => (acc.push(...cur),acc), [])


  // STEP 1
  // shuffle in a Fisher-Yates like
  allinone = shuffle(allinone)

  console.log('Size of the full queries:', allinone.length)
  const fullsize = allinone.length
  fs.writeFileSync('full-queries.json', JSON.stringify(allinone, null, '\t'), 'utf8')
  const before = [allinone]
  // STEP config.divisionnumber
  for(let i = 0; i<config.divisionnumber; i++) {
    const newsize = Math.floor(fullsize / (i+1)*config.divisionfactor)
    console.log('Size of the new bucket: ', newsize)
    const newarray = roundrobintolimit(queries, newsize, fullsize)
    newarray.forEach(q => {
      // just assert to be sure that all new queries are included into the last created
      assert.notEqual(before[before.length-1].findIndex((a => a.query === q.query)), -1)
    })
    console.log('Creating the new bucket...')
    console.log(newarray.length)
    fs.writeFileSync(`full-${newsize}-queries.json`, JSON.stringify(newarray, null, '\t'), 'utf8')
    before.push(newarray)
  }
})

function roundrobintolimit(queries, newsize, max) {
  let pick = 0
  const result = []
  for(let i =0; i<newsize; i++) {
    const res = pickinto(pick, queries, newsize, max)
    if(res.length > 0) pick++
    result.push(...res)
  }
  return result
  function pickinto(i, queries, newsize, max) {
    const mod = i % queries.length
    if(i < queries[mod].length && i < newsize ) {
      return [queries[mod][pick]]
    } else {
      console.log(mod, i, max)
      return pickinto(pick+1, queries, newsize, max)
    }
  }
}

/**
 * Load queries and return an array of array of queries with their results number [[{query: '...', filename: 'q1.rq', card: 2}, ...], ...]
 * @param  {[type]} config           [description]
 * @return {[type]}                  [description]
 */
function loadQueries (config) {
  return new Promise((resolve, reject) => {
    config.datasets.reduce((datasetsAcc, dataset) => datasetsAcc.then((resultGlobal) => {
      return new Promise((res, rej) => {
        console.log(dataset)
        const qPath = path.resolve(path.join(__dirname, dataset.queries))
        let queries = require(qPath)
        queries = queries.filter(e => {
          return !dataset.withoutQueries.includes(e.filename)
        })
        res([...resultGlobal, queries])
      })
    }), Promise.resolve([])).then((results) => {
      resolve(results)
    }).catch(e => {
      console.log(e)
      reject(e)
    })
  })
}
