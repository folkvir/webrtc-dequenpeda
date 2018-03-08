const debug = require('debug')('main:broadcast-handlers')
const QueryShared = require('../queries/query-shared')

function _handleNewSharedQuery(id, message) {
  debug(`[client:${this._foglet._id}]`, ` Received a shared query: ${message}`)
  if (this._queries.has(message.id)) {
    throw new Error('This query is already instanciated, Please report.')
  } else {
    const query = new QueryShared(message.query, this, {shared: false})
    this._queries.set(query._id, query)
    this.emit('new-external-query', query._id)
    query.execute('loaded').then(() => {
      // noop
    }).catch(e => {
      console.error(e)
    })
  }
}

function _handleDeleteSharedQuery(id, message) {
  debug(`[client:${this._foglet._id}]`, ` Received a delete order, shared query: ${message}`)
  if (this._queries.has(message.id)) {
    // delete it
    this._queries.delete(message.id)
  }
}

module.exports = {
  _handleNewSharedQuery,
  _handleDeleteSharedQuery
}