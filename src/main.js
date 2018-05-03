const debug = require('debug')('dequenpeda:main')
const FogletCore = require('foglet-core').Foglet
const lmerge = require('lodash.merge')
const EventEmitter = require('events')
const N3 = require('n3')
const N3Util = N3.Util
const Writer = N3.Writer
const uniqid = require('uniqid')
const Store = require('./store')
const StoreWorker = require('./store-worker')
const Query = require('./query')
const UnicastHandlers = require('./unicast-handlers')
const Profile = require('./son/profile')
const Son = require('./son/son')
const assert =require('assert')

const debugError = require('debug')('error')
const clone = (obj) => JSON.parse(JSON.stringify(obj))

const MAX_SET_TIMEOUT = 2147483647

let DEFAULT_OPTIONS = {
  storeWorker: true,
  manualshuffle: false,
  manualshuffleperiodicdelta: 30 * 1000,
  manualshufflewaitingtime: 5 * 1000,
  activeSon: false,
  defaultGraph: 'http://mypersonaldata.com/',
  timeout: 10 * 1000,
  queryType: 'normal',
  shuffleCountBeforeStart: 1,
  foglet: {
    rps: {
      type: 'spray-wrtc',
      options: {
        a: 1,
        b: 0,
        protocol: 'dequenpeda-protocol', // foglet running on the protocol foglet-example, defined for spray-wrtc
        webrtc: { // add WebRTC options
          trickle: true, // enable trickle (divide offers in multiple small offers sent by pieces)
          iceServers: [] // define iceServers in non local instance
        },
        timeout: 10 * 1000, // spray-wrtc timeout before definitively close a WebRTC connection.
        delta: 5 * 1000,   // spray-wrtc shuffle interval
        signaling: {
          address: 'http://localhost:8000/',
          // signalingAdress: 'https://signaling.herokuapp.com/', // address of the signaling server
          room: 'dequenpeda-room' // room to join
        }
      }
    }
  }
}

// if (process) {
//   DEFAULT_OPTIONS.foglet.rps.options.webrtc.wrtc = require('wrtc')
// }


process.on('unhandledRejection', function(reason, p){
    debugError("Possibly Unhandled Rejection at: Promise ", p, " reason: ", reason);
});

