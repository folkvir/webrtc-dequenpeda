const Dequenpeda = require('../webrtc-dequenpeda').Client
const shell = require('shelljs')
const commander = require('commander')
const path = require('path')
const fs = require('fs')
const AbstractSimplePeer = require('../webrtc-dequenpeda').AbstractSimplePeer
const shuffle = require('lodash.shuffle')
const uniqid = require('uniqid')

commander
  .option('-c, --clients <clients>', 'Number of clients', (e) => parseInt(e), 1)
  .option('-t, --timeout <timeout>', 'Query Timeout', (e) => parseFloat(e), 24 * 3600 *1000)
  .parse(process.argv)

commander.timeout = parseFloat(commander.timeout)
console.log('[PARAMETER] Number of clients: ', commander.clients)
console.log('[PARAMETER] Timeout: ', commander.timeout)

let date = new Date();
let minute = date.getMinutes();
let hour = date.getHours();
let day = date.getDate();
let month = date.getMonth();
let year = date.getFullYear();
const time = [hour, minute, day, month, year].join("-")
console.log('Time: ', time)

const config = {
  resultDir: path.resolve(path.join(__dirname, './results/'+uniqid(time))),
  datasets: [
    { name: 'diseasome', data: "../data/diseasome/fragments/", queries: "../data/diseasome/queries/queries.json", results: "../data/diseasome/results/" },
    // { name: 'linkedmdb', data: "../data/linkedmdb/fragments/", queries: "../data/linkedmdb/queries/queries.json", results: "../data/linkedmdb/results/" }
  ],
  shuffleTime: 30 * 1000,
  shuffleCountBeforeStart: 1,
  timeout: commander.timeout
}

const completenessSrc = path.resolve(path.join(__dirname, './plots/completeness.gnuplot'))

const destination = path.resolve(config.resultDir)
// create the destination
if (!fs.existsSync(destination)) shell.mkdir('-p', destination)

const header = ['round', 'completeness']
const header2 = ['time', 'edges', 'messages']

connectClients(commander.clients).then((clients) => {
  console.log('Number of clients loaded: ', clients.length)
  // clients.forEach(c => {
  //   console.log('Neighbours: ', c._foglet.getNeighbours())
  // })
  loadQueries(config).then((results) => {
    const queries = results
    console.log('Queries loaded.')
    console.log('Number of datasets: ', queries.length)
    queries.forEach(d => {
      console.log('Number of queries for dataset %s: %f', d[0].name, d.length)
    })

    const allQueries = queries.reduce((acc, cur, ind) => { acc.push(...cur); return acc }, [])
    console.log('All queries: ', allQueries.length)

    if(allQueries.length < clients.length) throw new Error('not enough queries for clients')

    // load datasets into clients
    config.datasets.reduce((dAcc, dataset) => dAcc.then((result) => {
      return new Promise((resolve, reject) => {
        loadDataset(path.resolve(__dirname, dataset.data), clients).then((clients) => {
          result.push(clients)
          resolve(result)
        }).catch(e => {
          reject(e)
        })
      })
    }), Promise.resolve([])).then((results) => {
      console.log('All dataset loaded on clients')
      const clientsWithFragment = results
      affectQueries(clients, allQueries, clients.length === 1).then(() => {
        console.log('All queries finished.')
        const plot = `gnuplot -e "input='${destination}/*.csv'" -e "outputname='${destination}/completeness.png'" ${completenessSrc}  && open ${destination}/completeness.png`
        console.log(plot)
        const p = shell.exec(plot)
        process.exit(0)
      })
    }).catch(e => {
      console.error(e)
      process.exit(1)
    })
  })
})

function loadDataset(pathFiles, clients) {
  return extractFilename(pathFiles).then((files) => {
    return loadFiles(files, clients)
  })
}

