const debug = require('debug')('main')
const FogletCore = require('foglet-core').Foglet
const lmerge = require('lodash.merge')
const EventEmitter = require('events')
const N3 = require('n3')
const N3Util = N3.Util
const Store = require('./store')
const Query = require('./queries/query')
const QueryShared = require('./queries/query-shared')
const UnicastHandlers = require('./handlers/unicast-handlers')
const BroadcastHandlers = require('./handlers/broadcast-handlers')

const clone = (obj) => JSON.parse(JSON.stringify(obj))

let DEFAULT_OPTIONS = {
  defaultGraph: 'http://mypersonaldata.com/',
  timeout: 5000,
  queryType: 'normal',
  shuffleCountBeforeStart: 0,
  foglet: {
    rps: {
      type: 'spray-wrtc',
      options: {
        protocol: 'dequenpeda-protocol', // foglet running on the protocol foglet-example, defined for spray-wrtc
        webrtc: { // add WebRTC options
          trickle: true, // enable trickle (divide offers in multiple small offers sent by pieces)
          iceServers: [] // define iceServers in non local instance
        },
        timeout: 2 * 60 * 1000, // spray-wrtc timeout before definitively close a WebRTC connection.
        delta: 5 * 1000,   // spray-wrtc shuffle interval
        signaling: {
          address: 'http://localhost:3000/',
          // signalingAdress: 'https://signaling.herokuapp.com/', // address of the signaling server
          room: 'dequenpeda-room' // room to join
        }
      }
    }
  }
}
if (process) {
  DEFAULT_OPTIONS.foglet.rps.options.webrtc.wrtc = require('wrtc')
}

module.exports = class Dequenpeda extends EventEmitter {
  constructor (options) {
    super()
    this._options = lmerge(DEFAULT_OPTIONS, options)
    this._foglet = new FogletCore(this._options.foglet)
    this._foglet.share()
    this._foglet.onUnicast((id, message) => {
      // debug(`[${this._foglet._id}] ReceiveUnicast: ${JSON.stringify(message)}`)
      this._handleUnicast(id, message)
      this.emit('receive-unicast', {id, message: clone(message)})
    })
    this._foglet.onBroadcast((id, message) => {
      this._handleBroadcast(id, message)
      this.emit('receive-broadcast', {id, message: clone(message)})
    })
    this._parser = new Map()
    this._store = new Store()
    this._queries = new Map()
    this._shuffleCount = 0
    this._periodicExecutionInterval = setInterval(() => {
      this._periodicExecution()
    }, this._options.foglet.rps.options.delta + 1000)
  }

  /**
   * Connect a peer on the network
   * If the argument is undefined try to use signaling options in the RPS config options
   * Usefull in production mode, in test mode connect them manually using wrtc package (see npm or github, node-wrtc)
   * @return {[type]} [description]
   */
  connection (app) {
    return this._foglet.connection(app._foglet).then(() => {
      this.emit('connected')
      return Promise.resolve()
    }).catch(e => {
      this.emit('error', e)
      return Promise.reject(e)
    })
  }

  /**
   * Query the whole network with the specified query on each suffle
   * The query is executed on those events: 'loaded' 'updated' and 'end'
   * @param  {[type]} queryString your query
   * @return {Object}             return an Object qith id, queryString and an event object with the specified event emitted: 'loaded', 'updated', 'end'
   */
  query (queryString, type = this._options.queryType, options = undefined) {
    try {
      // choose the type of query to execute
      let QueryClass = this._chooseQueryClass(type)
      const query = new QueryClass(queryString, this, options)
      this._queries.set(query._id, query)
      query.execute('loaded').then(() => {
        // noop
      }).catch(e => {
        console.error(e)
      })
      return query
    } catch (e) {
      throw new Error(e)
    }
  }

  /**
   * @private Choose the adequat class for running a query
   * @param  {[type]} type [description]
   * @return {Object}      Return a Query Class
   */
  _chooseQueryClass (type) {
    if (type === 'normal') { return Query } else if (type === 'shared') {
      return QueryShared
    }
  }

  /**
   * Stop the execution of the given query
   * @param  {string} queryId the id of the query
   * @return {void}
   */
  stop (queryId) {
    if (this._queries.has(queryId)) {
      this._queries.get(queryId).stop().then(() => {
        this._queries.delete(queryId)
      })
    }
  }

  /**
   * Stop all queries
   * @return {[type]} [description]
   */
  stopAll () {
    this._queries.forEach(q => {
      q.stop().then(() => {
        this._queries.delete(q._id)
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
      let parser = N3.Parser()
      let i = 0
      let triples = []
      parser.parse(stringFile, (error, data, prefixes) => {
        if (error) console.error(error)
        if (data) {
          const triple = {
            subject: `<${data.subject}>`,
            predicate: `<${data.predicate}>`,
            object: undefined
          }
          if (N3Util.isLiteral(data.object)) {
            triple.object = JSON.stringify(data.object)
          } else {
            triple.object = `<${data.object}>`
          }
          triples.push(triple)
          i++
        } else {
          debug(`[client:${this._foglet._id}]`, 'Triples red', prefixes)
          debug(`[client:${this._foglet._id}]`, `Number of triple red: `, i)
          triples.reduce((acc, cur) => acc.then((res) => {
            return this._store.loadData(this._encapsGraphId(this._options.defaultGraph, '<', '>'), [], cur)
          }), Promise.resolve()).then(() => {
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
    debug(`[client:${this._foglet._id}]`, ` Send: ${message}`)
    this._foglet.sendBroadcast(message)
  }

  _handleUnicast (id, message) {
    if (message.type === 'ask-triples') {
      UnicastHandlers._handleAskTriples.call(this, id, message)
    } else if (message.type === 'answer-triples') {
      debug(`[client:${this._foglet._id}]`, ` Someone send me data: ${message}`)
      // redirect the message to the corresponding query
      this._queries.get(message.query).emit('receive', message)
    } else if (message.type === 'ask-results') {
      UnicastHandlers._handleAskResults.call(this, id, message)
    } else if(message.type === 'answer-ask-results') {
      this._queries.get(message.queryId).emit('receive', message)
    } else {
      // send all other messages to the appropriate query
      throw new Error('This message is not handled by the application. Please report.')
    }
  }

  _handleBroadcast (id, message) {
    if (message.type === 'new-shared-query') {
      BroadcastHandlers._handleNewSharedQuery.call(this, id, message)
    } else if (message.type === 'delete-shared-query') {
      BroadcastHandlers._handleDeleteSharedQuery.call(this, id, message)
    } else {
      // send all other messages to the appropriate query
      throw new Error('This message is not handled by the application. Please report.')
    }
  }  

  _periodicExecution () {
    this.emit('periodic-execution-begins')
    if(this._shuffleCount >= this._options.shuffleCountBeforeStart) {
      debug(`[client:${this._foglet._id}] a shuffle occured`)
      debug(`[client:${this._foglet._id}] ${this._queries.size} pending queries...`)
      if (this._queries.size > 0) {
        let pendingQueries = []
        this._queries.forEach(q => {
          const qpending = q.execute('updated')
          pendingQueries.push(qpending)
          qpending.then(() => {
            // noop
          }).catch(e => {
            console.error(e)
          })
        })
        this.emit('periodic-execution', pendingQueries)
      } else {
        this.emit('periodic-execution', 'no-queries-yet')
      }
    }
    this._shuffleCount++
  }

  _encapsGraphId (graph, symbolStart, symbolEnd) {
    return `${symbolStart}${graph}${symbolEnd}`
  }
}
