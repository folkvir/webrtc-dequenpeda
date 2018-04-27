const Rdfstore = require('rdfstore')
const EventEmitter = require('events')

module.exports = class Store {
  constructor (options) {
    this._options = options
    this._events = new EventEmitter()
    this._storeReady = false
    Rdfstore.Store.yieldFrequency(200);
    Rdfstore.create((err, store) => {
      if (err) throw new Error(err)
      // the new store is ready
      this._rdfstore = store
      this._storeReady = true
      this._events.emit('ready')
    })
  }
  get rdfstore () {
    if (this._storeReady) return this._rdfstore
    throw new Error('store is not ready yet.')
  }

  query (query) {
    return new Promise((resolve, reject) => {
      try {
        this.rdfstore.execute(query, (err, res) => {
          if (err) reject(err)
          resolve(res)
        })
      } catch (e) {
        reject(e)
      }
    })
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
        console.log(e)
        reject(e)
      }
    })
  }

  loadData (graph, prefixes = [], triple) {
    return new Promise((resolve, reject) => {
      if (prefixes.length > 0) {
        this.loadPrefixes(prefixes).then(() => {
          this._insertData(graph, triple).then((res) => {
            // console.log('Triple inserted: ', triple)
            resolve(res)
          }).catch(e => {
            console.log(e)
            resolve()
          })
        }).catch(e => {
          console.log(e)
          reject(e)
        })
      } else {
        this._insertData(graph, triple).then((res) => {
          // console.log('Triple inserted: ', triple)
          resolve(res)
        }).catch(e => {
          console.log(e)
          resolve()
        })
      }
    })
  }

  loadDataAsTurtle(file, graph) {
    // loading local data
    return new Promise((resolve, reject) => {
      try {
        this.rdfstore.load("text/turtle", file, graph, function(err) {
          if(err) {
            console.log(err)
            reject(err)
          }
          resolve()
        })
      } catch (e) {
        console.log(e)
        reject(e)
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
            console.log(e)
            reject(e)
          })
        }).catch(e => {
          console.log(e)
          reject(e)
        })
      } else {
        this._constructData(graph, pattern).then((...args) => {
          resolve(...args)
        }).catch(e => {
          console.log(e)
          reject(e)
        })
      }
    })
  }

  _constructData (graph, pattern) {
    return new Promise((resolve, reject) => {
      const query = `CONSTRUCT { ${pattern.subject} ${pattern.predicate} ${pattern.object} } WHERE { GRAPH ${graph} { ${pattern.subject} ${pattern.predicate} ${pattern.object} } }`
      try {
        this.rdfstore.execute(query, (err, results) => {
          if (err) reject(new Error(err))
          results = results.triples.map(elem => this.rdfstore.rdf.createTriple(elem.subject.toNT(), elem.predicate.toNT(), elem.object.toNT()))
          resolve(results)
        })
      } catch (e) {
        console.log(query)
        console.log(e)
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
          console.log(query)
          console.log(e)
          reject(e)
        }
      } catch (e) {
        console.log(e)
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
