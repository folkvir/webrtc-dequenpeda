const EventEmitter = require('events')

module.exports = class Profile extends EventEmitter {
  constructor(options) {
    super()
    this._options = options
    this._profile = new Map()
  }

  export () {
    return [ ...this._profile.values() ]
  }

  update(triple) {
    const insertTriple = this._wildcard(Object.assign({}, triple))
    const key = this._tripleToString(insertTriple)
    if(!this._profile.has(key)) {
      this._profile.set(key, triple)
    }
  }

  remove(triple) {
    const removeTriple = this._wildcard(Object.assign({}, triple))
    const key = this._tripleToString(removeTriple)
    if(!this._profile.has(key)) {
      this._profile.delete(key)
    }
  }

  sendEvent(event) {
    this.emit(event)
  }

  _wildcard(triple) {
    if (triple.subject.startsWith('?')) {
      triple.subject = '_'
    }
    if (triple.predicate.startsWith('?') ) {
      triple.predicate = '_'
    }
    if (triple.object.startsWith('?')) {
      triple.object = '_'
    }
    return triple
  }

  _tripleToString(triple) {
    return triple.subject+triple.predicate+triple.subject
  }
}
