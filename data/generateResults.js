const fs = require('fs')
const path = require('path')
const ldfclient = require('ldf-client')
ldfclient.Logger.setLevel('warning')
const shell = require('shelljs')

const config = {
  server: 'http://localhost:5678',
  datasets: [
    { name: 'diseasome', prefix: '/diseasome', dir: "./diseasome", queries: 'queries.json' },
    { name: 'geocoordinates', prefix: '/geocoordinates', dir: "./geocoordinates", queries: 'queries.json' },
    { name: 'linkedmdb', prefix: '/linkedmdb', dir: "./linkedmdb", queries: 'queries.json' }
  ]
}

config.datasets.reduce((datasetAcc, dataset) => datasetAcc.then((res) => {
  return new Promise((resolve, reject) => {
    const destination = path.resolve(dataset.dir+'/results/')
    if (!fs.existsSync(destination)) shell.mkdir('-p', destination)
    const queries2executePath = path.resolve(path.join(dataset.dir, '/queries/'+dataset.queries))
    console.log(queries2executePath)
    const queries = JSON.parse(fs.readFileSync(queries2executePath, 'utf8'))
    const server = config.server+dataset.prefix
    queries.reduce((qAcc, query, ind) => qAcc.then((results) => {
      return execute(query, server).then((res) => {
        console.log('[%s] Queries %f executed', dataset.dir, ind)
        const save = {
          name: dataset.name,
          query,
          filename: 'q'+ind+'.json',
          card: res.length,
          results: res
        }
        fs.writeFileSync(destination+'/q'+ind+'.json', JSON.stringify(save, null, '\t'), 'utf8')
        return Promise.resolve([...results, save])
      }).catch(e => Promise.reject(e))
    }), Promise.resolve([])).then((all) => {
      fs.writeFileSync(path.resolve(dataset.dir+'/queries/queries.json'), JSON.stringify(all, null, '\t'), 'utf8')
      console.log('Queries for the dataset %s on %s generated', dataset.dir, server)
      resolve()
    }).catch(e => {
      console.error(e)
      reject(e)
    })
  })
}), Promise.resolve()).then(() => {
  console.log('All queries executed.')
}).catch(e => {
  console.error(e)
})


function execute(query, server) {
  return new Promise((resolve, reject) => {
    let fc = new ldfclient.FragmentsClient(server)
    let results = new ldfclient.SparqlIterator(query, { fragmentsClient: fc })
    let count = 0
    let result = []
    results.on('data', (data) => {
      count++
      result.push(data)
    })
    results.on('error', (e) => {
      reject(e)
    })
    results.on('end', () => {
      console.log('finished count=', count)
      resolve(result)
    })
  })
}
