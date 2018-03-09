'use strict'

const commander = require('commander')

commander
  .usage('node http-server.js <options>')
  .option('-p, --port <port>', 'Port used for the web server', (e) => parseInt(e), 8000)
  .parse(process.argv)

let port = parseInt(commander.port)

const express = require('express')
const app = express()
const http = require('http')
const cors = require('cors')
const fs = require('fs')
const path = require('path')
const io = require('socket.io')
const _ = require('lodash')
const debug = require('debug')('signaling')
const Cache = require('./signaling-http-cache.js')

app.use(cors())

app.use('/', express.static(path.join(__dirname, '/dist')))
app.use('/jquery', express.static(path.join(__dirname, '/node_modules/jquery/dist')))

app.get('/ice', function (req, res) {
  console.log('A user want ice from client:')
  fs.readFile('./twilio_config.json', 'utf-8', (err, data) => {
    console.log(data)
    if (err) throw err
    let parsed
    try {
      parsed = JSON.parse(data)
    } catch (e) {
      res.send('Error:', e.stack)
    }
    console.log(parsed)
    try {
      var client = require('twilio')(parsed.api_key, parsed.api_secret, {accountSid: parsed.sid})
      client.api.account.tokens.create({}).then(token => {
        console.log(token)
        res.send({ ice: token.iceServers })
      }).catch(error => {
        console.log(error)
      })
    } catch (e) {
      console.log(e)
      res.send('Error when getting your credentials.')
    }
  })
})

app.get('/', function (req, res) {
  res.sendFile(path.join(__dirname, '/index.html'))
})

const logger = (...args) => {
  debug(...args)
}

let httpServer = http.Server(app)
let ioServer = io(httpServer)

ioServer.origins('*:*') // for latest version
let number = 0
const time2wait = 5 * 60 * 1000

const cache = new Cache({
  prune: false, // periodically prune old message
  lru: {
    max: Infinity,
    maxAge: time2wait
  }, // lru options
  logger // logger to log all message
})

ioServer.on('connection', socket => {
  number = number + 1
  socket.on('test', () => {
    socket.emit('replytest')
  })
  socket.on('joinRoom', room => {
    logger('A user join the room : ' + room.room)
    socket.join(room.room)
    socket.emit('joinedRoom', room)
  })
  socket.on('new', data => {
    console.log(data)
    // add a peer attribute to the socket
    socket.peerId = data.offer.peer
    let room = data.room
    let offer = data.offer

    if (cache.exist(offer.tid)) {
          // if this offer already exists then send this offer to the chosen peer.
      const chosen = cache.get(offer.tid)
          // if the peer is already in connected room do nothing !
      let c = ioServer.sockets.adapter.rooms[room + '-connected'] && ioServer.sockets.adapter.rooms[room + '-connected'].sockets
      if (!_.has(c, socket.id)) {
        logger('[NEW3] TID: ', offer.tid, 'Offer from:  ', socket.peerId, ' sent to: ', chosen.dest.peerId)
        chosen.dest.emit('new_spray', offer)
      }
    } else {
      // choose a peer to send this offer
      // if there is no peer or already one peer in the room just send a 'connected' message
      let c = ioServer.sockets.adapter.rooms[room + '-connected'] && ioServer.sockets.adapter.rooms[room + '-connected'].sockets
      c = _.omit(c, socket.id)
      const cSize = Object.keys(c).length
      if (cSize === 0) {
        logger('[NEW1] TID: ', offer.tid, 'There is only one person connected in this room:  ', room, offer.peer)
        // it means there is no one connected in the room, we have to place this person into the connected room
        socket.join(room + '-connected')
        socket.leave(room)
        socket.emit('connected') // we have to warn that the client is in the network;
      } else if (cSize > 0) {
        // choose a random pper
        const randomInt = Math.floor(Math.random() * cSize) + 1
        const id = _.keys(c)[randomInt - 1]
        let sock = ioServer.sockets.connected[id]
        logger('[NEW2] TID: ', offer.tid, 'Offer from:  ', offer.peerId, ' sent to: ', sock.peer)
        sock.emit('new_spray', offer)
        cache.set(data.offer.tid, {
          key: data.offer.tid,
          sourceId: socket.peerId,
          source: socket,
          destId: sock.peerId,
          dest: sock
        })
      }
    }
  })

  socket.on('accept', data => {
    let offer = data.offer
    if (cache.exist(offer.tid)) {
      // send the accepted offer to its source if the peer is no connected
      const source = cache.get(offer.tid)
      source.source.emit('accept_spray', offer)
      logger('[ACCEPT] TID: ', offer.tid, 'Offer from: ', socket.peerId, ' sent to:', source.source.peerId, 'type:', offer.type)
    }
  })

  socket.on('connected', data => {
    const room = data.room
    logger('[CONNECTED] User ', socket.peerId, ' is now connected on the room: ' + room)
    socket.leave(room)
    socket.join(room + '-connected')
    socket.emit('connected', data)
    // can now delete the entry in the cache.
    let entry = cache.cache.values().filter(elem => elem.sourceId === socket.peerId)
    if (entry.length > 0) {
      cache.delete(entry[0].key)
    }
  })

  socket.on('disconnect', room => {
    socket.leave(room + '-connected')
    socket.leave(room)
    number--
  })
})
httpServer.listen(port, function () {
  console.log('HTTP Server listening on port ' + port)
})
