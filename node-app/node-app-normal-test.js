const Dequenpeda = require('../webrtc-dequenpeda').Client
const shell = require('shelljs')
const commander = require('commander')

commander
  .usage('node app/node-app-normal-test.js --clients 10')
  .option('-c, --clients <clients>', 'Number of clients', (e) => parseInt(e), 1)
  .parse(process.argv)

console.log('Number of clients: %j', commander.clients)

const query3 = `PREFIX foaf:   <http://xmlns.com/foaf/0.1/>
 PREFIX rdf:   <http://www.w3.org/1999/02/22-rdf-syntax-ns#>
 SELECT ?person1 ?person1Name
 WHERE {
    ?person1 foaf:name ?person1Name .
  }`
const pathData = require('path').resolve(__dirname, '../data/dataset/triple_person')

let extractFilename = (pathData, max) => new Promise((resolve, reject) => {
  try {
    let i = 0
    let res = []
    shell.ls(pathData + '/*.ttl').forEach(function (file) {
      if (i < max) {
        res.push(file)
        i++
      } else {
        resolve(res)
      }
    })
    resolve(res)
  } catch (e) {
    reject(e)
  }
})

extractFilename(pathData, commander.clients).then((res) => {
  console.log('Loaded files: ', res)

  const refClient = createClient()
  res.reduce((acc, f, ind) => acc.then(() => {
    return readTurtleFile(f).then((triples) => {
      return refClient.loadTriples(triples)
    })
  }), Promise.resolve()).then(() => {
    // execute the query ref
    function execute (q) {
      return new Promise((resolve, reject) => {
        const query = refClient.query(q)
        query.on('loaded', (result) => {
          console.log('[REFERENCE] Number of results when initiated: ', result.length)
          console.log('[REFERENCE] stop the query cause we are alone, we have all results')
          refClient.stop(query._id)
        })
        query.on('end', (result) => {
          console.log('[REFERENCE] Number of results when terminated: ', result.length)
          resolve(result)
        })
      })
    }

    execute(query3).then((resultRef) => {
      let clients = []
      let tmpFoglets = []
      const max = commander.clients
      for (let i = 0; i < max; i++) {
        if (i !== 0) tmpFoglets.push(i)
        clients.push(createClient())
      }

      readTurtleFile(res[0]).then((file) => {
        clients[0].loadTriples(file).then(() => {
          tmpFoglets.reduce((acc, ind) => acc.then(() => {
            return clients[ind].connection(clients[0]).then(() => {
              return readTurtleFile(res[ind]).then(file2 => {
                return clients[ind].loadTriples(file2)
              }).catch(e => {
                console.error('Loadtriples: ', e)
              })
            })
          }), Promise.resolve()).then(() => {
            let shuffle = []
            // query all data of clients[1]
            const query = clients[0].query(query3)
            query.on('loaded', (result) => {
              console.log(`[client0-${shuffle.length}] Number of results when initiated: `, result.length)
              shuffle.push(result)
              // stop when query results are equal to ref results
              if (result.length === resultRef.length) clients[0].stop(query._id)
            })
            query.on('updated', (result) => {
              console.log(`[client0-${shuffle.length}] Number of results when updated: `, result.length)
              shuffle.push(result)
              // stop when query results are equal to ref results
              if (result.length === resultRef.length) clients[0].stop(query._id)
            })
            query.on('end', (result) => {
              console.log(`[client0-${shuffle.length}] Number of results when terminated: `, result.length)
              console.log(`[client0-${shuffle.length}] Number of shuffle for the query: `, shuffle.length)
              process.exit(0)
            })
          }).catch(e => {
            console.error('[client-reduce] loadtriples: ', e)
          })
        }).catch(e => {
          console.error('[client-0] loadtriples: ', e)
        })
      })
    })
  })
})

// const dataSublistOfFiles = [
//   'triple_person/2xusiez7gijdmxg04e.ttl',
//   'triple_person/2xusiez7gijdmxg04f.ttl',
//   'triple_person/2xusiez7gijdmxg04g.ttl',
//   'triple_person/2xusiez7gijdmxg04h.ttl',
//   'triple_person/2xusiez7gijdmxg04i.ttl',
//   'triple_person/2xusiez7gijdmxg04j.ttl',
//   'triple_person/2xusiez7gijdmxg04k.ttl',
//   'triple_person/2xusiez7gijdmxg04l.ttl',
//   'triple_person/2xusiez7gijdmxg04m.ttl',
//   'triple_person/2xusiez7gijdmxg04n.ttl'
// ]

function createClient () {
  return new Dequenpeda()
}

function readTurtleFile (location) {
  return new Promise((resolve, reject) => {
    const fs = require('fs')
    fs.readFile(location, 'utf8', (err, data) => {
      // console.log(data)
      if (err) reject(err)
      resolve(data)
    })
  })
}
