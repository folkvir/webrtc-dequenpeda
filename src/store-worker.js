const Worker = require('tiny-worker')
const Events = require('events')
const uniqid = require('uniqid')

module.exports = class StoreWorker extends Events {
  constructor(options) {
    super()
    this._events = new Events()
    this.worker = new Worker(function (){
      const store = new (require('../../../src/store'))()
      store._events.on('ready', () => {
        self.postMessage({ type: 'ready' })
      })
      self.onmessage = function (ev) {
        handlemessage(ev.data)
      };
      function handlemessage(ev) {
        const response = {
          id: ev.id,
          data: {error: undefined, data: undefined},
        }
        const type = ev.type
        if(type === 'ping') {
          response.data.data = 'pong'
          self.postMessage(response)
        } else if (type === 'query') {
          store.query(ev.query).then((res) => {
            response.data.data = res
            self.postMessage(response)
          }).catch(e => {
            response.data.error = e
            self.postMessage(response)
          })
        } else if (type === 'loadPrefixes') {
          store.loadPrefixes(ev.prefixes).then((res) => {
            response.data.data = res
            self.postMessage(response)
          }).catch(e => {
            response.data.error = e
            self.postMessage(response)
          })
        } else if (type === 'loadData') {
          store.loadData(ev.graph, ev.prefixes, ev.pattern).then((res) => {
            response.data.data = res
            self.postMessage(response)
          }).catch(e => {
            response.data.error = e
            self.postMessage(response)
          })
        } else if (type === 'loadDataAsTurtle') {
          store.loadDataAsTurtle(ev.file, ev.graph).then((res) => {
            response.data.data = res
            self.postMessage(response)
          }).catch(e => {
            response.data.error = e
            self.postMessage(response)
          })
        } else if (type === 'getTriples') {
          store.getTriples(ev.graph, ev.prefixes, ev.pattern).then((res) => {
            response.data.data = res
            self.postMessage(response)
          }).catch(e => {
            response.data.error = e
            self.postMessage(response)
          })
        } else if (type === '_constructData') {
          store._constructData(ev.graph, ev.pattern).then((res) => {
            response.data.data = res
            self.postMessage(response)
          }).catch(e => {
            response.data.error = e
            self.postMessage(response)
          })
        } else if (type === '_insertData') {
          store._insertData(ev.graph, ev.triple).then((res) => {
            response.data.data = res
            self.postMessage(response)
          }).catch(e => {
            response.data.error = e
            self.postMessage(response)
          })
        }
      }
    })
    this.worker.onmessage = (ev) => {
      this.handlemessage(ev)
    }
  }

  handlemessage(ev) {
    const data = ev.data
    this._events.emit(data.id, data.data)
  }

  close() {
    this.worker.terminate()
  }

  _send(data) {
    this.worker.postMessage(data)
  }

  ping(...args) {
    return new Promise((resolve, reject) => {
      const id = uniqid()
      this.worker.postMessage({
        type: 'ping',
        id
      })
      this._events.once(id, (res) => {
        if(res.error) reject(Error(res.error))
        resolve(res)
      })
    })
  }

  query (query) {
    return new Promise((resolve, reject) => {
      const id = uniqid()
      this._send({ type: 'query', query, id})
      this._events.once(id, (res) => {
        if(res.error) reject(Error(res.error))
        resolve(res.data)
      })
    })
  }

  loadPrefixes (prefixes = []) {
    return new Promise((resolve, reject) => {
      const id = uniqid()
      this._send({ type: 'loadPrefixes', id, prefixes})
      this._events.once(id, (res) => {
        if(res.error) reject(Error(res.error))
        resolve(res.data)
      })
    })
  }

  loadData (graph, prefixes = [], triple) {
    return new Promise((resolve, reject) => {
      const id = uniqid()
      this._send({ type: 'loadData', id, graph, prefixes, triple})
      this._events.once(id, (res) => {
        if(res.error) reject(Error(res.error))
        resolve(res.data)
      })
    })
  }

  loadDataAsTurtle(file, graph) {
    // loading local data
    return new Promise((resolve, reject) => {
      const id = uniqid()
      this._send({ type: 'loadDataAsTurtle', id, file, graph})
      this._events.once(id, (res) => {
        if(res.error) reject(Error(res.error))
        resolve(res.data)
      })
    })
  }

  getTriples (graph, prefixes = [], pattern) {
    return new Promise((resolve, reject) => {
      const id = uniqid()
      this._send({ type: 'getTriples', id, graph, prefixes, pattern})
      this._events.once(id, (res) => {
        if(res.error) reject(Error(res.error))
        resolve(res.data)
      })
    })
  }

  _constructData (graph, pattern) {
    return new Promise((resolve, reject) => {
      const id = uniqid()
      this._send({ type: '_constructData', id, graph, pattern})
      this._events.once(id, (res) => {
        if(res.error) reject(Error(res.error))
        resolve(res.data)
      })
    })
  }

  _insertData (graph, triple) {
    return new Promise((resolve, reject) => {
      const id = uniqid()
      this._send({ type: '_constructData', id, graph, triple})
      this._events.once(id, (res) => {
        if(res.error) reject(Error(res.error))
        resolve(res.data)
      })
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