function connectClients(number) {
  if(number === 1) return Promise.resolve([createClient()])
  let clients = []
  let tmpFoglets = []
  const max = number
  for (let i = 0; i < max; i++) {
    if (i !== 0) tmpFoglets.push(i)
    const c = createClient()
    c._foglet.on('connect', () => {
      console.log('client connected.')
    })
    clients.push(c)
  }
  // shuffle clients to be fair!
  clients = shuffle(clients)
  return new Promise((resolve, reject) => {
    if(clients.length < 2) reject(new Error('need at least 2 client'))
    tmpFoglets.reduce((accClient, index) => accClient.then(() => {
      return clients[index].connection(clients[0])
    }), Promise.resolve()).then(() => {
      resolve(clients)
    }).catch(e => {
      reject(e)
    })
  })
}


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
        const queries = require(qPath)
        res([...resultGlobal, queries])
      })
    }), Promise.resolve([])).then((results) => {
      resolve(results)
    }).catch(e => {
      console.error(e)
      reject(e)
    })
  })
}

/**
 * Affect queries to those clients, need to call load fragments before and pass the result to this function
 * @param  {[type]} clients [description]
 * @param  {[type]} queries [description]
 * @return {[type]}         [description]
 */
function affectQueries(clients, queries, allqueries) {
  // shuffle clients to be fair!
  clients = shuffle(clients)
  console.log('Number of clients: ', clients.length)
  // shuffle queries
  // queries = shuffle(queries)

  return new Promise((resolve, reject) => {
    let number = 0
    let finished = 0
    const done = () => {
        if (finished === clients.length) {
          resolve()
        }
    }
    // only for client.length === 1
    if(allqueries) {
      for(let i = 0; i < queries.length; i++) {
        affectOneQuery(queries[i], clients[0], 0).then(() => {
          finished++
          done()
        }).catch(e => {
          console.error(e)
        })
      }
    } else {
      clients.reduce((cAcc, client, ind) => cAcc.then(() => {
        const query = queries[ind]
        affectOneQuery(query, client, ind).then(() => {
          finished++
          done()
        }).catch(e => {
          console.error(e)
        })
        number++
        return Promise.resolve()
      }), Promise.resolve()).then(() => {
        console.log('Waiting for %f shuffles for a proper network before continuing.', config.shuffleCountBeforeStart)
      }).catch(e => {
        reject(e)
      })
    }
  })
}

function affectOneQuery(query, client, ind) {
  return new Promise((resolve, reject) => {
    console.log('Affecting: %s to client %f', query.filename, ind)
    const resultName = path.resolve(destination+'/'+query.filename+'.csv')
    console.log('Output will be in: ', resultName)
    append(resultName, header.join(',')+'\n').then(() => {
      console.log('Header added to: ', resultName)
    }).catch(e => {
      console.error(e)
    })
    const q = client.query(query.query, 'normal', {
      timeout: config.timeout
    })
    let round = 0
    q.on('loaded', (result) => {
      const completeness = result.length / query.card * 100
      console.log('[%f] Query %s loaded: %f results, \n Completeness: %f %, refResults: %f', round, query.filename, result.length,
      completeness, query.results.length)
      append(resultName, [round, completeness].join(',')+'\n').then(() => {
        console.log('Data appended to: ', resultName)
      }).catch(e => {
        console.error(e)
      })
      round++

    })
    q.on('updated', (result) => {
      const completeness = result.length / query.card * 100
      console.log('[%f] Query %s updated: %f results, \n Completeness: %f %, refResults: %f', round, query.filename, result.length, completeness, query.results.length)
      append(resultName, [round, completeness].join(',')+'\n').then(() => {
        console.log('Data appended to: ', resultName)
      }).catch(e => {
        console.error(e)
      })
      round++
    })
    q.on('end', (result) => {
      console.log('Query %s finished', query.filename)
      resolve()
    })
    q.on('error',(err) => {
      reject(err)
    })
  })
}

function append(file, data) {
  return new Promise((resolve, reject) => {
    fs.appendFile(file, data, (err) => {
      if (err) reject(err)
      resolve()
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

/**
 * Create a Dequenpeda client
 * @return {[type]} [description]
 */
function createClient () {
  return new Dequenpeda({
    foglet: {
      rps: {
        options: {
          delta: config.shuffleTime,
          timeout: config.timeout,
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
    let clientsSelectedIndex = []
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
                      if(!clientsSelectedIndex.includes(indClient)) {
                        clientsSelected.push(client)
                        clientsSelectedIndex.push(indClient)
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
                        if(!clientsSelectedIndex.includes(indClient)) {
                          clientsSelected.push(client)
                          clientsSelectedIndex.push(indClient)
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
