const MAX_SET_TIMEOUT = 2147483647
const config = {
  name: 'default',
  queries: require('./default-queries.json'),
  clients: 20,
  round: 5,
  datasets: [
    { name: 'diseasome', data: "../data/diseasome/fragments/", queries: "../data/diseasome/queries/queries.json", results: "../data/diseasome/results/", withoutQueries: ['q91.json', 'q92.json', 'q61.json', 'q53.json']},
    //{ name: 'linkedmdb', data: "../data/linkedmdb/fragments/", queries: "../data/linkedmdb/queries/queries.json", results: "../data/linkedmdb/results/", withoutQueries: []},
    // { name: 'geocoordinates', data: "../data/geocoordinates/fragments/", queries: "../data/geocoordinates/queries/queries.json", results: "../data/geocoordinates/results/", withoutQueries: []}
  ],
  options: {
    storeWorker: true, // activate the worker for the store or not
    manualExecution: true, // manually execute queries when a shuffling occures
    manualshuffle: false, // activate the manual shuflling
    manualshuffleperiodicdelta: 30 * 1000, // if no queries, shuffle every 5 minutes
    manualshufflewaitingtime: 10 * 1000, // when the shuffle is manual, need to establish how many time we will sleep between the shuffle and the execution, to wait for a proper connection
    defaultGraph: 'http://mypersonaldata.com/', // default graph, need to be http://<...>
    timeout: 10 * 1000, //network timeout when sending tpq
    queryType: 'normal', // there is one type, so normal is always choose.
    activeSon: true, // we activate the semantic overlay network or not
    shuffleCountBeforeStart: 2, // we wait n shuffle before updated queries.
    foglet: {
      rps:{
        options: {
          maxPeers: 10,
          timeout: 30 * 1000,
          timeoutPending: 30 * 1000,
          delta: 10 * 1000,
        }
      }
    }
  }
}

config.timeout = MAX_SET_TIMEOUT
module.exports = config
