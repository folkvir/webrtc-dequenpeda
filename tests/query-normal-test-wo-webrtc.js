const Dequenpeda = require('../webrtc-dequenpeda').Client
const shell = require('shelljs')
const commander = require('commander')
const path = require('path')
const fs = require('fs')
const AbstractSimplePeer = require('../webrtc-dequenpeda').AbstractSimplePeer
const shuffle = require('lodash.shuffle')

commander
  .option('-c, --clients <clients>', 'Number of clients', (e) => parseInt(e), 1)
  .option('-t, --timeout <timeout>', 'Query Timeout', (e) => parseFloat(e), 24 * 3600 *1000)
  .parse(process.argv)

commander.timeout = parseFloat(commander.timeout)
console.log('[PARAMETER] Number of clients: ', commander.clients)
console.log('[PARAMETER] Timeout: ', commander.timeout)

const config = {
  datasets: [
    { data: "../data/diseasome/fragments/", queries: "../data/diseasome/queries/queries.json", results: "../data/diseasome/results/" },
    { data: "../data/linkedmdb/fragments/", queries: "../data/linkedmdb/queries/queries.json", results: "../data/linkedmdb/results/" }
  ]
}

loadQueries(config).then((results) => {
  console.log('Queries loaded.')
  console.log('Number of datasets: ', results.length)
})

/**
 * Load queries and return an array of array of queries with their results number [[{query: '...', filename: 'q1.rq', card: 2}, ...], ...]
 * @param  {[type]} config           [description]
 * @param  {Number} [limit=Infinity] [description]
 * @return {[type]}                  [description]
 */
function loadQueries (config, limit = Infinity) {
  return new Promise((resolve, reject) => {
    config.datasets.reduce((datasetsAcc, dataset) => datasetsAcc.then((resultGlobal) => {
      return new Promise((res, rej) => {
        console.log(dataset)
        const qPath = path.resolve(path.join(__dirname, dataset.queries))
        const rPath = path.resolve(path.join(__dirname, dataset.results))
        const queries = JSON.parse(fs.readFileSync(qPath, 'utf8'))
        const results = shell.ls(rPath+'*')
        queries.reduce((qAcc, query, ind) => qAcc.then((resDataset) => {
          //console.log(query, results[ind])
          const result = JSON.parse(fs.readFileSync(path.resolve(path.join(__dirname, dataset.results+results[ind])), 'utf8'))
          return Promise.resolve([...resDataset, {
            query,
            filename: results[ind],
            card: result.length,
            results: result
          }])
        }), Promise.resolve([])).then((resultDataset) => {
          res([...resultGlobal, resultDataset])
        }).catch(e => {
          rej(e)
        })
      })
    }), Promise.resolve([])).then((results) => {
      resolve(results)
    }).catch(e => {
      console.error(e)
      reject(e)
    })
  })
}

function readQuery(queryPath) {
  const pat = path.resolve(__dirname, queryPath)
  try {
    const query = fs.readFileSync(pat, 'utf8')
    return query
  } catch (e) {
    throw e
  }
}

//const pathData = path.resolve(__dirname, commander.data)

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


// extractFilename(pathData, commander.clients).then((res) => {
//   console.log('Loaded files: ', res.length)
//
//   const refClient = createClient()
//   loadFiles(res, [refClient]).then(() => {
//     // execute the query ref
//     function execute (q) {
//       return new Promise((resolve, reject) => {
//         const query = refClient.query(q, 'normal', {
//           timeout: Infinity
//         })
//         query.on('loaded', (result) => {
//           console.log('[REFERENCE] Number of results when initiated: ', result.length)
//           console.log('[REFERENCE] stop the query cause we are alone, we have all results')
//           refClient.stop(query._id)
//         })
//         query.on('end', (result) => {
//           console.log('[REFERENCE] Number of results when terminated: ', result.length)
//           resolve(result)
//         })
//       })
//     }
//     // execute the ref
//     execute(commander.query).then((resultRef) => {
//       console.log('Reference executed.')
//       // load N clients
//       let clients = []
//       let tmpFoglets = []
//       const max = commander.clients
//       for (let i = 0; i < max; i++) {
//         if (i !== 0) tmpFoglets.push(i)
//         const c = createClient()
//         c._foglet.on('connect', () => {
//           console.log('client: ', i, 'connected.')
//         })
//         clients.push(c)
//
//       }
//       // load fragments on the clients
//       loadFiles(res, clients).then(() => {
//         tmpFoglets.reduce((acc, ind) => acc.then(() => {
//           return clients[ind].connection(clients[0])
//         }), Promise.resolve()).then(() => {
//           // execute the query we want to execute
//           let shuffle = []
//           // query all data of clients[1]
//           const query = clients[0].query(commander.query, 'normal', {
//             timeout: commander.timeout
//           })
//           query.on('loaded', (result) => {
//             console.log(result)
//             console.log(`[client0-${shuffle.length}] Number of results when initiated: `, result.length)
//             shuffle.push(result)
//             // stop when query results are equal to ref results
//             if (result.length === resultRef.length) clients[0].stop(query._id)
//           })
//           query.on('updated', (result) => {
//             console.log(result)
//             console.log(`[client0-${shuffle.length}] Number of results when updated: `, result.length)
//             shuffle.push(result)
//             // stop when query results are equal to ref results
//             if (result.length === resultRef.length) clients[0].stop(query._id)
//           })
//           query.on('end', (result) => {
//             console.log(result)
//             console.log(`[client0-${shuffle.length}] Number of results when terminated: `, result.length)
//             console.log(`[client0-${shuffle.length}] Number of shuffle for the query: `, shuffle.length)
//             process.exit(0)
//           })
//         }).catch(e => {
//           console.error('[client-reduce] loadtriples: ', e)
//         })
//       }).catch(e => {
//         console.error(e)
//       })
//     })
//   })
// })

