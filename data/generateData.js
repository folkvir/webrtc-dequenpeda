const fs = require('fs')
const path = require('path')
const shell = require('shelljs')
const ldfclient = require('ldf-client')
const N3 = require('n3')
const Writer = N3.Writer
const chunk = require('lodash.chunk')

ldfclient.Logger.setLevel('warning')

const config = {
  fragmentationFactor: 0.5,
  server: 'http://localhost:5678',
  datasets: [
    { dir: "./diseasome", uri: "/diseasome" },
    //{ dir: "./geocoordinates", uri: "/geocoordinates" },
    //{ dir: "./linkedmdb", uri: "/linkedmdb" }
  ]
}

let globalCount = 0
let globalCountFragmented = 0

config.datasets.reduce((datasetAcc, dataset) => datasetAcc.then(() => {
  return new Promise((resolve, reject) => {
    console.log(dataset)
    const files = shell.ls(dataset.dir+'/construct/view*')
    const server = config.server+dataset.uri

    const destination = path.resolve(dataset.dir+'/fragments/')
    // create the destination
    if (!fs.existsSync(destination)) shell.mkdir('-p', destination)

    files.reduce((filesAcc, f) => filesAcc.then(() => {
      return readFile(f).then((query) => {
        return execute(query, server).then((result) => {
          return fragment(f, result, destination)
        })
      })
    }), Promise.resolve()).then(() => {
      console.log('finish to read and fragment files for', dataset)
      resolve()
    }).catch(e => {
      console.error(e)
      reject()
    })
  })
}), Promise.resolve()).then(() => {
  console.log('Generated. %f triples, %f triples fragmented', globalCount, globalCountFragmented)

}).catch(e => {
  console.error(e)
})


function readFile(f) {
  return new Promise((resolve, reject) => {
    try {
      const content = fs.readFileSync(f, 'utf8')
      resolve(content)
    } catch (e) {
      reject(e)
    }
  })
}

function fragment(name, result, destination) {
  return new Promise((resolve, reject) => {
    const chunkified = chunk(result, result.length * config.fragmentationFactor + 1)
    console.log('Number of chunks: ', chunkified.length)
    for(let i = 0; i<chunkified.length; i++) {
        const writer = Writer()
        chunkified[i].forEach(triple => {
          writer.addTriple(triple)
          globalCountFragmented++
        })
        writer.end(function (error, result) { writeFragments(result, destination+'/'+path.parse(name+'_fragment_f'+i+'.ttl').base) });
    }
    resolve()
  })
}

function writeFragments(content, destination) {
  console.log('Fragment written in: ', destination)
  fs.writeFileSync(destination, content, 'utf8')
}

function execute(query, server) {
  return new Promise((resolve, reject) => {
    let fc = new ldfclient.FragmentsClient(server)
    let results = new ldfclient.SparqlIterator(query, { fragmentsClient: fc })
    let count = 0
    let result = []
    results.on('data', (data) => {
      count++
      globalCount++
      result.push(data)
    })
    results.on('end', () => {
      console.log('finished count=', count)
      resolve(result)
    })
  })
}

// execute(q, config.server+config.datasets[0].uri)
