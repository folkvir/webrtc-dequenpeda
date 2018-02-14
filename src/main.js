const debug = require('debug')('main')
const FogletCore = require('foglet-core').Foglet
const lmerge = require('lodash.merge')
const N3 = require('n3')
const N3Util = N3.Util
const Store = require('./store')
const Query = require('./query')
let DEFAULT_OPTIONS = {
  defaultGraph: '<http://mypersonaldata.com/>',
  timeout: 5000,
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
        delta: 15 * 1000,   // spray-wrtc shuffle interval
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

module.exports = class Dequenpeda {
  constructor (options) {
    this._options = lmerge(DEFAULT_OPTIONS, options)
    this._foglet = new FogletCore(this._options.foglet)
    this._foglet.share()
    this._foglet.onUnicast((id, message) => {
      debug(`[${this._foglet._id}] ReceiveUnicast: ${JSON.stringify(message)}`)
      this._handleUnicast(id, message)
    })
    this._foglet.onBroadcast((id, message) => {
      debug(`[${this._foglet._id}] ReceiveBroadcast: ${JSON.stringify(message)}`)
      this._handleBroadcast(id, message)
    })
    this._parser = new Map()
    this._store = new Store()
    this._queries = new Map()
    this._periodicExecutionInterval = setInterval(() => {
      this._periodicExecution()
    }, this._options.foglet.rps.options.delta + 1000)
  }

  /**
   * Connect a peer on the network
   * @return {[type]} [description]
   */
  connection () {
    return this._foglet.connection()
  }

  /**
   * Query the whole network with the specified query on each suffle
   * The query is executed on those events: 'loaded', 'updated' and 'end'
   * @param  {[type]} queryString your query
   * @return {Object}             return an Object qith id, queryString and an event object with the specified event emitted: 'loaded', 'updated', 'end'
   */
  query (queryString) {
    try {
      const query = new Query(queryString, this)
      query.execute().then(() => {
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
   * Stop the execution of the given query
   * @param  {string} queryId the id of the query
   * @return {void}
   */
  stop (queryId) {

  }

  stopAll () {

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
            return this._store.loadData(this._options.defaultGraph, [], cur)
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
    return this._store.getTriples(graph, [], pattern)
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
      debug(`[client:${this._foglet._id}]`, ` Someone is asking for data: ${message}`)

      message.triples.reduce((acc, triple) => acc.then(result => {
        return new Promise((resolve, reject) => {
          this._store.getTriples(this._options.defaultGraph, message.prefixes, triple).then((res) => {
            resolve([...result, {
              triple,
              data: res
            }])
          }).catch(e => {
            resolve([...result, {
              triple,
              data: []
            }])
          })
        })
      }), Promise.resolve([])).then(res => {
        this._foglet.sendUnicast(message.requester.inview, {
          type: 'answer-triples',
          query: message.query,
          triples: res
        })
      })
    } else if (message.type === 'answer-triples') {
      debug(`[client:${this._foglet._id}]`, ` Someone send me data: ${message}`)
    }
  }

  _handleBroadcast (id, message) {

  }

  _periodicExecution () {
    debug(`[client:${this._foglet._id}] a shuffle occured`)
    if (this._queries.size > 0) {
      this._queries.forEach(q => {
        q.execute().then(() => {
          // noop
        }).catch(e => {
          console.error(e)
        })
      })
    } else {

    }
  }
}
