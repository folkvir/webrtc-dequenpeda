const uniqid = require('uniqid')
const EventEmitter = require('events')
const SparqlParser = require('sparqljs').Parser
const SparqlGenerator = require('sparqljs').Generator
const debug = require('debug')('dequenpeda:query-shared')
const Base64 = require('js-base64').Base64
const lmerge = require('lodash.merge')

const clone = (obj) => JSON.parse(JSON.stringify(obj))

module.exports = class Query extends EventEmitter {
  constructor (queryString, parent, options = {}) {
    super()
    this._options = lmerge({
      shared: true,
      log: false,
      stream: false
    }, options)
    this._parent = parent
    this._query = queryString
    this._id = Base64.encode(this._query)
    try {
      const parser = new SparqlParser()
      this._parsedQuery = parser.parse(this._query)
      this._lastParsedQuery = this._parsedQuery
    } catch (e) {
      throw new Error('An error occured during the parsing of the query:', queryString)
    }
    // store any client id for any triple pattern received
    this._mappings = new Map()
    this._results = []
    this._propertiesResult = []
    this._variableStartChar = '?' // by default
    this._resultsIndex = new Map()
    for(let index in this._parsedQuery.variables) {
      // remove the first char, and store it somewhere
      const propRes = this._parsedQuery.variables[index]
      this._variableStartChar = propRes[0]
      // store the property for a later usage
      const newProp = propRes.substr(1)
      this._propertiesResult.push(newProp)
      this._resultsIndex.set(newProp, new Map())
    }


    this.on('receive', (message) => {
      this._log(`[client:${this._parent._foglet.id}][Query:${this._id}] Receive: data from: ${message.requester.fogletId}`)
      this.emit(message.jobId, message)
    })

    // broadcast the query
    if(this._options.shared) {
      this._parent._foglet.sendBroadcast({
        type: 'new-shared-query',
        id: this._id,
        query: this._query,
        requester: {
          fogletId: this._parent._foglet.id,
          inview: this._parent._foglet.inViewID,
          outview: this._parent._foglet.outViewID
        },
        jobId: this._id
      })
    }
  }

  get results () {
    return clone(this._results)
  }

  stop () {
    return this.execute('end').then(() => {
      // now send a broadcasted message to delete all shared queries
      this._parent._foglet.sendBroadcast({
        type:'delete-shared-query',
        id: this._id
      })
      return Promise.resolve()
    }).catch(e => Promise.reject(e))
  }

  async execute (eventName) {
    this._log(`[client:${this._parent._foglet._id}] 1-Executing the query ${this._id}...`)
    const neighbors = this._parent._foglet.getNeighbours()
    if (neighbors.length > 0) {
      // execute after receiving results from neighbors
      return this._askResults().then((r) => {
        return new Promise((resolve, reject) => {
          return this._mergeExternalResults(r).then(() => {
            this._log('Finished to merge external results')
            return this._execute(eventName)
          })
        })
      })
    } else {
      // execute only on my data
      return this._execute(eventName)
    }
  }

  async _execute (eventName) {
    this._log(`[client:${this._parent._foglet.id}] 2-Executing the query ${this._id}...`)
    const pattern = {
      subject: '?s',
      predicate: '?p',
      object: '?o'
    }
    // retreive all graph before rewriting the query
    const defaultGraphId = this._parent._options.defaultGraph
    const namedId = []
    this._log(defaultGraphId)
    this._log(namedId)
    const plan = this._parsedQuery
    // plan.from = { default: [ defaultGraphId ], named: namedId }
    // VERY WEIRD !!!
    plan.from = { default: [ defaultGraphId, ...namedId ], named: [] }
    this._log(`[client:${this._parent._foglet.id}] 2-Rewriting the query ${this._id}...`)
    const generator = new SparqlGenerator()
    const rewritedQuery = generator.stringify(plan)
    this._log(`[client:${this._parent._foglet.id}]`, rewritedQuery)
    const res = await this._parent._store.query(rewritedQuery)
    // console.log('Local result', res)
    await this._mergeResults(res)
    // console.log('Merged results:', this.results)
    // add property to an array to get them as we want
    this.emit(eventName, this.results)
    return Promise.resolve()
  }

  _askResults () {
    return new Promise((resolve, reject) => {
      const neighbors = this._parent._foglet.getNeighbours()
      this._log(`Asking results to ${neighbors.length} neighbors...`, this._parent._foglet.getNeighbours(Infinity))
      let receivedMessage = 0
      let timeoutReceived = 0
      let finalResult = []
      function done () {
        if ((receivedMessage + timeoutReceived) === neighbors.length) {
          resolve(finalResult)
        }
      }
      try {
        neighbors.forEach(id => {
          const jobId = uniqid()
          this._log(id, this._parent._foglet.inViewID)
          this._parent._foglet.sendUnicast(id, {
            requester: {
              fogletId: this._parent._foglet.id,
              inview: this._parent._foglet.inViewID,
              outview: this._parent._foglet.outViewID
            },
            type: 'ask-results',
            queryId: this._id,
            queryString: this._query,
            jobId
          })

          // set the timeout for unexpected network error
          let timeout = null
          if (this._parent._options.timeout) {
            timeout = setTimeout(() => {
              this.emit('timeout-' + jobId)
            }, this._parent._options.timeout)
            this.once('timeout-' + jobId, () => {
              this.removeAllListeners(jobId)
              timeoutReceived++
              done()
            })
          }

          // once we received a message for the specific task (jobId)
          this.once(jobId, (message) => {
            if (timeout !== null) {
              this.removeAllListeners('timeout-' + jobId)
              clearTimeout(timeout)
            }
            finalResult.push(message)
            receivedMessage++
            done()
          })
        })
      } catch (e) {
        reject(new Error('Please report, unexpected bug', e))
      }
    })
  }

  /**
   * Return all graphs ids for all data corresping to the triple pattern provided
   * @param  {[type]} triple [description]
   * @return {[type]}        [description]
   */
  getGraphIdsFromTriple (triple) {
    const id = this._triple2String(triple)
    if (!this._mappings.has(id)) return []
    const pattern = this._mappings.get(id)
    if (pattern.sources.size <= 0) return []
    const res = []
    pattern.sources.forEach(source => {
      res.push(this._getGraphId(pattern.id, source))
    })
    return res
  }

  /**
   * @private
   */
  _mergeResults(results) {
    return new Promise((resolve, reject) => {
      let finalResults = this._results
      // console.log('old results:', finalResults)
      if(results.length > 0){
        results.forEach(result => {
          // firstly verify that our result has the same values as ours
          let proper = true
          for(let propRes in result) {
            if (result.hasOwnProperty(propRes)) {
              if(!this._propertiesResult.includes(propRes)) {
                this.emit('error', new Error('Results do not have the same variables: expected' + this._propertiesResult.toString()))
                proper = false
              } else {
                const idValue = this._generateIdFromResult(result[propRes])
                if(!this._resultsIndex.get(propRes).has(idValue)) {
                  this._resultsIndex.get(propRes).set(idValue, result[propRes])
                } else {
                  // perhaps emit an error...
                  proper = false
                }
              }
            }
          }
          // console.log('Is my result a proper result ?', proper, result)
          if(proper) {
            // console.log('PUSH:', result)
            finalResults.push(result)
            // // if no result for the moment: add the result
            // if(finalResults.length === 0) {
            //   console.log('PUSH:', result)
            //   finalResults.push(result)
            // } else {
            //   console.log('mdr')
            //   // check if the result is already there
            //   if(this._checkResult(result)){
            //     console.log('PUSH:', result)
            //     finalResults.push(result)
            //   }
            // }
          }
        })
      }
      this._results = finalResults
      resolve()
    })
  }

  _generateIdFromResult(val) {
    return Base64.encode(val.token + val.value)
  }

  _checkResult(result) {
    // console.log('Is the result already indexed ?', result)
    let alreadyIndexed = true
    this._propertiesResult.forEach(prop => {
      const id = this._generateIdFromResult(result[prop])
      // console.log(prop, result[prop], id, this._resultsIndex.get(prop))
      if(!this._resultsIndex.get(prop).has(id)) {
        // console.log(this._resultsIndex.get(prop).get(id))
        alreadyIndexed = false
      } else {
        // console.log('property already there.')
      }
    })
    return !alreadyIndexed
  }

  _mergeExternalResults(results) {
    if(results.length > 0) {
      return results.reduce((acc, message) => acc.then(() => {
        return new Promise((resolve, reject) => {
          if(!this._mappings.has(message.requester.fogletId)){
            // create the new result mapping
            const newMapping = {
              results: message.results,
              source: message.requester
            }
            this._mappings.set(message.requester.fogletId, newMapping)
          } else {
            // update results for the given source
            this._mappings.get(message.requester.fogletId).results = message.results
          }
          // console.log(message.results)
          this._mergeResults(message.results).then(() => {
            resolve()
          }).catch(e => {
            reject(e)
          })
        })
      }), Promise.resolve()).then(() => {
        // console.log('Finished to merge external results', this.results)
        return Promise.resolve()
      }).catch(e => {
        this._log('[MergeExternalResult] Error in the system: ', e)
        console.error(e)
        return Promise.reject(e)
      })
    } else {
      return Promise.resolve()
    }
  }

  /**
   * @private
   */
  _getGraphId (tripleId, sourceId) {
    return `http://${tripleId}/${sourceId}/`
  }

  /**
   * @private
   */
  _encapsGraphId (graph, symbolStart, symbolEnd) {
    return `${symbolStart}${graph}${symbolEnd}`
  }

  /**
   * @private
   */
  _triple2String (triple) {
    return `${triple.subject}:${triple.predicate}:${triple.object}`
  }

  /**
   * @private
   */
  _tripleParsed2Triple (triple) {
    if (!triple.subject.startsWith('?') && !triple.subject.startsWith('<')) {
      triple.subject = `<${triple.subject}>`
    }
    if (!triple.predicate.startsWith('?') && !triple.predicate.startsWith('<')) {
      triple.predicate = `<${triple.predicate}>`
    }
    if (!triple.object.startsWith('?') && !triple.object.startsWith('"')) {
      triple.object = `"${triple.object}"`
    }
    return triple
  }


  _log(...args){
    if(this._options.log) debug(...args)
  }
}
