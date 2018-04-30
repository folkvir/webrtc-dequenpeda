const config = {
  queries: require('./full-98-queries.json'), // 98
  clients: 196,
  round: 200,
  datasets: [
    { name: 'diseasome', data: "../data/diseasome/fragments/", queries: "../data/diseasome/queries/queries.json", results: "../data/diseasome/results/", withoutQueries: ['q91.json', 'q92.json', 'q61.json', 'q53.json']},
    { name: 'linkedmdb', data: "../data/linkedmdb/fragments/", queries: "../data/linkedmdb/queries/queries.json", results: "../data/linkedmdb/results/", withoutQueries: []}
  ],
  options: {
    activeSon: false,
    shuffleCountBeforeStart: 5,
    foglet: {
      rps:{
        options: {
          a: 1,
          b: 5,
          timeout: 30 * 1000,
          delta: 10 * 60 * 1000,
        }
      }
    }
  }
}

config.timeout = (config.round + 1) * config.options.foglet.rps.options.delta
module.exports = config
