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
const lmin = require('lodash.min')
const sizeof = require('object-sizeof')
const debug = require('debug')('xp')

commander
  .option('-c, --clients <clients>', 'Override: Number of clients', (e) => parseInt(e))
  .option('-t, --timeout <timeout>', 'Override: Query Timeout', (e) => parseFloat(e))
  .option('-n, --name <name>', 'Name of the experiement to add')
  .option('-m, --manualshuffle')
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

let name = config.name+'-'+time+uniqid()
if(commander.timeout) config.timeout = parseFloat(commander.timeout)
if(commander.clients) config.clients = commander.clients
if(commander.manualshuffle)
  config.options.manualshuffle = commander.manualshuffle
else
  config.options.manualshuffle = false
if(commander.name) config.name = commander.name+'-'+name
console.log('[PARAMETER] Number of clients: ', config.clients)
console.log('[PARAMETER] Timeout: ', config.timeout)

console.log('[PARAMETER] Manual shuffling: ', config.options.manualshuffle)

config.resultDir = path.resolve(path.join(__dirname, './results/'+config.name))

const destination = path.resolve(config.resultDir)
// create the destination
try {
  if (!fs.existsSync(destination)) shell.mkdir('-p', destination)
} catch (e) {
  console.log(e)
}




let globalCompleteness = 0
let globalMessage = 0, globalMessagetotal = 0
let globalRound = 0
const activeQueries = new Map()
const globalResults = []
const globalResultsQuery = []
for(let i = 0; i<config.round; i++) {
  globalResults.push([])
  globalResultsQuery.push([])
}

console.log('Global results: ', globalResults)
let receiveAnswers = 0
let clientsLoaded = undefined

createClients(config.clients).then((clients) => {
  clientsLoaded = clients
  console.log('Number of clients loaded: ', clients.length)
  // clients.forEach(c => {
  //   console.log('Neighbours: ', c._foglet.getNeighbours())
  // })
  let queries = config.queries
  queries = shuffle(queries)
  console.log('Number of queries kept for the exp: ', queries.length)

  // if(allQueries.length < clients.length) throw new Error('not enough queries for clients')

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
    connectClients(clients).then(() => {
      console.log('Clients connected.')
      affectQueries(clients, queries, clients.length === 1).then((res) => {
        executeQueries(clients, res).then(() => {
          console.log('All queries finished.')
          printGlobalResults(clients).then(() => {
            clients.reduce((cacc, cur) => {
              return cur.close()
            }, Promise.resolve()).then(() => {
              process.exit(0)
            })
          }).catch(e => {
            console.error(e)
          })
        }).catch(e => {
          console.error(e)
        })
      }).catch(e => {
        console.log(e)
      })
    }).catch(e => {
      console.log(e)
    })
  }).catch(e => {
    console.log(e)
  })
}).catch(e => {
  console.error(e)
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
      console.log('['+i+'] client connected')
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
    let firstClient = clients[0]
    let connectedClients = [clients[0]]
    if(clients.length < 2) reject(new Error('need at least 2 client'))
    clients.reduce((accClient, client) => accClient.then(() => {
      if(clients[0]._foglet.id !== client._foglet.id) {
        return wait(500).then(() => {
          // choose the peer connected to the closest average pv size
          // find the avreage
          const average = connectedClients.reduce((acc, cur) => acc+[...cur._foglet.overlay().network.rps.partialView.values()].reduce((acc, cur) => acc+cur.length, 0), 0) / connectedClients.length
          // find the closest
          const rn = connectedClients.sort( (a, b) => {
            const pva = [...a._foglet.overlay().network.rps.partialView.values()].reduce((acc, cur) => acc+cur.length, 0)
            const pvb = [...b._foglet.overlay().network.rps.partialView.values()].reduce((acc, cur) => acc+cur.length, 0)
            return Math.abs(average - pva) - Math.abs(average - pvb)
          })
          //debug(average, rn.map((e) => [...e._foglet.overlay().network.rps.partialView.values()].reduce((acc, cur) => acc+cur.length, 0)))
          const rnclient = rn[0] // connectedClients[rn]
          console.log('Connecting client: %s to client: %s', client._foglet.id, rnclient._foglet.id)
          if(config.options.activeSon) {
            return client.connection(rnclient, 'son').then(() => {
              rn[rn.length-1]._foglet.overlay().network.rps._exchange()
              const pv = pvov = clients.reduce((acc, cur) => {
                return acc + [...cur._foglet.overlay().network.rps.partialView].reduce((a, c) => a+c.length, 0)
              }, 0)
              console.log('Arcs: ', pv)
              connectedClients.push(client)
              connectedClients = shuffle(connectedClients)
              return Promise.resolve()
            }).catch(e => {
              return Promise.reject(e)
            })
          } else {
            // rps
            return client.connection(rnclient).then(() => {
              rn[rn.length-1]._foglet.overlay().network.rps._exchange()
              const pv = pvov = clients.reduce((acc, cur) => {
                return acc + [...cur._foglet.overlay().network.rps.partialView].reduce((a, c) => a+c.length, 0)
              }, 0)
              console.log('Arcs: ', pv)
              connectedClients.push(client)
              connectedClients = shuffle(connectedClients)
              return Promise.resolve()
            }).catch(e => {
              return Promise.reject(e)
            })
          }
        }).catch(e => {
          return Promise.reject(e)
        })
      } else {
        return Promise.resolve()
      }
    }), Promise.resolve()).then(() => {
      resolve(clients)
    }).catch(e => {
      reject(e)
    })
  })
}

