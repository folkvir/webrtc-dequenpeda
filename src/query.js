const uniqid = require('uniqid')
const lmerge = require('lodash.merge')
const EventEmitter = require('events')
const SparqlParser = require('sparqljs').Parser
const SparqlGenerator = require('sparqljs').Generator
const debug = require('debug')('dequenpeda:query')
const Base64 = require('js-base64').Base64
const ArrayIterator = require('asynciterator').ArrayIterator
const N3 = require('n3')

const DEFAULT_QUERY_OPTIONS = {
  timeout: 5 * 60 * 1000
}

module.exports = class Query extends EventEmitter {
  constructor (queryString, parent, options) {
    super()
    if(!queryString || queryString === null || queryString === '') throw new Error('The query has to be different of undefined, null or empty string')
    this._options = lmerge(DEFAULT_QUERY_OPTIONS, options)
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
    this._sources = new Map()
    this._properTriples = this._extractTriplePattern(this._parsedQuery).map(triple => Object.assign({}, triple))
    this._triples = this._properTriples.map(triple => this._tripleParsed2Triple(Object.assign({}, triple)))
    // this._triples = this._properTriples
    this._triples.forEach(t => {
      this._parent._profile.update(t)
      this._mappings.set(this._triple2String(t), {id: uniqid(), triple: t, sources: new Map()})
    })

    //console.log(this._triples, this._properTriples)
    this.on('receive', (message) => {
      debug(`[client:${this._parent._foglet._id}] Receive: data from: ${message.owner.fogletId}`)
      this.emit(message.jobId, message)
    })
    this._timeout = undefined
    this._lastResults = undefined
  }

  stop () {
    return this.execute('end')
  }

  async execute (eventName) {
    if(eventName === 'end') {
      this.emit(eventName, this._lastResults)
      return Promise.resolve(this._lastResults)
    }
    this._createTimeout()
    // debug(`[client:${this._parent._foglet.id}] 1-Executing the query ${this._id}...`)
    const neighbors = this._parent._foglet.getNeighbours()
    if (neighbors.length > 0) {
      // execute after receiving triples from neighbors
      return this._askTriples().then(() => {
        return this._execute(eventName).then(() => {
          return Promise.resolve()
        }).catch(e => {
          console.log(e)
          return Promise.reject(e)
        })
      }).catch(e => {
        console.log('error when asking triples: ', e)
        return Promise.reject(e)
      })
    } else {
      // execute only on my data
      return this._execute(eventName).then(() => {
        debug('Query executed')
        return Promise.resolve()
      }).catch(e => {
        console.log(e)
        return Promise.reject(e)
      })
    }
  }

  async _execute (eventName) {

    const pattern = {
      subject: '?s',
      predicate: '?p',
      object: '?o'
    }
    // retreive all graph before rewriting the query
    const defaultGraphId = this._parent._options.defaultGraph
    // const namedId = []
    // for (let triple of this._mappings) {
    //   const value = triple[1]
    //   value.sources.forEach(source => {
    //     namedId.push(`${this._getGraphId(value.id, source.fogletId)}`)
    //   })
    // }
    const plan = this._parsedQuery

    plan.from = { default: [ defaultGraphId ], named: [] }
    // debug(`[client:${this._parent._foglet.id}] 2-Rewriting the query ${this._id}...`)
    const generator = new SparqlGenerator()
    const rewritedQuery = generator.stringify(plan)
    debug(`[client:${this._parent._foglet.id}] Executing the query: `, rewritedQuery)
    //console.log(this._query, rewritedQuery)
    this._rewritedQuery = rewritedQuery
    const res = await this._parent._store.query(rewritedQuery)
    debug(`[client:${this._parent._foglet.id}] Number remote peers seen:`, this._sources.size)
    this._lastResults = res
    this.emit(eventName, res)
    return Promise.resolve()
  }

  _askTriples () {
    return new Promise((resolve, reject) => {
      const neighbors = this._parent._foglet.getNeighbours()
      let neighborsSon = []
      let max = neighbors.length
      if(this._parent._options.activeSon) {
        neighborsSon = this._parent._foglet.overlay('son').network.getNeighbours()
        max += neighborsSon.length
      }
      let receivedMessage = 0
      let timeoutReceived = 0
      let responses = []
      const done = (resp) => {
        if(resp) {
          responses.push(resp)
          receivedMessage++
        } else {
          timeoutReceived++
        }
        if ((receivedMessage + timeoutReceived) === (max)) {
          this._processResponses(responses).then(() => {
            resolve()
          }).catch(e => {
            console.log(e)
            debug('Error during processing responses.:', e)
            resolve()
          })
        }
      }

      try {
        if(this._parent._options.activeSon) {
          neighborsSon.forEach(id => {
            if(this._parent._foglet.overlay('son').network.getNeighbours(Infinity).includes(id)) {
              this._askTriplesBis(id, true).then((resp) => {
                done(resp)
              }).catch(e => {
                console.log(e)
                done()
              })
            } else {
              done()
            }
          })
        }
        neighbors.forEach(id => {
          if(this._parent._foglet.getNeighbours(Infinity).includes(id)) {
            this._askTriplesBis(id, false).then((resp) => {
              done(resp)
            }).catch(e => {
              console.log(e)
              done()
            })
          } else {
            done()
          }

        })
      } catch (e) {
        reject(new Error('Please report, unexpected bug', e))
      }
    })
  }

  _askTriplesBis(id, overlay = false) {
    return new Promise((resolve, reject) => {
      const jobId = uniqid()
      debug(id, this._parent._foglet.inViewID)
      try {
        const msg = {
          shuffleBegin: this._parent._shuffleCount,
          requester: {
            overlay,
            fogletId: this._parent._foglet.id,
            inview: this._parent._foglet.inViewID,
            outview: this._parent._foglet.outViewID
          },
          type: 'ask-triples',
          query: this._id,
          prefixes: [],
          triples: this._triples,
          jobId
        }
        if(overlay) {
          this._parent._statistics.message++
          this._parent._foglet.overlay('son').communication.sendUnicast(id, msg).then(() => {
            //
          }).catch(e => {
            console.log(new Error('Eror during sending ask_triples on the overlay to:'+id, e))
          })
        } else {
          this._parent._statistics.message++
          this._parent._foglet.sendUnicast(id, msg).then(() => {
            //
          }).catch(e => {
            console.log(new Error('Eror during sending ask_triples to:'+id, e))
          })
        }
      } catch (e) {
        console.log(e)
      }

      // set the timeout for unexpected network error
      let timeout = null
      if (this._parent._options.timeout) {
        timeout = setTimeout(() => {
          this.emit('timeout-' + jobId)
        }, this._parent._options.timeout)
        this.once('timeout-' + jobId, () => {
          this.removeAllListeners(jobId)
          resolve()
        })
      }

      // once we received a message for the specific task (jobId)
      this.once(jobId, (message) => {
        if (timeout !== null) {
          this.removeAllListeners('timeout-' + jobId)
          clearTimeout(timeout)
        }
        resolve(message)
      })
    })
  }

  _processResponses (responses) {
    this._parent.once("periodic-execution-begins", () => {
      console.log('Verified.')
      if(responses[0].shuffleBegin < this._parent._shuffleCount) throw new Error('another shuffle arrive before we terminate the previous execution....')
    })
    // debug('Sequential processing of received triples: beginning')
    return new Promise((resolve, reject) => {
      responses.reduce((respAcc, resp) => respAcc.then(() => {
        let owner = resp.owner
        if(!this._sources.has(owner.fogletId)) {
          this._sources.set(owner.fogletId, owner)
          debug(`Adding a new source: `, owner.fogletId)
        }
        let data = resp.triples
        return data.reduce((accData, elem) => accData.then(() => {
          return new Promise((resolveData) => {
            if (elem.data.length > 0) {
              // save the mapping between the triple and the owner
              const key = this._triple2String(elem.triple)
              const originalTriple = this._mappings.get(key)
              originalTriple.sources.set(owner.fogletId, owner)
              let graphId = this._encapsGraphId(this._parent._options.defaultGraph, '<', '>')
              let string = ""
              for(let i = 0; i<elem.data; ++i) {
                string += elem.data[i].subject + " " + elem.data[i].predicate + " " + elem.data[i].object + " . \n"
              }
              this._parent._store.loadDataAsTurtle(string, graphId).then(() => {
                resolveData()
              }).catch(e => {
                console.log(e)
                resolveData()
              })
            } else {
              resolveData()
            }
          })
        }), Promise.resolve())
      }), Promise.resolve()).then(() => {
        // debug('Sequential processing of received triples: finished')
        resolve()
      }).catch(e => {
        reject(e)
      })
    })
  }

  /**
   * @private
   * Extract all triples from the parsed query
   * @param  {Object} parsedQuery parsed query using sparqljs
   * @return {Array}             Array of all triple patterns
   */
  _extractTriplePattern (parsedQuery) {
    //console.log(parsedQuery)
    const extract = (whereClause) => {
      const extractBis = (object) => {
        if (object.type === 'union' || object.type === 'group' || object.type === 'optional' || object.type === 'graph') {
          //console.log('Recursive call: ', object.patterns);
          return object.patterns.map(p => extractBis(p)).reduce((acc, cur) => {
            //console.log('reduce: cur', cur, 'reduce acc:', acc)
            acc.push(...cur)
            return [...acc]
          }, [])
        } else if (object.type === 'bgp') {
          //console.log('Found a bgp: ', object.type);
          return object.triples
        } else if (object.type === 'filter') {
          // console.log('Found a filter: ', object.type);
          return []
        } else {
          throw new Error(`Unknown type in the query object.type found: ${object.type}`)
        }
      }
      const mappedClauses = whereClause.map(obj => extractBis(obj))
      //console.log(mappedClauses)
      if (mappedClauses.length > 0) {
        const res = mappedClauses.reduce((acc, cur) => { acc.push(...cur); return acc }, [])
        return res
      } else {
        return []
      }
    }
    return extract(parsedQuery.where)
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
  _getGraphId (tripleId, sourceId) {
    return `http://${tripleId}/${sourceId}/`
  }

  _encapsGraphId (graph, symbolStart, symbolEnd) {
    return `${symbolStart}${graph}${symbolEnd}`
  }

  /**
   * @private
   */
  _triple2String (triple) {
    return `${triple.subject}:${triple.predicate}:${triple.object}`
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

  _createTimeout() {
    if(!this._timeout) {
      debug(`[client:${this._parent._foglet.id}][Query:${this._id}] Timeout creation: ${this._options.timeout}`)
      this._timeout = setTimeout(() => {
        debug(`[client:${this._parent._foglet.id}][Query:${this._id}] Query has TIMEDOUT: ${this._options.timeout}`)
        this.stop()
      }, this._options.timeout)
    }
  }
}
