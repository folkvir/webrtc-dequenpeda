const config = {
  name: "full-rps",
  queries: require('./full-queries.json'), // 196
  clients: 196,
  round: 100,
  datasets: [
    { name: 'diseasome', data: "../data/diseasome/fragments/", queries: "../data/diseasome/queries/queries.json", results: "../data/diseasome/results/", withoutQueries: ['q91.json', 'q92.json', 'q61.json', 'q53.json']},
    // { name: 'linkedmdb', data: "../data/linkedmdb/fragments/", queries: "../data/linkedmdb/queries/queries.json", results: "../data/linkedmdb/results/", withoutQueries: []}
  ],
  options: {
    storeWorker: true, // activate the worker for the store or not
    manualshuffle: false, // activate the manual shuflling
    manualshuffleperiodicdelta: 5 * 60 * 1000, // if no queries, shuffle every 5 minutes
    manualshufflewaitingtime: 30 * 1000, // when the shuffle is manual, need to establish how many time we will sleep between the shuffle and the execution, to wait for a proper connection
    defaultGraph: 'http://mypersonaldata.com/', // default graph, need to be http://<...>
    timeout: 10 * 1000, //network timeout when sending tpq
    activeSon: false,
    shuffleCountBeforeStart: 10,
    foglet: {
      rps:{
        options: {
          maxPeers: 10,
          timeout: 30 * 1000,
          delta: 1 * 60 * 1000,
        }
      }
    }
  }
}

config.timeout = (config.round + 1) * config.options.foglet.rps.options.delta
module.exports = config
