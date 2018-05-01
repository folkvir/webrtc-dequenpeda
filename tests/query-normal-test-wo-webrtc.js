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

let name = config.name+'-'+time+uuid()
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


const header = ['round', 'completeness', 'clientmessage', 'rpssize', 'sonsize', 'receiveresults', 'maxresults']

let globalCompleteness = 0
let globalMessage = 0, globalMessagetotal = 0
let globalRound = 0
const activeQueries = new Map()
const globalResults = []
for(let i = 0; i<config.round; i++) {
  globalResults.push([])
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
          clients.reduce((cacc, c)  => cacc.then(() => {
            return c.close()
          }), Promise.resolve()).then(() => {
            process.exit(0)
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
    process.exit(0)
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
    let connectedClients = [clients[0]]
    if(clients.length < 2) reject(new Error('need at least 2 client'))
    clients.reduce((accClient, client) => accClient.then(() => {
      return wait(200).then(() => {
          const rn = lrandom(connectedClients.length-1)
          const rnclient = connectedClients[rn]
          console.log('Connecting client: %s to client %f: %s', client._foglet.id, rn, rnclient._foglet._id)
          if(config.options.activeSon) {
            return client.connection(rnclient, 'son').then(() => {
              connectedClients.push(client)
              connectedClients = shuffle(connectedClients)
              return Promise.resolve()
            }).catch(e => {
              return Promise.reject(e)
            })
          } else {
            // rps
            return client.connection(rnclient).then(() => {
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
          completeness: 0,
          resultsObtained: 0,
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
            completeness: 0,
            resultsObtained: 0,
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
            completeness: 0,
            resultsObtained: 0,
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
    activeQueries.get(ind).completeness = 0
    activeQueries.get(ind).resultsObtained = 0
    activeQueries.get(ind).maxresults = query.card
    activeQueries.get(ind).client = client
    activeQueries.get(ind).query = query
    activeQueries.get(ind).round = 0
    console.log('Affecting: %s to client %f', query.filename, ind)
    console.log('Output will be in: ', resultName)
    console.log('Number of actives queries: ', getActivesQueries().length)
    append(resultName, header.join(',')+'\n')
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
    queries.forEach(query => {
      const q = query.q
      const ind = query.index
      q.on('updated', (result) => {
        const completeness = result.length / query.query.card * 100
        activeQueries.get(ind).completeness = completeness
        activeQueries.get(ind).resultsObtained = result.length
        activeQueries.get(ind).round = q.round
        if(q.round >= config.round) {
          q.stop()
        } else {
          computeGlobalCompleteness(queries.length, clients, q._parent, q.round, query.query, completeness, query.resultName, query.dir, ind).then(() => {
            // noop
          }).catch(e => {
            console.error(e)
          })
        }

      })
      q.on('end', (result) => {
        console.log('Query %s finished', query.query.filename)
        done()
      })
      q.on('error',(err) => {
        reject(err)
      })
    })

    let finished = 0
    function done() {
      finished++
      if(finished === queries.length) resolve()
    }
    append(path.resolve(destination+'/global-completeness.csv'), [
      'round',
      'globalcompleteness',
      'messages',
      'egdes-RPS',
      'edges-SON',
      'allmessages',
      'completeQueries',
      'queriesNumber',
      'obtainedresults',
      'wantedresults'
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

function computeGlobalCompleteness(numberOfQueries, clients, client, round, query, completeness, resultName, dir, ind) {
  return new Promise((resolve, reject) => {
    try {
      // append local result
      append(resultName, [
        round,
        completeness,
        client._statistics.message,
        client._foglet.getNeighbours().length,
        (config.options.activeSon)?client._foglet.overlay('son').network.getNeighbours().length:0,
        activeQueries.get(ind).resultsObtained,
        query.card
      ].join(',')+'\n').then(() => {
        // write the network state for the round "round" of the client "client"
        writeNeighbours(clients, globalRound, dir).then(() => {
          globalResults[round].push('done')
          receiveAnswers++
          // if all results of the round i received, print a global message and save it to global-compl.csv
          if(globalResults[round].length === numberOfQueries) {
            const realactivequeries = getActivesQueries()
            console.log('Number of actives queries: ', realactivequeries.length)
            // write the global table when a round is finished
            writeNeighbours(clients, globalRound).then(() => {
              // print to the screen the state of the network (RPS + (?SON))
              printEdges(clients, globalRound)
              globalCompleteness = realactivequeries.reduce((acc, cur) => acc+cur.completeness, 0) / numberOfQueries

              // application's messages
              const currentMessage = clients.reduce((acc, cur) => acc+cur._statistics.message, 0)
              let m = 0
              if(globalMessage === 0) {
                globalMessage = currentMessage
              }
              m = currentMessage - globalMessage
              globalMessage = currentMessage

              // network's messages
              const currentMessagetotal = AbstractSimplePeer.manager.stats.message
              let mtotal = 0
              if(globalMessagetotal === 0) {
                globalMessagetotal = currentMessagetotal
              }
              mtotal = currentMessagetotal - globalMessagetotal
              globalMessagetotal = currentMessagetotal

              // calcul of the number of SON edges and RPS edges in the network
              let overlayEdges = 0
              if(config.options.activeSon) {
                overlayEdges = clients.reduce((acc, cur) => acc+cur._foglet.overlay('son').network.getNeighbours().length, 0)
              }
              const edges = clients.reduce((acc, cur) => acc+cur._foglet.getNeighbours().length, 0)

              // calcule of the number of complete queries
              const completeQueries = [...activeQueries.values()].reduce((acc, cur) => {
                if(cur.completeness === 100) return acc+1
                return acc
              }, 0)

              const maxResults = realactivequeries.reduce((acc, cur) => acc+cur.maxresults, 0)
              const obtained = realactivequeries.reduce((acc, cur) => acc+cur.resultsObtained, 0)

              // save results
              const towrite =[
                globalRound,
                globalCompleteness,
                m,
                edges,
                overlayEdges,
                mtotal,
                completeQueries,
                realactivequeries.length,
                obtained,
                maxResults
              ]
              // append the result to the global results file.
              // But this a state of the network when we receive the last result for the round i
              // If you want a complete state when the round i is finished for peer i,
              // see its specific completess file and network state files
              append(path.resolve(destination+'/global-completeness.csv'), towrite.join(',')+'\n').then(() => {
                console.log('[%f] Global completeness: %f % (%f/%f)', globalRound, globalCompleteness, completeQueries, numberOfQueries)
                globalRound++
                resolve()
              }).catch(e => {
                console.log(e)
              })
            }).catch(e => {
              console.log(e)
            })
          } else {
            resolve()
          }
        })
      }).catch(e => {
        console.log(e)
      })
    } catch (e) {
      reject(e)
    }
  })
}

function printEdges (clients, round) {
  return new Promise((resolve, reject) => {
    let overlayEdges = 0
    if(config.options.activeSon) {
      overlayEdges = clients.reduce((acc, cur) => acc+cur._foglet.overlay('son').network.getNeighbours().length, 0)
    }
    const edges = clients.reduce((acc, cur) => acc+cur._foglet.getNeighbours().length, 0)
    console.log(`[${round}] |RPS-edges|: ${edges}, |SON-edges|: ${overlayEdges}`)
  })
}

function writeNeighbours(clients, round, dir) {
  return new Promise((resolve, reject) => {
    const toReturn = [...activeQueries.values()].reduce((acc, cur) => {
      let res = {
        type: cur.query.name,
        inview: cur.client._foglet.inViewID,
        outview: cur.client._foglet.outViewID,
        rps: cur.client._foglet.getNeighbours(),
        profile: cur.client._profile.export()
      }
      if(cur.client._options.activeSon) {
        res.overlay = cur.client._foglet.overlay('son').network.getNeighbours()
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
