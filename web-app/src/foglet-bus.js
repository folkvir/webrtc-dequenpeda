import Vue from 'vue'
import { Client } from '../../webrtc-dequenpeda'

const EventBus = new Vue({
  data: {
    foglet: undefined,
  },
  created: function () {
    this.foglet = new Client({
      defaultGraph: 'http://mypersonaldata.com/',
      timeout: 5000,
      queryType: 'normal',
      shuffleCountBeforeStart: 0,
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
            delta: 5 * 1000,   // spray-wrtc shuffle interval
            signaling: {
              address: 'http://localhost:8000/',
              // signalingAdress: 'https://signaling.herokuapp.com/', // address of the signaling server
              room: 'dequenpeda-room' // room to join
            }
          }
        }
      }
    })
  }
})

Object.defineProperties(Vue.prototype, {
  $bus: {
    get: function () {
      return EventBus
    }
  }
})