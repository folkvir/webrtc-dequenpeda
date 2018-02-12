const WRTC = require('wrtc')
const Dequenpeda = require('../webrtc-dequenpeda').Client

let client1 = createClient()
let client2 = createClient()

function createClient () {
  return new Dequenpeda({
    foglet: {
      rps: {
        options: {
          webrtc: { // add WebRTC options
            wrtc: WRTC
          }
        }
      }
    }
  })
}

client1.connection().then(() => {
  console.log(`${client1.foglet.id}`, 'Client1 connected and ready to go !')
  client2.connection().then(() => {
    console.log(`${client2.foglet.id}`, 'Client2 connected and ready to go !')
    client2.broadcast('hello ! world !')
  }).catch(e => {
    throw new Error(e)
  })
}).catch(e => {
  throw new Error(e)
})