function wait(time) {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve()
    }, time)
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
  console.log('Number of queries: ', queries.length)
  queries = shuffle(queries)

  return new Promise((resolve, reject) => {
    let number = 0
    let finished = 0
    const toReturn = []
    // only for client.length === 1
    if(allqueries) {
      for(let i = 0; i < queries.length; i++) {
        activeQueries.set(i, {
          maxresults: 0,
          client: clients[i],
          query: {
            name: "none"
          },
          round: undefined
        })
        affectOneQuery(queries[i], clients[0], i, queries.length, clients).then((r) => {
          toReturn.push(r)
          finished++
          if (finished === queries.length) {
            resolve(toReturn)
          }
        }).catch(e => {
          console.log(e)
        })
      }
    } else {
      if(queries.length >= clients.length) {
        for(let i = 0; i<clients.length; i++) {
          activeQueries.set(i, {
            maxresults: 0,
            client: clients[i],
            query: {
              name: "none"
            },
            round: undefined
          })
          const query = queries[i]
          affectOneQuery(query, clients[i], i, clients.length, clients).then((r) => {
            finished++
            toReturn.push(r)
            if (finished === clients.length) {
              resolve(toReturn)
            }
          }).catch(e => {
            console.log(e)
          })
          number++
        }
        console.log('Waiting for %f shuffles for a proper network before continuing.', config.options.shuffleCountBeforeStart)
      } else {
        for(let i = 0; i<clients.length; i++) {
          activeQueries.set(i, {
            maxresults: 0,
            client: clients[i],
            query: {
              name: "none"
            },
            round: undefined
          })
          if(i < queries.length) {
            affectOneQuery(queries[i], clients[i], i, queries.length, clients).then((r) => {
              finished++
              toReturn.push(r)
              if (finished === queries.length) {
                resolve(toReturn)
              }
            }).catch(e => {
              console.log(e)
            })
            number++
          }
        }
        console.log('Waiting for %f shuffles for a proper network before continuing.', config.options.shuffleCountBeforeStart)
      }
    }
  })
}

function affectOneQuery(query, client, ind, numberOfQueries, clients) {
  return new Promise((resolve, reject) => {
    const dir = path.resolve(`${destination}/client-${client._foglet.id}/`)
    const resultName = path.resolve(`${dir}/completeness.csv`)
    if (!fs.existsSync(dir)) shell.mkdir('-p', dir)
    activeQueries.get(ind).maxresults = query.card
    activeQueries.get(ind).client = client
    activeQueries.get(ind).query = query
    console.log('Affecting: %s to client %f', query.filename, ind)
    console.log('Output will be in: ', resultName)
    resolve({
      client: client,
      q: client.query(query.query, 'normal', {
        timeout: config.timeout
      }),
      query: query,
      index: ind,
      resultName: resultName,
      dir
    })
  })
}

