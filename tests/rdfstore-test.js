const rdfstore = require('rdfstore')
const SparqlParser = require('sparqljs').Parser
const SparqlGenerator = require('sparqljs').Generator
const generator = new SparqlGenerator()
const parser = new SparqlParser()
rdfstore.Store.yieldFrequency(200);
const path = require('path')
const fs = require('fs')
const shell = require('shelljs')

const graph = 'http://tonyparker'
const graph2 = `<${graph}>`
const dataset = 'diseasome'

let queries = require(path.resolve(path.join(__dirname, `../data/${dataset}/queries/queries.json`)))
console.log('Number of queries', queries.length)

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

extractFilename(path.resolve(path.join(__dirname, `../data/${dataset}/fragments`))).then((files) => {
  new Store({}, function(err,store){
    files.reduce((a, f) => a.then(() => {
      return load(store, f)
    }), Promise.resolve()).then(() => {
      console.log('all loaded')
      for(let i = 0; i<queries.length; i++) {
        let q = queries[i]
        const plan = parser.parse(q)
        plan.from = { default: [graph], named: [] }
        const q2 = generator.stringify(plan)
        execute(store, q2).then((res) => {
          const query = require(path.resolve(path.join(__dirname, `../data/${dataset}/results/q`+i+'.json')))
          const completeness = res.length / query.length * 100
          console.log('Q%f Completeness: ', i, completeness, query.length)
          if(completeness !== 100) console.log(q, q2, res)
          return Promise.resolve()
        }).catch(e => {
          console.log(q, q2)
          return Promise.reject(e)
        })
      }
      // return queries.reduce((accQuery, q, i) => accQuery.then(() => {
      //
      // }), Promise.resolve()).then(() => {
      //   console.log('all executed')
      //   return Promise.resolve()
      // }).catch(e => {
      //   console.error(e)
      //   return Promise.reject(e)
      // })
    })
  });
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
