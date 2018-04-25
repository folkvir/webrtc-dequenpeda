const Dequenpeda = require('../webrtc-dequenpeda').Client
const shell = require('shelljs')
const commander = require('commander')
const path = require('path')
const fs = require('fs')
const AbstractSimplePeer = require('../webrtc-dequenpeda').AbstractSimplePeer
const shuffle = require('lodash.shuffle')
const uniqid = require('uniqid')
const uuid = require('uuid/v4')
const lmerge = require('lodash.merge')
const lrandom = require('lodash.random')

commander
  .option('-c, --clients <clients>', 'Override: Number of clients', (e) => parseInt(e))
  .option('-t, --timeout <timeout>', 'Override: Query Timeout', (e) => parseFloat(e))
  .option('-config, --config <config>', 'Config by default', e => e, path.resolve(__dirname+'/configs/default'))
  .parse(process.argv)

let date = new Date()
let minute = date.getMinutes()
let hour = date.getHours()
let day = date.getDate()
let month = date.getMonth()
let year = date.getFullYear()
const time = [hour, minute, day, month, year].join("-")
console.log('Time: ', time)

const config = require(path.resolve(commander.config))
config.resultDir = path.resolve(path.join(__dirname, './results/'+time+uuid()))

if(commander.timeout) config.timeout = parseFloat(commander.timeout)
if(commander.clients) config.clients = commander.clients
console.log('[PARAMETER] Number of clients: ', config.clients)
console.log('[PARAMETER] Timeout: ', config.timeout)

const destination = path.resolve(config.resultDir)
// create the destination
if (!fs.existsSync(destination)) shell.mkdir('-p', destination)

const header = ['round', 'completeness']

let globalCompleteness = 0
let globalMessage = 0, globalMessagetotal = 0
let globalRound = 0
const activeQueries = new Map()
let receiveAnswers = 0

createClients(config.clients).then((clients) => {
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
        loadDataset(path.resolve(__dirname, dataset.data), clients, dataset).then((clients) => {
          result.push(clients)
          resolve(result)
        }).catch(e => {
          reject(e)
        })
      })
    }), Promise.resolve([])).then((results) => {
      console.log('All dataset loaded on clients')
      const clientsWithFragment = results
      connectClients(clients).then(() => {
        console.log('Clients connected.')
        affectQueries(clients, allQueries, clients.length === 1).then((res) => {
          console.log('All queries finished.')
          const neighs = writeNeighbours(res, 'last')
          process.exit(0)
        })
      })
    }).catch(e => {
      console.log(e)
      process.exit(0)
    })
  })
})

function loadDataset(pathFiles, clients, dataset) {
  return extractFilename(pathFiles).then((files) => {
    return loadFiles(files, clients, dataset)
  })
}

function createClients(number) {
  if(number === 1) return Promise.resolve([createClient(1)])
  let clients = []
  let tmpFoglets = []
  const max = number
  for (let i = 0; i < max; i++) {
    if (i !== 0) tmpFoglets.push(i)
    const c = createClient(i)
    c._foglet.on('connect', () => {
      console.log('client connected.')
    })
    clients.push(c)
  }
  // shuffle clients to be fair!
  clients = shuffle(clients)
  return Promise.resolve(clients)
}