function executeQueries(clients, queries) {
  return new Promise((resolve, reject) => {
    let finished = 0
    queries.forEach(query => {
      const client = query.client
      const q = query.q
      const ind = query.index
      q.on('starting', (eventName, round) => {
        //console.log(`[${query.query.filename}][${client._foglet.id}] starting to execute the query for round: ${round} for event: ${eventName}`)
      })
      q.on('updated', (result, roundStart, roundEnd) => {
        let completeness = 0
        let timeout = false
        let resultsObtained = 0
        if(roundStart === roundEnd) {
          //console.log('roundStart===roundEnd')
          completeness = result.length / query.query.card * 100
          resultsObtained = result.length
        } else {
          timeout = true
          // considered as query timeout cause the execution was not terminated into 1 round
          if(roundStart <= 0) {
            //debug('RoundStrart === 0')
            // default value
          } else if( roundStart > 0 ) {
            //debug('RoundStrart > 0')
            function findEntry(r) {
              if(r === 0) {
                return undefined
              } else {
                const entry = globalResultsQuery[r].find((e) => {
                  return activeQueries.get(e.clientind).client._foglet.id === client._foglet.id
                })
                if(entry) {
                  return entry
                } else {
                  return findEntry(r-1)
                }
              }
            }
            const r = roundStart - 1
            const entry = findEntry(roundStart - 1)
            if(!entry) {
              //debug('entry is undefined')
              // default vlaue
            } else {
              //debug('entry was found')
              completeness = entry.completeness
              resultsObtained = entry.resultsObtained
            }
          }
        }
        const topush = {
          dir: query.dir,
          message: client._statistics.message,
          name: query.query.filename,
          roundStart,
          completeness,
          clientind: ind,
          timeout,
          card: query.query.card,
          obtained: resultsObtained,
          resultName: query.resultName
        }
        if(roundEnd < config.round - 1) {
          if(!globalResults[roundEnd].includes(client._foglet.id)) {
            globalResults[roundEnd].push(client._foglet.id)
            // if all results of the round i received, print a global message and save it to global-compl.csv
            if(timeout) {
              globalResultsQuery[roundStart].push(topush)
            } else {
              globalResultsQuery[roundEnd].push(topush)
            }

            let roundToPrint = [0, config.round-2, config.round-3, Math.floor(config.round/2)]
            if(roundToPrint.includes(roundEnd)) {
              writeNeighbours(roundEnd, query.dir).catch(e => {
                console.log(e)
              })
            }

            const gs = sizeof(globalResultsQuery)
            console.log(`[${query.query.filename}][${client._foglet.id}] Receive results for round: (start, end) = (${roundStart},${roundEnd}), [${globalResults[roundEnd].length}/${queries.length}], Global size: ${gs}`)
          } else {
            console.log(`[${query.query.filename}][${client._foglet.id}] We receive a second time a result for this run. NOT POSSIBLE: round:(start, end) = (${roundStart},${roundEnd}) `)
          }
        } else {
          if(!globalResults[roundEnd].includes(client._foglet.id)) {
            globalResults[roundEnd].push(client._foglet.id)
            // if all results of the round i received, print a global message and save it to global-compl.csv
            // append local result
            if(timeout) {
              globalResultsQuery[roundStart].push(topush)
            } else {
              globalResultsQuery[roundEnd].push(topush)
            }

            const gs = sizeof(globalResultsQuery)
            console.log(`[${query.query.filename}][${client._foglet.id}] Receive results for round: (start, end) = (${roundStart},${roundEnd}), [${globalResults[roundEnd].length}/${queries.length}], Global size: ${gs}`)
          } else {
            console.log(`[${query.query.filename}][${client._foglet.id}] We receive a second time a result for this run. NOT POSSIBLE: round:(start, end) = (${roundStart},${roundEnd}) `)
          }
          let roundToPrint = [0, config.round-2, config.round-3, Math.floor(config.round/2)]
          if(roundToPrint.includes(roundEnd)) {
            writeNeighbours(roundEnd, query.dir).then(() => {
              q.stop()
            }).catch(e => {
              console.log(e)
            })
          } else {
            q.stop()
          }
        }
      })
      q.on('end', (result) => {
        console.log('Query %s finished', query.query.filename)
        finished++
        done()
      })
      q.on('error',(err) => {
        reject(err)
      })
    })

    // let check = setInterval(() => {
    //   globalResultsQuery.forEach(f => {
    //     console.log(f.length, JSON.stringify(f.map(e=>e.name).sort()))
    //   })
    // }, 5000)

    function done() {
      if((finished === queries.length) ) {
        resolve()
      }
    }
    append(path.resolve(destination+'/global-completeness.csv'), [
      'round',
      'globalcompleteness',
      'globalcompletenesscompleted',
      'globalcompletenessincresults',
      'messages',
      'completeQueries',
      'queriesNumber',
      'obtainedresults',
      'wantedresults',
      'timedout'
    ].join(',')+'\n').then(() => {
      queries.forEach(query => {
        // start the execution for the first time
        console.log('Starting query %f ...', query.index)
        query.q.init()
      })
    })
  })
}

function getActivesQueries() {
  return [...activeQueries.values()].filter(aq => {
    if(aq.round !== undefined && aq.round >= 0) {
      return true
    } else {
      return false
    }
  })
}

