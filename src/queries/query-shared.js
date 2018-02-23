const uniqid = require('uniqid')
const EventEmitter = require('events')
const SparqlParser = require('sparqljs').Parser
const SparqlGenerator = require('sparqljs').Generator
const debug = require('debug')('query')

module.exports = class Query extends EventEmitter {
  constructor (queryString, parent) {
    super()
    this._parent = parent
    this._id = uniqid()
    this._query = queryString
    try {
      const parser = new SparqlParser()
      this._parsedQuery = parser.parse(this._query)
      this._lastParsedQuery = this._parsedQuery
    } catch (e) {
      throw new Error('An error occured during the parsing of the query:', queryString)
    }
    // store any client id for any triple pattern received
    this._mappings = new Map()

    this.on('receive', (message) => {
      debug(`[client:${this._parent._foglet.id}][Query:${this._id}] Receive: data from: ${message.owner.fogletId}`)
    })

    // broadcast the query
    const message = {
      type: 'new-shared-query',
      id: this._id,
      query: this._query,
      requester: {
        fogletId: this._parent._foglet.id,
        inview: this._parent._foglet.inViewID,
        outview: this._parent._foglet.outViewID
      },
      jobId: this._id
    }
    this._parent._foglet.sendBroadcast(message)
  }

  stop () {
    return this.execute('end')
  }

  async execute (eventName) {
    const execId = uniqid()
    debug(`[client:${this._parent._foglet._id}] 1-Executing the query ${this._id}...`)
    // get results from every neighbors
    const neighbors = this._parent._foglet.getNeighbours()
    if(neighbors.length > 0) {
      neighbors.forEach(id => {
        const jobId = uniqid()
        const message = {
          requester: {
            fogletId: this._parent._foglet.id,
            inview: this._parent._foglet.inViewID,
            outview: this._parent._foglet.outViewID
          },
          type: 'ask-results',
          query: this._id,
          prefixes: [],
          jobId
        }
        this._parent._foglet.sendUnicast(id, message)
      })
    }
    this.on('')
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