/**
 * Create a Dequenpeda client
 * @return {[type]} [description]
 */
function createClient () {
  return new Dequenpeda({
    foglet: {
      rps: {
        options: {
          delta: 15 * 1000,
          timeout: 30  * 1000,
          timeoutPending: 10 * 1000,
          socketClass: AbstractSimplePeer
        }
      }
    }
  })
}

/**
 * Read a .ttl and return the content
 * @param  {[type]} location [description]
 * @return {[type]}          [description]
 */
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

/**
 * Load fragments on clients
 * Return an array of clients which have at least one fragments
 */
function loadFiles(fragments, clients) {
  // shuffle fragments and clients
  fragments = shuffle(fragments)
  clients = shuffle(clients)

  console.log('Loading fragments on clients...')
  return new Promise((resolve, reject) => {
    let elements = 0
    if(fragments.length >= clients.length) {
      elements = Math.floor(fragments.length / clients.length)
    } else {
      elements = Math.ceil(fragments.length / clients.length)
    }
    let remaining = fragments.length % clients.length

    console.log('fragment.length: %f', fragments.length, 'clients.length: ', clients.length)
    console.log('frag/client: %f', elements)
    console.log('remaining file: ', remaining)
    let fragmentIndex = 0
    let insertedGlobal = 0
    let clientsSelected = []
    clients.reduce((clientsAcc, client, indClient) => clientsAcc.then(() => {
      console.log('Beginning loading on client: ', indClient)
      let inserted = 0
      return new Promise((res, rej) => {
        fragments.reduce((fragAcc, fragment, indFrag) => fragAcc.then(() => {
          //console.log(inserted, indClient, indFrag, fragmentIndex)
          return new Promise((res2, rej2) => {
            if(inserted < elements) {
              if(indFrag === fragmentIndex) {
                const file = readTurtleFile(fragment).then((file) => {
                  setTimeout(() => {
                    client.loadTriples(file).then(() => {
                      if(!clientsSelected.includes(ind)) {
                        clientsSelected.push(client)
                      }
                      console.log('File %f loaded on client %f ', indFrag, indClient)
                      fragmentIndex++
                      insertedGlobal++
                      inserted++
                      res2()
                    }).catch(e => {
                      console.error(e)
                      rej2(e)
                    })
                  }, 10)
                }).catch(e => {
                  console.error(e)
                  rej2(e)
                })
              } else {
                res2()
              }
            } else {
              res()
            }
          })
        }), Promise.resolve()).then(() => {
          console.log('All files loaded for client: ', indClient)
          res()
        }).catch(e => {
          rej(e)
        })
      })
    }), Promise.resolve()).then(() => {
      if((insertedGlobal === fragmentIndex) && (insertedGlobal === fragments.length)) resolve(clientsSelected)
      // now load all remaining files
      clients.reduce((clientsAcc, client, indClient) => clientsAcc.then(() => {
        console.log('Beginning loading remaining file on client: ', indClient)
        return new Promise((res, rej) => {
          let inserted = 0
          elements = 1
          fragments.reduce((fragAcc, fragment, indFrag) => fragAcc.then(() => {
            return new Promise((res2, rej2) => {
              if(inserted < elements) {
                if(indFrag === insertedGlobal) {
                  const file = readTurtleFile(fragment).then((file) => {
                    setTimeout(() => {
                      client.loadTriples(file).then(() => {
                        if(!clientsSelected.includes(ind)) {
                          clientsSelected.push(client)
                        }
                        console.log('File %f loaded on client %f ', indFrag, indClient)
                        insertedGlobal++
                        inserted++
                        res2()
                      }).catch(e => {
                        console.error(e)
                        rej2(e)
                      })
                    }, 10)
                  }).catch(e => {
                    console.error(e)
                    rej2(e)
                  })
                } else {
                  res2()
                }
              } else {
                res()
              }
            })
          }), Promise.resolve()).then(() => {
            console.log('All files loaded for client: ', indClient)
            res()
          }).catch(e => {
            rej(e)
          })
        })
      }), Promise.resolve()).then(() => {
        resolve(clientsSelected)
      }).catch(e => {
        reject()
      })
    }).catch(e => {
      console.error(e)
      reject(e)
    })
  })
}
