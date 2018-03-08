const LRU = require('lru-cache')
const lmerge = require('lodash.merge')

module.exports = class Cache {
  constructor (options) {
    this.options = lmerge({
      prune: false,
      lru: {
        max: Infinity,
        maxAge: 5 * 60 * 1000
      },
      logger: function (...args) {
        console.log(...args)
      }
    }, options)

    this.cache = new LRU(this.options.lru)

    if (this.options.prune) {
      this.interval = setInterval(() => {
        this.cache.prune()
        this.log('We pruned old entries. Cache size: ', this.cache.length)
      }, this.options.lru.maxAge)
    }
  }

  get (...args) {
    return this.cache.get(...args)
  }

  set (key, elem) {
    return this.cache.set(key, elem)
  }

  delete (key) {
    return this.cache.del(key)
  }

  exist (key) {
    return this.cache.has(key)
  }

  log (...args) {
    this.options.logger(...args)
  }
}