function printGlobalResults() {
  return new Promise((resolve, reject) => {
    for(let i = 0; i<globalResultsQuery.length; i++) {
      console.log('Round:%f :=: #r=%f', i, globalResultsQuery[i].length)
      const header = ['round', 'completeness', 'timeout', 'receiveresults', 'maxresults', 'name']
      fs.appendFileSync(globalResultsQuery[i][0].resultName, header.join(',')+'\n')
      for(let j = 0; j<globalResultsQuery[i].length; j++) {
        const val = globalResultsQuery[i][j]
        const data = [
          val.roundStart,
          val.completeness,
          val.timeout,
          val.obtained,
          val.card,
          val.message,
        ]
        fs.appendFileSync(val.resultName, data.join(',')+'\n')
      }
      const globalCompleteness = globalResultsQuery[i].reduce((acc, cur) => acc+cur.completeness, 0) / globalResultsQuery[i].length
      const completed = globalResultsQuery[i].filter((cur) => cur.completeness === 100).length
      const globalCompletenessCompleted = completed / globalResultsQuery[i].length * 100

      const completeQueries = globalResultsQuery[i].reduce((acc, cur) => {
        if(cur.completeness === 100) return acc+1
        return acc
      }, 0)
      const messages = globalResultsQuery[i].reduce((acc, cur) => acc+cur.message, 0)
      const maxResults = globalResultsQuery[i].reduce((acc, cur) => acc+cur.card, 0)
      const obtained = globalResultsQuery[i].reduce((acc, cur) => acc+cur.obtained, 0)
      const completenessInresults = obtained / maxResults * 100
      const timedout = globalResultsQuery[i].reduce((acc, cur) => acc+(cur.timeout)?1:0, 0)
      fs.appendFileSync(path.resolve(destination+'/global-completeness.csv'), [
        i,
        globalCompleteness,
        globalCompletenessCompleted,
        completenessInresults,
        messages,
        completeQueries,
        globalResultsQuery[i].length,
        obtained,
        maxResults,
        timedout
      ].join(',')+'\n')
    }
    globalResultsQuery[globalResultsQuery.length - 1].reduce((acc, cur) => acc.then(() => {
      return writeNeighbours('last', cur.dir)
    }), Promise.resolve()).then(() => {
      // once all is done resolve
      resolve()
    })
  })
}

function printEdges (clients, round) {
  return new Promise((resolve, reject) => {
    let overlayEdges = 0
    let pvov
    if(config.options.activeSon) {
      overlayEdges = [...activeQueries.values()].reduce((acc, cur) => acc+cur.client._foglet.overlay('son').network.getNeighbours().length, 0)
    }

    const pv = pvov = [...activeQueries.values()].reduce((acc, cur) => {
      return acc + [...cur.client._foglet.overlay().network.rps.partialView.values()].reduce((a, c) => a+c.length, 0)
    }, 0)
    const edges = [...activeQueries.values()].reduce((acc, cur) => acc+cur.client._foglet.getNeighbours().length, 0)
    const edgesAll = [...activeQueries.values()].reduce((acc, cur) => acc+cur.client._foglet.getNeighbours(Infinity).length, 0)
    console.log(`[${round}] |RPS-edges|: ${edges}, |SON-edges|: ${overlayEdges}, (RPS-arcs, RPS-con) = (${pv},${edgesAll})  `)
    resolve()
  })
}

function writeNeighbours(round, dir) {
  return new Promise((resolve, reject) => {
    const toReturn = [...activeQueries.values()].reduce((acc, cur) => {
      let res = {
        type: cur.query.name,
        inview: cur.client._foglet.inViewID,
        outview: cur.client._foglet.outViewID,
        rps: cur.client._foglet.getNeighbours(),
        profile: cur.client._profile.export()
      }
      // console.log(`[${round}] RPS length: `, res.rps.length)
      if(cur.client._options.activeSon) {
        res.overlay = cur.client._foglet.overlay('son').network.getNeighbours()
        // console.log(`[${round}] SON length: `, res.overlay.length)
      }
      acc.push(res)
      return acc
    }, [])
    let stringified = JSON.stringify(toReturn)
    const p = (dir)?dir:destination
    // local: dir,
    // global: destination
    fs.writeFile(path.resolve(p+`/${round}-neighbors.json`), stringified, 'utf8', (err) => {
      if (err) console.log(err)
      // console.log('Table of the neighbours has been saved.')
      resolve()
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
          //debug(inserted, indClient, indFrag, fragmentIndex)
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
