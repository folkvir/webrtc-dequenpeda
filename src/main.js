const FogletCore = require('foglet-core').Foglet
const lmerge = require('lodash.merge')

const DEFAULT_OPTIONS = {
  foglet: {
    rps: {
      type: 'spray-wrtc',
      options: {
        protocol: 'dequenpeda-protocol', // foglet running on the protocol foglet-example, defined for spray-wrtc
        webrtc: { // add WebRTC options
          trickle: true, // enable trickle (divide offers in multiple small offers sent by pieces)
          iceServers: [] // define iceServers in non local instance
        },
        timeout: 2 * 60 * 1000, // spray-wrtc timeout before definitively close a WebRTC connection.
        delta: 15 * 1000,   // spray-wrtc shuffle interval
        signaling: {
          address: 'http://localhost:3000/',
          // signalingAdress: 'https://signaling.herokuapp.com/', // address of the signaling server
          room: 'dequenpeda-room' // room to join
        }
      }
    }
  }
}

module.exports = class Dequenpeda {
  constructor (options) {
    this.options = lmerge(DEFAULT_OPTIONS, options)
    this.foglet = new FogletCore(this.options.foglet)
    this.foglet.share()
    this.foglet.onBroadcast((id, message) => {
      console.log(`[${this.foglet.id}] Receive: ${message}`)
    })
  }

  connection () {
    return this.foglet.connection()
  }

  broadcast (message) {
    console.log(`[${this.foglet.id}] Send: ${message}`)
    this.foglet.sendBroadcast(message)
  }
}
