const uniqid = require('uniqid')
const EventEmitter = require('events')
const SparqlParser = require('sparqljs').Parser
const SparqlGenerator = require('sparqljs').Generator
const debug = require('debug')('query')
const Base64 = require('js-base64').Base64

module.exports = class Query extends EventEmitter {
  constructor (queryString, parent) {
    super()
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
    this._triples = this._extractTriplePattern(this._parsedQuery).map(triple => this._tripleParsed2Triple(Object.assign({}, triple)))
    this._triples.forEach(t => {
      this._mappings.set(this._triple2String(t), {id: uniqid(), triple: t, sources: new Map()})
    })
    this.on('receive', (message) => {
      debug(`[client:${this._parent._foglet.id}][Query:${this._id}] Receive: data from: ${message.owner.fogletId}`)
      this.emit(message.jobId, message)
    })
  }

  stop () {
    return this.execute('end')
  }

  async execute (eventName) {
    debug(`[client:${this._parent._foglet_id}] 1-Executing the query ${this._id}...`)
    const neighbors = this._parent._foglet.getNeighbours()
    if (neighbors.length > 0) {
      // execute after receiving triples from neighbors
      return this._askTriples().then(() => {
        return this._execute(eventName)
      })
    } else {
      // execute only on my data
      return this._execute(eventName)
    }
  }

  async _execute (eventName) {
    debug(`[client:${this._parent._foglet.id}] 2-Executing the query ${this._id}...`)
    const pattern = {
      subject: '?s',
      predicate: '?p',
      object: '?o'
    }
    // retreive all graph before rewriting the query
    const defaultGraphId = this._parent._options.defaultGraph
    const namedId = []
    for (let triple of this._mappings) {
      const value = triple[1]
      value.sources.forEach(source => {
        namedId.push(`${this._getGraphId(value.id, source.fogletId)}`)
      })
    }
    debug(defaultGraphId)
    debug(namedId)
    const plan = this._parsedQuery
    // plan.from = { default: [ defaultGraphId ], named: namedId }

    // VERY WEIRD !!!
    plan.from = { default: [ defaultGraphId, ...namedId ], named: [] }
    debug(`[client:${this._parent._foglet.id}] 2-Rewriting the query ${this._id}...`)
    const generator = new SparqlGenerator()
    const rewritedQuery = generator.stringify(plan)
    debug(`[client:${this._parent._foglet.id}]`, rewritedQuery)
    const res = await this._parent._store.query(rewritedQuery)
    this.emit(eventName, res)
    return Promise.resolve()
  }

  _askTriples () {
    return new Promise((resolve, reject) => {
      const neighbors = this._parent._foglet.getNeighbours()
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
          debug(id, this._parent._foglet.inViewID)
          this._parent._foglet.sendUnicast(id, {
            requester: {
              fogletId: this._parent._foglet.id,
              inview: this._parent._foglet.inViewID,
              outview: this._parent._foglet.outViewID
            },
            type: 'ask-triples',
            query: this._id,
            prefixes: [],
            triples: this._triples,
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
            let owner = message.owner
            let data = message.triples
            data.reduce((accData, elem) => accData.then(() => {
              return new Promise((resolveData) => {
                if (elem.data.length > 0) {
                  // save the mapping between the triple and the owner
                  const originalTriple = this._mappings.get(this._triple2String(elem.triple))
                  originalTriple.sources.set(owner.fogletId, owner)
                  // store data corresponding to the triple and owner in the rdfstore
                  const graphId = this._encapsGraphId(this._getGraphId(originalTriple.id, owner.fogletId), '<', '>')
                  debug('New graphId generated', graphId)
                  elem.data.reduce((acc, triple) => acc.then(res => {
                    return this._parent._store.loadData(graphId, [], triple)
                  }), Promise.resolve()).then(() => {
                    resolveData()
                  }).catch(e => {
                    console.error(e)
                    // resolve on error ...
                    resolveData()
                  })
                } else {
                  resolveData()
                }
              })
            }), Promise.resolve()).then(() => {
              receivedMessage++
              done()
            }).catch(e => {
              console.error(e)
              receivedMessage++
              done()
            })
          })
        })
      } catch (e) {
        reject(new Error('Please report, unexpected bug', e))
      }
    })
  }

  /**
   * @private
   * Extract all triples from the parsed query
   * @param  {Object} parsedQuery parsed query using sparqljs
   * @return {Array}             Array of all triple patterns
   */
  _extractTriplePattern (parsedQuery) {
    const extract = (whereClause) => {
      const extractBis = (object) => {
        if (object.type === 'union' || object.type === 'group' || object.type === 'optional') {
          // console.log('Recursive call: ', object.type);
          return object.patterns.map(p => extractBis(p)).reduce((acc, cur) => { acc += cur }, 0)
        } else if (object.type === 'bgp') {
          // console.log('Found a bgp: ', object.type);
          return object.triples
        } else if (object.type === 'filter') {
          // console.log('Found a filter: ', object.type);
          return []
        } else {
          throw new Error(`Unknown type in the query object.type found: ${object.type}`)
        }
      }
      const mappedClauses = whereClause.map(obj => extractBis(obj))
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
}