module.exports = class Dequenpeda extends EventEmitter {
  constructor (options) {
    super()
    this.on('error', debugError)
    this._profile = new Profile()
    this._statistics = {
      message: 0
    }
    this._options = lmerge(DEFAULT_OPTIONS, options)
    if(this._options.manualshuffle) {
      this._options.foglet.rps.options.delta = MAX_SET_TIMEOUT
    }
    if(this._options.activeSon) {
      // means that we have activated the overlay
      const son = {
        name: 'son',
        class: Son,
        options: {
          socketClass: this._options.foglet.rps.options.socketClass,
          profile: this._profile,
          delta: this._options.foglet.rps.options.delta,
          sample: 5,
          partialViewSize: 5,
          timeoutDescriptor: 30 * 1000,
          timeout: this._options.foglet.rps.options.timeout,
          periodicProfileExchange: 10 * 1000,
          protocol: 'dequenpeda-protocol-son-overlay', // foglet running on the protocol foglet-example, defined for spray-wrtc
          signaling: {
            address: 'https://localhost:8000/',
            room: 'dequenpeda-room-overlay' // room to join
          }
        }
      }
      if(this._options.manualshuffle) {
        options.foglet.rps.options.delta = MAX_SET_TIMEOUT
      }
      this._options.foglet.overlays =[son]
    }
    this._id = uniqid()
    this._options.foglet.id = this._id
    this._foglet = new FogletCore(this._options.foglet)
    // this._foglet.share()
    this._foglet.onUnicast((id, message) => {
      // debug(`[${this._foglet._id}] ReceiveUnicast: ${JSON.stringify(message)}`)
      this._handleUnicast(id, message)
      this.emit('receive-unicast', {id, message: clone(message)})
    })
    if(this._options.activeSon) {
      // means that we have activated the overlay
      this._foglet.overlay('son').communication.onUnicast((id, message) => {
        // debug(`[${this._foglet._id}] ReceiveUnicast: ${JSON.stringify(message)}`)
        this._handleUnicast(id, message)
        this.emit('receive-unicast', {id, message: clone(message)})
      })
    }
    this._parser = new Map()
    if(this._options.storeWorker) {
      this._store = new StoreWorker()
    } else {
      this._store = new Store()
    }

    this._queries = new Map()
    this._shuffleCount = 0
    if(!this._options.manualshuffle) {
      this._periodicExecutionInterval = setInterval(() => {
        // waiting for the first connection to open and then execute
        // console.log(`[${this._foglet.id}] periodic execution: before calling the method `, this._shuffleCount, this._foglet.getNeighbours().length, this._foglet.overlay('son').network.getNeighbours().length, this._queries.size)
        // wait 5 seconds to lets the shuffle to be done
        setTimeout(() => {
          this._periodicExecution()
        }, 5000)
        //setTimeout(() => {this._periodicExecution()}, 5000)
      }, this._options.foglet.rps.options.delta)
    }
    // set the listener for manual shuffle
    if(this._options.manualshuffle) {
      this._periodicShuffle = setInterval(() => {
        if(this._queries.size === 0) {
          this._shuffle()
        }
      }, this._options.manualshuffleperiodicdelta)
      this.on('check-shuffle', () => {
        if(this._queries.size > 0) {
          const shuffle = true
          this._queries.forEach(q => {
            if(q._status !== 'executed') shuffle = false
          })
          if(shuffle) {
            console.log(`[${this._foglet.id}]Time to shuffle connections.`)
            this._shuffle()
          }
        }
      })
    }
  }

  /**
   * Connect a peer on the network
   * If the argument is undefined try to use signaling options in the RPS config options
   * Usefull in production mode, in test mode connect them manually using wrtc package (see npm or github, node-wrtc)
   * @return {[type]} [description]
   */
  connection (app = undefined, ...args) {
    if(app) {
      return this._foglet.connection(app._foglet, ...args).then(() => {
        this.emit('connected')
        return Promise.resolve()
      }).catch(e => {
        this.emit('error', e)
        return Promise.reject(e)
      })
    } else {
      this._foglet.share()
      return this._foglet.connection(app, ...args).then(() => {
        this.emit('connected')
        return Promise.resolve()
      }).catch(e => {
        this.emit('error', e)
        return Promise.reject(e)
      })
    }
  }

  close () {
    return new Promise((resolve, reject) => {
      this._foglet.overlay().network.rps.disconnect()
      if(this._options.activeSon) this._foglet.overlay('son').network.rps.disconnect()
      if(this._options.storeWorker) this._store.close()
      this.stopAll().then(() => {
        resolve()
      }).catch(e => {
        reject(e)
      })
    })
  }

  /**
   * Query the whole network with the specified query on each suffle
   * The query is executed on those events: 'loaded' 'updated' and 'end'
   * @param  {[type]} queryString your query
   * @return {Object}             return an Object qith id, queryString and an event object with the specified event emitted: 'loaded', 'updated', 'end'
   */
  query (queryString, type = this._options.queryType, options = {activeSon: this._options.activeSon}) {
    try {
      // choose the type of query to execute
      let QueryClass = this._chooseQueryClass(type)
      const query = new QueryClass(queryString, this, options)
      this._queries.set(query._id, query)
      this.emit('new-query', query._id)
      return query
    } catch (e) {
      console.log(e)
    }
  }

  /**
   * @private Choose the adequat class for running a query
   * @param  {[type]} type [description]
   * @return {Object}      Return a Query Class
   */
  _chooseQueryClass (type) {
    if (type === 'normal') { return Query }
  }

  /**
   * Stop the execution of the given query
   * @param  {string} queryId the id of the query
   * @return {void}
   */
  stop (queryId) {
    return new Promise((resolve, reject) => {
      if (this._queries.has(queryId)) {
        this._queries.get(queryId)._stop().then(() => {
          this._queries.delete(queryId)
          resolve()
        }).catch(e => {
          reject(e)
        })
      } else {
        reject(new Error('Query not found'))
      }
    })
  }

  /**
   * Stop all queries
   * @return {[type]} [description]
   */
  stopAll () {
    return new Promise((resolve, reject) => {
      if (this._queries.size === 0) {
        resolve()
      }
      const queries = this._queries.values()
      const pending = [...queries].reduce((acc, q) => acc.then(() => {
        return q._stop().then(() => {
          this._queries.delete(q._id)
          return Promise.resolve()
        }).catch(e => {
          return Promise.reject(e)
        })
      }), Promise.resolve())
      pending.then(() => {
        resolve()
      }).catch(e => {
        reject(e)
      })
    })
  }

  /**
   * Load triples into the store, no blocking insertion on errored triples
   * @param  {String} stringFile the file you want to insert in a string Format
   * @return {Promise}
   */
  loadTriples (stringFile) {
    return new Promise((resolve, reject) => {
      // bulk loading
      this._store.loadDataAsTurtle(stringFile, this._options.defaultGraph).then(() => {
        resolve()
      }).catch(e => {
        reject(e)
      })
    })
  }

  loadTriplesOneByOne (stringFile) {
    return new Promise((resolve, reject) => {
      // triple by triple loading
      let parser = N3.Parser()
      let i = 0
      let triples = []
      let writer = new Writer()
      parser.parse(stringFile, (error, data, prefixes) => {
        if (error) {
          console.log(data)
          console.log(error)
          throw error
        }
        if (data) {
          const t = this._tripleParsed2Triple(Object.assign({}, data))
          triples.push(t)
          i++
        } else {
          triples.reduce((acc, cur) => acc.then((res) => {
            return this._store.loadData(this._encapsGraphId(this._options.defaultGraph, '<', '>'), [], cur)
          }), Promise.resolve()).then(() => {
            // send an event to the profile to update the overlay profile
            resolve()
          }).catch(e => {
            reject(e)
          })
        }
      })
    })
  }

  /**
   * Get triples from the datastore matching the given riples pattern
   * @param  {string} [graph=this._options.defaultGraph] the uri graph
   * @param  {Array}  [prefixes=[]]                      prefixes you want to add before querying
   * @param  {[type]} pattern                            the given pattern to match
   * @return {Array}                                    Array of triples
   */
  getTriples (graph = this._options.defaultGraph, prefixes = [], pattern) {
    if (graph === null) graph = undefined
    return this._store.getTriples(this._encapsGraphId(graph, '<', '>'), [], pattern)
  }

  /**
   * Just broadcast a message on all the network
   * @param  {Object} message [description]
   * @return {void}
   */
  broadcastMessage (message) {
    this._foglet.sendBroadcast(message)
  }

  _shuffle () {
    // shuffle the rps and wait
    // this._options.manualshufflewaitingtime
    // console.log(`[${this._foglet.id}] rps shuffle.`)
    this._foglet.overlay().network.rps._exchange()
    // console.log(`[${this._foglet.id}] wait for a proper rps shuffle.`)
    setTimeout(() => {
      if(this._options.activeSon) {
        // console.log(`[${this._foglet.id}] son shuffle.`)
        this._foglet.overlay('son').network.rps._exchange()
        // console.log(`[${this._foglet.id}] wait for a proper son shuffle.`)
        setTimeout(() => {
          this._periodicExecution()
        }, this._options.manualshufflewaitingtime)
      } else {
        // execute after wait cause we only have the rps enabled
        this._periodicExecution()
      }
    }, this._options.manualshufflewaitingtime)
  }

  _handleUnicast (id, message) {
    if (message.type === 'ask-triples') {
      UnicastHandlers._handleAskTriples.call(this, id, message)
    } else if (message.type === 'answer-triples') {
      // redirect the message to the corresponding query
      this._queries.get(message.query).emit('receive', message)
    } else if (message.type === 'ask-results') {
      UnicastHandlers._handleAskResults.call(this, id, message)
    } else if(message.type === 'answer-ask-results') {
      this._queries.get(message.queryId).emit('receive', message)
    } else {
      debug(id, message)
      // send all other messages to the appropriate query
      // this.emit('error', new Error('This message is not handled by the application. Please report.'))
    }
  }

  _periodicExecution () {
    this._shuffleCount++
    // console.log(`[client:${this._foglet._id}]`, 'Number of neighbours: ', this._foglet.getNeighbours().length)
    if(this._shuffleCount > this._options.shuffleCountBeforeStart) {
      // just assert to be sure that there is at least 1 peers in each overlay !!remove those 2 lines for a proper use!!
      // assert.notStrictEqual(this._foglet.getNeighbours().length, 0)
      // if(this._options.activeSon) assert.notStrictEqual(this._foglet.overlay('son').network.getNeighbours().length, 0)
      if (this._queries.size > 0) {
        //console.log(`[${this._foglet.id}] periodic execution: `, this._shuffleCount, this._foglet.getNeighbours().length, this._foglet.overlay('son').network.getNeighbours().length, this._queries.size)
        this.emit('periodic-execution-begins')
        let pendingQueries = []
        this._queries.forEach(q => {
          setImmediate(() => {
            const qpending = q.execute('updated')
            pendingQueries.push(qpending)
            qpending.then(() => {
              // noop
            }).catch(e => {
              console.log(e)
            })
          })
        })
        this.emit('periodic-execution', pendingQueries)
      } else {
        this.emit('periodic-execution', 'no-queries-yet')
      }
    } else {
      console.log('Waiting before starting ... [%f/%f]', this._shuffleCount, this._options.shuffleCountBeforeStart)
      if(this._options.manualshuffle) this._shuffle()
    }
  }

  _tripleParsed2Triple (triple) {
    if (!triple.subject.startsWith('?')) {
      if(N3.Util.isIRI(triple.subject)) triple.subject = `<${triple.subject}>`
      if(N3.Util.isLiteral(triple.subject)) triple.subject = `"${triple.subject}"`
    }
    if (!triple.predicate.startsWith('?') ) {
      if(N3.Util.isIRI(triple.predicate)) triple.predicate = `<${triple.predicate}>`
      if(N3.Util.isLiteral(triple.predicate)) triple.predicate = `"${triple.predicate}"`
    }
    if (!triple.object.startsWith('?')) {
      if(N3.Util.isIRI(triple.object)) triple.object = `<${triple.object}>`
      if(triple.object.indexOf("^^") > 0) {
        const parts = triple.object.split("^^")
        triple.object =  parts[0] + "^^<" + parts[1] + ">"
      }
    }
    return triple
  }

  _encapsGraphId (graph, symbolStart, symbolEnd) {
    return `${symbolStart}${graph}${symbolEnd}`
  }
}