function connectClients(clients) {
  console.log('Connecting clients...', clients.length)
  return new Promise((resolve, reject) => {
    const connectedClients = [clients[0]]
    if(clients.length < 2) reject(new Error('need at least 2 client'))
    clients.reduce((accClient, client) => accClient.then(() => {
      console.log('Connecting client: %s', client._foglet.id)
      return client.connection(connectedClients[lrandom(connectedClients.length-1)]).then(() => {
        connectedClients.push(client)
      }).catch(e => {
        return Promise.reject(e)
      })
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
    const toReturn = []
    const done = () => {
        if (finished === clients.length) {
          resolve(toReturn)
        }
    }
    // only for client.length === 1
    if(allqueries) {

      for(let i = 0; i < queries.length; i++) {
        affectOneQuery(queries[i], clients[0], i, queries.length, clients).then(() => {
          toReturn.push({client, query: queries[i]})
          finished++
          done()
        }).catch(e => {
          console.log(e)
        })
      }
    } else {
      clients.reduce((cAcc, client, ind) => cAcc.then(() => {
        const query = queries[ind]
        affectOneQuery(query, client, ind, clients.length, clients).then(() => {
          finished++
          toReturn.push({client, query})
          done()
        }).catch(e => {
          console.log(e)
        })
        number++
        return Promise.resolve()
      }), Promise.resolve()).then(() => {
        console.log('Waiting for %f shuffles for a proper network before continuing.', config.options.shuffleCountBeforeStart)
      }).catch(e => {
        reject(e)
      })
    }
  })
}

function affectOneQuery(query, client, ind, numberOfQueries, clients) {
  return new Promise((resolve, reject) => {
    let round = 0
    const resultName = path.resolve(`${destination}/client-${client._foglet.id}-${query.filename}-completeness.csv`)
    activeQueries.set(ind, {
      completeness: 0,
      client,
      query
    })
    console.log('Affecting: %s to client %f', query.filename, ind)
    console.log('Output will be in: ', resultName)
    append(resultName, header.join(',')+'\n').then(() => {
      console.log('Header added to: ', resultName)
    }).catch(e => {
      console.log(e)
    })
    const q = client.query(query.query, 'normal', {
      timeout: config.timeout
    })
    q.on('loaded', (result) => {
      const completeness = result.length / query.card * 100
      activeQueries.get(ind).completeness = completeness
      // console.log('[%f/%f] Query %s loaded: %f results, \n Completeness: %f %, refResults: %f', round, config.round, query.filename, result.length, completeness, query.results.length)
      computeGlobalCompleteness(numberOfQueries, clients, client, round, query, completeness, resultName)
      round++
    })
    q.on('updated', (result) => {
      const completeness = result.length / query.card * 100
      activeQueries.get(ind).completeness = completeness
      // console.log('[%f/%f] Query %s updated: %f results, \n Completeness: %f %, refResults: %f', round, config.round, query.filename, result.length, completeness, query.results.length)
      computeGlobalCompleteness(numberOfQueries, clients, client, round, query, completeness, resultName)
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

function computeGlobalCompleteness(numberOfQueries, clients, client, round, query, completeness, resultName) {
  if(round > 0) {
    append(resultName, [round, completeness].join(',')+'\n')
    receiveAnswers++
    if((receiveAnswers % numberOfQueries) === 0) {
      writeNeighbours(clients, round)
      if(receiveAnswers === numberOfQueries) {
        append(path.resolve(destination+'/global-completeness.csv'), [
          'round',
          'globalcompleteness',
          'messages',
          'egdes-RPS',
          'edges-SON',
          'allmessages'
        ].join(',')+'\n')
      }
      printEdges(round)
      globalCompleteness = [...activeQueries.values()].reduce((acc, cur) => acc+cur.completeness, 0) / numberOfQueries
      const currentMessage = clients.reduce((acc, cur) => acc+cur._statistics.message, 0)
      const m = currentMessage - globalMessage
      globalMessage = currentMessage
      const currentMessagetotal = AbstractSimplePeer.manager.stats.message
      const mtotal = currentMessagetotal - globalMessagetotal
      globalMessagetotal = currentMessagetotal
      let overlayEdges = 0
      if(config.options.activeSon) {
        overlayEdges = clients.reduce((acc, cur) => acc+cur._foglet.overlay('son').network.getNeighbours(Infinity).length, 0)
      }
      const edges = clients.reduce((acc, cur) => acc+cur._foglet.getNeighbours(Infinity).length, 0)
      append(path.resolve(destination+'/global-completeness.csv'), [
        globalRound,
        globalCompleteness,
        m,
        edges,
        overlayEdges,
        mtotal
      ].join(',')+'\n')
      console.log('[%f] Global completeness: %f % (%f/%f)', round, globalCompleteness, activeQueries.size, numberOfQueries)
      globalRound++
    }
    if(round > config.round) {
      clients.forEach(c => {
        c.stopAll()
      })
    }
  }
}

function printEdges (round) {
  let overlayEdges = 0
  if(config.options.activeSon) {
    overlayEdges = [...activeQueries.values()].reduce((acc, cur) => acc+cur.client._foglet.overlay('son').network.getNeighbours(Infinity).length, 0)
  }
  const edges = [...activeQueries.values()].reduce((acc, cur) => acc+cur.client._foglet.getNeighbours(Infinity).length, 0)
  console.log(`[${round}] |RPS-edges|: ${edges}, |SON-edges|: ${overlayEdges}`)
}

function writeNeighbours(clients, round) {
  const toReturn = [...activeQueries.values()].reduce((acc, cur) => {
    let res = {
      type: cur.query.name,
      inview: cur.client._foglet.inViewID,
      outview: cur.client._foglet.outViewID,
      rps: cur.client._foglet.getNeighbours(Infinity)
    }
    if(cur.client._options.activeSon) {
      res.overlay = cur.client._foglet.overlay('son').network.getNeighbours(Infinity)
    }
    acc.push(res)
    return acc
  }, [])
  let stringified = JSON.stringify(toReturn)
  fs.writeFile(path.resolve(destination+`/${round}-neighbors.json`), stringified, 'utf8', (err) => {
    if (err) console.log(err)
    console.log('Table of the neighbours has been saved.')
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
function createClient (i) {
  return new Dequenpeda(lmerge(config.options, {
    foglet: {
      id: i,
      rps: {
        options: {
          socketClass: AbstractSimplePeer
        }
      }
    }
  }))
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
function loadFiles(fragments, clients, dataset) {
  // shuffle fragments and clients
  fragments = shuffle(fragments)
  clients = shuffle(clients)

  console.log(`[${dataset.name}]`, 'Loading fragments on clients...')
  return new Promise((resolve, reject) => {
    let elements = 0
    if(fragments.length >= clients.length) {
      elements = Math.floor(fragments.length / clients.length)
    } else {
      elements = Math.ceil(fragments.length / clients.length)
    }
    let remaining = fragments.length % clients.length

    console.log(`[${dataset.name}] fragment.length: ${fragments.length} clients.length: ${clients.length}`)
    console.log(`[${dataset.name}] frag/client: ${elements}`)
    console.log(`[${dataset.name}] remaining file: ${elements}`)
    let fragmentIndex = 0
    let insertedGlobal = 0
    let clientsSelected = []
    let clientsSelectedIndex = []
    clients.reduce((clientsAcc, client, indClient) => clientsAcc.then(() => {
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
                      console.log(`[${dataset.name}] File ${indFrag} loaded on client ${indClient}`)
                      fragmentIndex++
                      insertedGlobal++
                      inserted++
                      res2()
                    }).catch(e => {
                      console.log(e)
                      rej2(e)
                    })
                  }, 10)
                }).catch(e => {
                  console.log(e)
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
          console.log(`[${dataset.name}]`,'['+indClient+']  Files loaded.')
          res()
        }).catch(e => {
          rej(e)
        })
      })
    }), Promise.resolve()).then(() => {
      if((insertedGlobal === fragmentIndex) && (insertedGlobal === fragments.length)) {
        resolve(clientsSelected)
      } else {
        console.log(`[${dataset.name}]`,'Number of fragments loaded:', insertedGlobal)
        clients.reduce((clientsAcc, client, indClient) => clientsAcc.then(() => {
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
                          console.log(`[${dataset.name}] Remaining file ${indFrag} loaded on client ${indClient} `)
                          insertedGlobal++
                          inserted++
                          res2()
                        }).catch(e => {
                          console.log(e)
                          rej2(e)
                        })
                      }, 10)
                    }).catch(e => {
                      console.log(e)
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
              console.log(`[${dataset.name}]`,'['+indClient+'] Remaining files loaded.')
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
      }
    }).catch(e => {
      console.log(e)
      reject(e)
    })
  })
}
