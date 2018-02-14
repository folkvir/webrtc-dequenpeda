const uniqid = require('uniqid')
const EventEmitter = require('events')
const SparqlParser = require('sparqljs').Parser
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
    } catch (e) {
      throw new Error('An error occured during the parsing of the query:', queryString)
    }
    // store any client id for any triple pattern received
    this._mappings = new Map()
    this._triples = this._extractTriplePattern(this._parsedQuery).map(triple => this._tripleParsed2Triple(triple))
    this._triples.forEach(t => {
      this._mappings.set(this._triple2String(t), {id: uniqid(), sources: new Map()})
    })
    this.on('receive', (message) => {
      debug(`[client:${this._parent._foglet_id}][Query:${this._id}] Receive: `, message)
    })
  }

  async execute () {
    debug(`[client:${this._parent._foglet_id}] executing query ${this._id}...`)
    const neighbors = this._parent._foglet.getNeighbours()
    const data = []
    const pattern = {
      subject: '?s',
      predicate: '?p',
      object: '?o'
    }
    const myData = await this._parent._store.getTriples(this._parent._options.defaultGraph, [], pattern)
    data.push(myData)
    if (neighbors.length > 0) {
      neighbors.forEach(id => {
        debug(id, this._parent._foglet.inViewID)
        this._parent._foglet.sendUnicast(id, {
          requester: {
            inview: this._parent._foglet.inViewID,
            outview: this._parent._foglet.outViewID
          },
          type: 'ask-triples',
          query: this._id,
          prefixes: [],
          triples: this._triples
        })
      })
    }
    return this._execute(data)
  }

  async _execute () {

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
      console.log('Beggining of the extraction...')
      const mappedClauses = whereClause.map(obj => extractBis(obj))
      if (mappedClauses.length > 0) {
        const res = mappedClauses.reduce((acc, cur) => { acc.push(...cur); return acc }, [])
        debug(`[client:${this._parent._foglet_id}]`, 'Number of triples counted: ', res.length)
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
