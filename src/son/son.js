/* eslint no-eval: 0 */
const TMan = require('./fc-abstract-son')
const Communication = require('foglet-core').communication
const lmerge = require('lodash.merge')
const serialize = require('serialize-javascript')
const deserialize = (msg) => eval('(' + msg + ')')
const similarity = require('./similarity-tpq').compare
const debug = require('debug')('dequenpeda:son')
const lrandom = require('lodash.random')

module.exports = class Son extends TMan {
  constructor (manager, options) {
    options = lmerge({
      profile: undefined,
      delta: 10 * 1000,
      timeoutDescriptor: 5 * 1000,
      periodicProfileExchange: 5 * 1000,
      partialViewSize: 5,
      sample: 5,
      chunkSize: 512,
      encode: serialize,
      decode: deserialize
    }, options)
    super(manager, options)
    // fix error when replying if the peer does not exists
    this._rps.unicast.removeAllListeners('requestDescriptor')
    this._rps.unicast.on('requestDescriptor', (requester) => {
      if(this._rps.parent.getPeers(Infinity).includes(requester)) {
        this._rps.unicast.emit('giveDescriptor', requester, this._rps.getInviewId(), this._rps.options.descriptor).catch((e) => {
          console.log(requester, this._rps.getInviewId(), this._rps.options.descriptor)
          console.log(e)
        })
      }
    })
    // set the size of the partialView
    this.rps._partialViewSize = () => this.options.partialViewSize
    // set the sample size to size of the partial view ad minima
    this.rps._sampleSize = (flatten) => Math.min(flatten.length, this.options.sample)
    // internal communications
    this.communication = new Communication(this, this.options.procotol + '-internal')
    this.communication.onStreamUnicast((id, stream) => {
      let message = ''
      stream.on('data', (data) => { message += data })
      stream.on('end', () => {
        message = this.options.decode(message)
        debug(`Receive a stream from${id}`, message)
        if (message.type === 'update-descriptor') this._updateDescriptor(message.id, message.descriptor)
      })
    })

    if (this.rps.parent) {
      // this.rps.parent.on('open', () => {
      //   this.rps._start()
      // })
      this.communicationParent = new Communication(this.options.manager._rps.network, this.options.procotol + '-parent-internal')
      this.communicationParent.onStreamUnicast((id, stream) => {
        let message = ''
        stream.on('data', (data) => { message += data })
        stream.on('end', () => {
          message = this.options.decode(message)
          debug(`Receive a stream from parent ${id}`, message)
          if (message.type === 'update-descriptor') this._updateDescriptor(message.id, message.descriptor)
        })
      })
    }
  }

  /**
   * Send a streamed message over current communication channel to the specified peer id
   * @param {*} id
   * @param {*} message
   */
  _sendMessage (id, message) {
    message = this.options.encode(message)
    const chunks = this.chunkify(message)
    const stream = this.communication.streamUnicast(id)
    chunks.forEach(chunk => stream.write(chunk))
    stream.end()
  }

  /**
   * Send a streamed message over current parent communication channel to the specified peer id
   * @param {*} id
   * @param {*} message
   */
  _sendMessageParent (id, message) {
    message = this.options.encode(message)
    const chunks = this.chunkify(message)
    const stream = this.communicationParent.streamUnicast(id)
    chunks.forEach(chunk => stream.write(chunk))
    stream.end()
  }

  /**
   * Update the descriptor for the id in the cache or in the partialview
   * @param  {string} id         id of the descriptor owner
   * @param  {object} descriptor Descriptor of the peer identified by its id
   * @return {void}
   */
  _updateDescriptor (id, descriptor) {
    debug('Update descriptor: ', id, descriptor)
    if (!this.rps.cache.has(id)) {
      this.rps.cache.add(id, descriptor)
    } else {
      this.rps.cache.set(id, descriptor)
    }
    if (this.rps.partialView.has(id)) {
      this.rps.partialView.updateNeighbor(id, descriptor)
    }
  }

  /**
   * Create the descriptor at first step
   * @return {[type]} [description]
   */
  _startDescriptor () {
    this.interval = setInterval(() => {
      this.options.profile.sendEvent('export')
      // update our descriptor according to our web history
      let neigh = this.getNeighbours()
      debug('Direct tman neighbours: ', neigh)
      neigh.forEach(peer => {
        if (!neigh.includes(this.inviewId)) {
          this._sendMessage(peer, {
            id: this.inviewId,
            type: 'update-descriptor',
            descriptor: this.descriptor
          })
        }
      })
      if (this.rps.parent) {
        let parentNeigh = this.options.manager._rps.network.getNeighbours()
        debug('Direct parent tman neighbours: ', parentNeigh)
        parentNeigh.forEach(peer => {
          if (!neigh.includes(peer) && !neigh.includes(this.inviewId) && !parentNeigh.includes(this.inviewId)) {
            // send our descriptor to all parent neighbours for update
            this._sendMessageParent(peer, {
              id: this.inviewId,
              type: 'update-descriptor',
              descriptor: this.descriptor
            })
          }
        })
      }
    }, this.options.periodicProfileExchange)

    // configure the profile
    let profile = this.options.profile
    profile.on('export', () => {
      this.descriptor.profile = profile.export()
    })
    return { profile: profile.export() }
  }

  /**
   * Ranking method applied on descriptor A and B for the descriptor Neighbours
   * @param  {[type]} neighbours  Descriptor on which we based our ranking
   * @param  {[type]} descriptorA Ranking descriptor A
   * @param  {[type]} descriptorB Ranking Descriptor B
   * @return {[type]} Rank elements according to their descriptor,  we keep DescriptorA if < 0, Descriptor B if > 0, none if === 0
   */
  _rankPeers (neighbours, descriptorA, descriptorB) {
    const ownProfile = neighbours.descriptor.profile
    const simA = similarity(ownProfile, descriptorA.profile)
    const simB = similarity(ownProfile, descriptorB.profile)
    const res = simB - simA
    if(res === 0) {
      // random choice between A and B
      if(lrandom(1) === 0) {
        return 1 // means A
      } else {
        return -1 // means B
      }
    }
    return res
  }

  /**
   * Getter: the Descriptor Timeout
   * @return {[type]} [description]
   */
  _descriptorTimeout () {
    return this.options.timeoutDescriptor
  }

  /**
   * Chunk a string into n message of size 'chunkSize'
   * @param {string} string
   * @param {Number=this.options.chunkSize} chunkSize
   */
  chunkify (string, chunkSize = this.options.chunkSize) {
    // https://stackoverflow.com/questions/7033639/split-large-string-in-n-size-chunks-in-javascript
    return string.match(new RegExp('.{1,' + chunkSize + '}', 'g'))
  }
}
