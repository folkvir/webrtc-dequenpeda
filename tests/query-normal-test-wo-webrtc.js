const Dequenpeda = require('../webrtc-dequenpeda').Client
const CyclonAdapter = require('../webrtc-dequenpeda').CyclonAdapter
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
const ldiff = require('lodash.difference')

commander
  .option('-c, --clients <clients>', 'Override: Number of clients', (e) => parseInt(e))
  .option('-t, --timeout <timeout>', 'Override: Query Timeout', (e) => parseFloat(e))
  .option('-n, --name <name>', 'Name of the experiement to add', 'test')
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

let name = ((config.name)?config.name:'test')+'-'+time+uniqid()
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
            clients.reduce((cacc, cur) => {
              return cur.close()
            }, Promise.resolve()).then(() => {
              process.exit(0)
            })
            process.exit(1)
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
    let connectedClients = []
    if(clients.length < 2) reject(new Error('need at least 2 client'))
    clients.reduce((accClient, client, i) => accClient.then(() => {
      return wait(1000).then(() => {
        return new Promise((res, rej) => {
          // pick a random connected peer
          const rand = Math.floor(Math.random() * connectedClients.length)
          debug(rand, connectedClients.map((e) => e._foglet.overlay().network.rps.partialView.size))
          let rnclient = connectedClients[rand] // connectedClients[rn]
          if(i===0) rnclient = clients[Math.floor(Math.random() * clients.length)]

          console.log('Connecting client: %s to client: %s', client._foglet.id, rnclient._foglet.id)
          // connect the SON, it will connect the rps as well
          if(config.options.activeSon) {
            client.connection(rnclient, 'son').then(() => {
              // client._foglet.overlay().network.rps._exchange()
              connectedClients.push(client)
              setTimeout(() => {
                client._foglet.overlay().network.rps._exchange()
                client._foglet.overlay().network.rps.once('end-shuffle', () => {
                  const pv = pvov = clients.reduce((acc, cur) => {
                    return acc + [...cur._foglet.overlay().network.rps.partialView].reduce((a, c) => a+c.length, 0)
                  }, 0)
                  console.log('Arcs: ', pv)
                  res()
                })
              }, 500)
            }).catch(e => {
              res()
            })
          } else {
            // rps
            client.connection(rnclient).then(() => {
              // rn[rn.length-1]._foglet.overlay().network.rps._exchange()
              connectedClients.push(client)
              setTimeout(() => {
                client._foglet.overlay().network.rps._exchange()
                client._foglet.overlay().network.rps.once('end-shuffle', () => {
                  const pv = pvov = clients.reduce((acc, cur) => {
                    return acc + [...cur._foglet.overlay().network.rps.partialView].reduce((a, c) => a+c.length, 0)
                  }, 0)
                  console.log('Arcs: ', pv)
                  res()
                })
              }, 500)
            }).catch(e => {
              res()
            })
          }
        })
      }).catch(e => {
        return Promise.reject(e)
      })
    }), Promise.resolve()).then(() => {

      const toprint = clients.map(c => c._foglet.getNeighbours().length)
      console.log(JSON.stringify(toprint))

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
        activeQueries.set(clients[i]._id, {
          maxresults: 0,
          id: clients[i]._id,
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
          activeQueries.set(clients[i]._id, {
            maxresults: 0,
            id: clients[i]._id,
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
          activeQueries.set(clients[i]._id, {
            maxresults: 0,
            id: clients[i]._id,
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
    activeQueries.get(client._id).maxresults = query.card
    activeQueries.get(client._id).client = client
    activeQueries.get(client._id).query = query
    activeQueries.get(client._id).resultName = resultName
    activeQueries.get(client._id).dir = dir
    activeQueries.get(client._id).round = 0
    console.log('Affecting: %s to client %s', query.filename, client._id)
    console.log('Output will be in: ', resultName)
    resolve({
      client: client,
      q: client.query(query.query, 'normal', {
        timeout: config.timeout
      }),
      id: client._id,
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
      let shuffle = 0
      client.on('periodic-execution', (eventName) => {
        if(eventName !== 'no-queries-yet') {
          // now check before increasing the shuffle number cause, if we are at shuffle +1 we need to stop the experiment
          if(shuffle > config.round - 1) {
            console.log('[%s] stop the query anyway', query.query.filename)
            q.stop()
          }
          shuffle++
        }
      })
      const callbackUpdated = (result, roundStart, roundEnd) => {
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
            // debug('RoundStrart > 0')
            let r = roundStart - 1
            if(roundStart >= config.round - 1) r = config.round - 1
            let entry = findEntry(r, client._foglet.id)
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
          clientid: client._foglet._id,
          clientind: ind,
          timeout,
          card: query.query.card,
          obtained: resultsObtained,
          resultName: query.resultName
        }

        if(roundStart < config.round - 1) {
          if(!globalResults[roundStart].includes(client._foglet.id)) {

            globalResults[roundStart].push(client._foglet.id)
            let roundToPrint = [0, config.round-2, config.round-3, Math.floor(config.round/2)]
            if(roundToPrint.includes(roundStart)) {
              writeNeighbours(roundStart, query.dir).catch(e => {
                console.log(e)
              })
            }
            globalResultsQuery[roundStart].push(topush)


            const gs = sizeof(globalResultsQuery)

            console.log(`1[${query.query.filename}][${client._foglet.id}] Receive results for round: (start, end) = (${roundStart},${roundEnd}), [${globalResults[roundStart].length}/${queries.length}], Global size: ${gs}`)
            checkRound(roundStart, globalResults[roundStart].length, queries.length)
          } else {
            console.log(`1[${query.query.filename}][${client._foglet.id}] We receive a second time a result for this run. NOT POSSIBLE: round:(start, end) = (${roundStart},${roundEnd}) `)
          }
        } else if(roundStart === config.round-1) {
          if(!globalResults[roundStart].includes(client._foglet.id)) {

            globalResults[roundStart].push(client._foglet.id)
            let roundToPrint = [0, config.round-2, config.round-3, Math.floor(config.round/2)]
            if(roundToPrint.includes(roundStart)) {
              writeNeighbours(roundStart, query.dir).catch(e => {
                console.log(e)
              })
            }
            globalResultsQuery[roundStart].push(topush)
            const gs = sizeof(globalResultsQuery)
            console.log(`2[${query.query.filename}][${client._foglet.id}] Receive results for round: (start, end) = (${roundStart},${roundEnd}), [${globalResults[roundStart].length}/${queries.length}], Global size: ${gs}`)
            checkRound(roundStart, globalResults[roundStart].length, queries.length)
          } else {
            console.log(`2[${query.query.filename}][${client._foglet.id}] We receive a second time a result for this run. NOT POSSIBLE: round:(start, end) = (${roundStart},${roundEnd}) `)
          }
        }
      }
      const callbackEnd = (result) => {
        console.log('Query %s finished', query.query.filename)
        finished++
        done(query.query.filename)
      }
      const callbackError = (err) => {
        reject(err)
      }
      q.on('updated', callbackUpdated)
      q.on('end', callbackEnd)
      q.on('error', callbackError)
    })

    function done(q) {
      console.log('[%s] done, [%f/%f]',q, finished, queries.length)
      if((finished === queries.length) ) {
        queries.forEach(query => {
          query.q.removeAllListeners()
        })
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

function checkRound(round, received, max) {
  return new Promise((resolve, reject) => {
    if(received === max) {
      // print
      printEdges(round).then(() => {
        // now write to disk the result for round "round"
        // just compute the average on the chosen round
        const chosenRound = globalResultsQuery[round]
        console.log('Round:%f :=: #r=%f', round, chosenRound.length)
        chosenRound.reduce((acc, val) => acc.then(() => {
          const data = [
            val.roundStart,
            val.completeness,
            val.timeout,
            val.obtained,
            val.card,
            val.message,
          ]
          return append(val.resultName+'-tmp.csv', data.join(',')+'\n')
        }), Promise.resolve()).then(() => {
          const globalCompleteness = chosenRound.reduce((acc, cur) => acc+cur.completeness, 0) / chosenRound.length
          const completed = chosenRound.filter((cur) => cur.completeness === 100).length
          const globalCompletenessCompleted = completed / chosenRound.length * 100

          const completeQueries = chosenRound.reduce((acc, cur) => {
            if(cur.completeness === 100) return acc+1
            return acc
          }, 0)
          const messages = chosenRound.reduce((acc, cur) => acc+cur.message, 0)
          const maxResults = chosenRound.reduce((acc, cur) => acc+cur.card, 0)
          const obtained = chosenRound.reduce((acc, cur) => acc+cur.obtained, 0)
          const completenessInresults = obtained / maxResults * 100
          const timedout = chosenRound.reduce((acc, cur) => acc+(cur.timeout)?1:0, 0)
          append(path.resolve(destination+'/tmp-global-completeness.csv'), [
            round,
            globalCompleteness,
            globalCompletenessCompleted,
            completenessInresults,
            messages,
            completeQueries,
            chosenRound.length,
            obtained,
            maxResults,
            timedout
          ].join(',')+'\n').then(() => {
            writeNeighbours(round, path.resolve(destination)).then(() => {
              // once all is done resolve
              resolve()
            }).catch(e => {
              console.error(e)
            })
          }).catch(e => {
            console.error(e)
          })
        }).catch(e => {
          console.error(e)
        })
      }).catch(e => {
        console.error(e)
      })
    } else {
      resolve()
    }
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


function findEntry(r, id) {
  // console.log('Find entry:', r, id)
  if(r <= 0) {
    return undefined
  } else {
    const entry = globalResultsQuery[r].find((e) => {
      return activeQueries.get(e.clientid).client._foglet.id === id
    })
    if(entry) {
      return entry
    } else {
      return findEntry(r-1)
    }
  }
}

function printGlobalResults() {
  return new Promise((resolve, reject) => {
    try {
      const clients = getActivesQueries().map(e => e.client._foglet._id)
      // before all we need to check if we have all results, in case of late results
      for(let i = 0; i<globalResultsQuery.length; i++) {
        console.log(globalResultsQuery[i].length, clients.length)
        if(globalResultsQuery[i].length < clients.length) {
          // late results
          // fill the gap with last results of missing entries
          const local = globalResultsQuery[i].map(e => e.clientid)
          let diff = ldiff(clients, local)
          if(diff.length > 0) diff.forEach(c => {
            // fill with last entry
            const findEntryById = (id) => {
              return getActivesQueries().find(e => {
                // console.log('try to find: ', id, e.client._foglet.id)
                if(e.client._foglet.id === id) return true
                return false
              })
            }
            const client = findEntryById(c)
            if(client) {
              const entry = findEntry(i-1, client.client._id)
              const def = {
                dir: client.dir,
                message: client.client._statistics.message,
                name: client.query.filename,
                roundStart: i,
                completeness: 0,
                clientid: client.client._foglet._id,
                timeout: true,
                card: client.query.card,
                obtained: 0,
                resultName: client.resultName
              }
              if(!entry) {
                globalResultsQuery[i].push(def)
              } else {
                def.message = entry.message
                def.completeness = entry.completeness
                def.obtained = entry.obtained
                entry.timedout = true
                globalResultsQuery[i].push(entry)
              }
            } else {
              throw new Error('no client found! IMPOSSIBLE')
            }
          })
        } else {
          console.log('All results for round: ', i)
        }
      }


      for(let i = 0; i<globalResultsQuery.length; i++) {
        console.log('Round:%f :=: #r=%f', i, globalResultsQuery[i].length)
        const header = ['round', 'completeness', 'timeout', 'receiveresults', 'maxresults', 'name']
        for(let j = 0; j<globalResultsQuery[i].length; j++) fs.appendFileSync(globalResultsQuery[i][j].resultName, header.join(',')+'\n')
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
    } catch (e) {
      reject(e)
    }
  })
}

function printEdges (round) {
  return new Promise((resolve, reject) => {
    let overlayEdges = 0
    let pvov
    if(config.options.activeSon) {
      overlayEdges = [...activeQueries.values()].reduce((acc, cur) => acc+cur.client._foglet.overlay('son').network.getNeighbours().length, 0)
    }

    const pv = pvov = [...activeQueries.values()].reduce((acc, cur) => {
      console.log(cur.client._foglet.overlay().network.rps.partialView.size, cur.client._foglet.overlay('son').network.rps.partialView.size)
      return acc + cur.client._foglet.overlay().network.rps.partialView.size
    }, 0)
    const edges = [...activeQueries.values()].reduce((acc, cur) => acc+cur.client._foglet.getNeighbours().length, 0)
    const edgesAll = [...activeQueries.values()].reduce((acc, cur) => acc+cur.client._foglet.getNeighbours(Infinity).length, 0)
    console.log(`[${round}] |RPS-edges|: ${edges}, |SON-edges|: ${overlayEdges}, (RPS-arcs, RPS-con) = (${pv},${edgesAll}) AVERAGE-PV:${pv/[...activeQueries.values()].length} `)
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
      id: 'c'+i,
      rps: {
        type: 'custom',
        options: {
          class: CyclonAdapter,
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
