const debug = require('debug')('dequenpeda:unicast-handlers')
const QueryShared = require('../queries/query-shared')

function _handleAskTriples(id, message) {
  // debug(`[client:${this._foglet._id}]`, ` Someone is asking for data...`)
  message.triples.reduce((acc, triple) => acc.then(result => {
    return new Promise((resolve, reject) => {
      const defaultGraph = this._encapsGraphId(this._options.defaultGraph, '<', '>')
      this._store.getTriples(defaultGraph, message.prefixes, triple).then((res) => {
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
    try {
      if(this._foglet.getNeighbours(Infinity).includes(message.requester.outview)) {
        this._foglet.sendUnicast(message.requester.outview, {
          owner: {
            fogletId: this._foglet.id,
            inview: this._foglet.inViewID,
            outview: this._foglet.outViewID
          },
          type: 'answer-triples',
          query: message.query,
          triples: res,
          jobId: message.jobId
        })
      }
    } catch (e) {
      console.error(e)
    }
  })
}

function _handleAskResults(id, message) {
  // debug(`[client:${this._foglet._id}]`, ` Someone is asking for results...`)
  if (!this._queries.has(message.queryId)) {
    const query = new QueryShared(message.queryString, this, {shared: false})
    this._queries.set(query._id, query)
    query.execute('initiated').then(() => {
      // noop
    }).catch(e => {
      console.error(e)
    })
  }
  message.type = 'answer-ask-results'
  message.results = this._queries.get(message.queryId).results
  this._foglet.sendUnicast(message.requester.outview, message)
}

module.exports = {
  _handleAskTriples,
  _handleAskResults
}
