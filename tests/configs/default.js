const config = {
  name: 'default',
  queries: require('./default-queries.json'),
  clients: 100,
  round: 10,
  datasets: [
    { name: 'diseasome', data: "../data/diseasome/fragments/", queries: "../data/diseasome/queries/queries.json", results: "../data/diseasome/results/", withoutQueries: ['q91.json', 'q92.json', 'q61.json', 'q53.json']},
    //{ name: 'linkedmdb', data: "../data/linkedmdb/fragments/", queries: "../data/linkedmdb/queries/queries.json", results: "../data/linkedmdb/results/", withoutQueries: []},
    // { name: 'geocoordinates', data: "../data/geocoordinates/fragments/", queries: "../data/geocoordinates/queries/queries.json", results: "../data/geocoordinates/results/", withoutQueries: []}
  ],
  options: {
    activeSon: true,
    shuffleCountBeforeStart: 0,
    foglet: {
      rps:{
        options: {
          timeout: 5 * 1000,
          delta: 30 * 1000,
        }
      }
    }
  }
}

config.timeout = (config.round + 1) * config.options.foglet.rps.options.delta
module.exports = config
