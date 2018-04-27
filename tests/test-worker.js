
const StoreWorker = require('../src/store-worker.js')

const store = new StoreWorker()

store.on('ready', () => {
  console.log('the store is ready')
})

store.ping('hello').then((res) => {
  console.log('Response from the store worker: ', res)
  store.close()
})
