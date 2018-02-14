const Rdfstore = require('rdfstore')
const EventEmitter = require('events')

module.exports = class Store {
  constructor (options) {
    this._options = options
    this._events = new EventEmitter()
    this._storeReady = false
    Rdfstore.create((err, store) => {
      if (err) throw new Error(err)
      // the new store is ready
      this._rdfstore = store
      this._storeReady = true
      // console.log('The store is ready')
      this._events.emit('ready')
    })
  }
  get rdfstore () {
    if (this._storeReady) return this._rdfstore
    throw new Error('store is not ready yet.')
  }

  loadPrefixes (prefixes = []) {
    return new Promise((resolve, reject) => {
      try {
        prefixes.forEach(prefix => {
          const isPrefix = this._isPrefix(prefix)
          if (!isPrefix) reject(new Error('This is not a correct prefix: ', prefix))
          this.rdfstore.addPrefix(prefix.name, prefix.uri)
        })
      } catch (e) {
        reject(e)
      }
    })
  }

  loadData (graph, prefixes = [], triple) {
    return new Promise((resolve, reject) => {
      if (prefixes.length > 0) {
        this.loadPrefixes(prefixes).then(() => {
          this._insertData(graph, triple).then((res) => {
            // console.log('loadData finished')
            resolve(res)
          }).catch(e => {
            console.log(e)
            resolve()
          })
        }).catch(e => {
          reject(e)
        })
      } else {
        this._insertData(graph, triple).then((res) => {
          // console.log('loadData finished')
          resolve(res)
        }).catch(e => {
          console.log(e)
          resolve()
        })
      }
    })
  }

  getTriples (graph, prefixes = [], pattern) {
    return new Promise((resolve, reject) => {
      if (!this._isTriple(pattern)) reject(new Error('The pattern is not a triple object: {subject: ..., predicate: ..., object: ...}'))
      if (prefixes.length > 0) {
        this.loadPrefixes(prefixes).then(() => {
          this._constructData(graph, pattern).then((...args) => {
            resolve(...args)
          }).catch(e => {
            reject(e)
          })
        }).catch(e => {
          reject(e)
        })
      } else {
        this._constructData(graph, pattern).then((...args) => {
          resolve(...args)
        }).catch(e => {
          reject(e)
        })
      }
    })
  }

  _constructData (graph, pattern) {
    return new Promise((resolve, reject) => {
      try {
        const query = `CONSTRUCT { ${pattern.subject} ${pattern.predicate} ${pattern.object} } WHERE { GRAPH ${graph} { ${pattern.subject} ${pattern.predicate} ${pattern.object} } }`
        this.rdfstore.execute(query, (err, results) => {
          if (err) reject(new Error(err))
          results = results.triples.map(elem => this.rdfstore.rdf.createTriple(elem.subject.toNT(), elem.predicate.toNT(), elem.object.toNT()))
          resolve(results)
        })
      } catch (e) {
        reject(e)
      }
    })
  }

  _insertData (graph, triple) {
    return new Promise((resolve, reject) => {
      try {
        const query = `INSERT DATA { GRAPH ${graph} { ${triple.subject} ${triple.predicate} ${triple.object} } }`
        try {
          this.rdfstore.execute(query, function (err) {
            if (err) reject(new Error(err))
            // console.log('Triple inserted')
            resolve()
          })
        } catch (e) {
          reject(e)
        }
      } catch (e) {
        reject(e)
      }
    })
  }

  _isTriple (triple) {
    if (!triple) return false
    if (!triple.subject || !triple.predicate || !triple.object) return false
    return true
  }

  _isPrefix (prefix) {
    if (!prefix) return false
    if (!prefix.name || !prefix.uri) return false
    if (prefix.name === undefined || prefix.uri === undefined) return false
    if (prefix.name === null || prefix.uri === null) return false
    return true
  }
}
