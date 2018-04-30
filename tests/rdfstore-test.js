const rdfstore = require('rdfstore')
const SparqlParser = require('sparqljs').Parser
const SparqlGenerator = require('sparqljs').Generator
const generator = new SparqlGenerator()
const parser = new SparqlParser()
rdfstore.Store.yieldFrequency(200);
const path = require('path')
const fs = require('fs')
const shell = require('shelljs')

const datasets = [
  { name: 'diseasome', data: "../data/diseasome/fragments/", queries: "../data/diseasome/queries/queries.json", results: "../data/diseasome/results/", withoutQueries: ['q91.json', 'q92.json', 'q61.json', 'q53.json']},
  { name: 'linkedmdb', data: "../data/linkedmdb/fragments/", queries: "../data/linkedmdb/queries/queries.json", results: "../data/linkedmdb/results/", withoutQueries: []},
  //{ name: 'geocoordinates', data: "../data/geocoordinates/fragments/", queries: "../data/geocoordinates/queries/queries.json", results: "../data/geocoordinates/results/", withoutQueries: []}
]

const graph = 'http://tonyparker'



let extractFilename = (pathData, max) => new Promise((resolve, reject) => {
  try {
    let i = 0
    let res = []
    console.log('Searching for: ', pathData + '/*.ttl')
    res = shell.ls(pathData + '/*.ttl')//.forEach(function (file) {
    resolve(res)
  } catch (e) {
    reject(e)
  }
})

const begin = new Date()

datasets.reduce((acc, dataset)  => acc.then(() => {
  return new Promise((resolve, reject) => {
    extractFilename(path.resolve(path.join(__dirname, dataset.data))).then((files) => {
      new Store({}, function(err,store){
        files.reduce((a, f) => a.then(() => {
          return load(store, f)
        }), Promise.resolve()).then(() => {
          console.log('all loaded')
          let queries = require(path.resolve(path.join(__dirname, dataset.queries)))
          console.log('Number of queries', queries.length)

          queries.reduce((accQ, query, i) => accQ.then(() => {
            return new Promise((resolve2, reject2) => {
              let q = queries[i].query
              const plan = parser.parse(q)
              plan.from = { default: [graph], named: [] }
              const q2 = generator.stringify(plan)
              execute(store, q2).then((res) => {
                const query = require(path.resolve(path.join(__dirname, `../data/${dataset.name}/results/q`+i+'.json')))
                const completeness = res.length / query.card * 100
                console.log('Q%f Completeness: ', i, completeness, query.card)
                if(completeness !== 100) {
                  console.log(q, q2, res)
                  // reject2()
                }
                resolve2()
              }).catch(e => {
                console.log(q, q2)
                reject2(e)
              })
            })
          }), Promise.resolve()).then(() => {
            resolve()
          })
        })
      });
    })
  })
}), Promise.resolve()).then(() => {
  const end = new Date()
  const time = end.getTime() - begin.getTime()
  console.log('Executed in %f (ms)', time)
})



function execute(store, query) {
  return new Promise((resolve, reject) => {
    store.execute(query, function(err,results) {
      if(err) resolve({err})
      resolve(results)
    });
  })
}

function load(store, f) {
  return new Promise((resolve, reject) => {
    console.log('Loading: ', f)
    store.load('text/turtle', fs.readFileSync(f, 'utf8'), graph, function(err) {
      if(err) {
        console.error(err)
        reject(err)
      }
      resolve()
    });
  })
}
