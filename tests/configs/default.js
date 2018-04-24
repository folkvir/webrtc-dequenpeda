module.exports = {
  clients: 10,
  timeout: 10 * 60 * 1000,
  round: 2,
  datasets: [
    { name: 'diseasome', data: "../data/diseasome/fragments/", queries: "../data/diseasome/queries/queries.json", results: "../data/diseasome/results/", withoutQueries: ['q91.json', 'q92.json', 'q61.json', 'q53.json']},
    // { name: 'linkedmdb', data: "../data/linkedmdb/fragments/", queries: "../data/linkedmdb/queries/queries.json", results: "../data/linkedmdb/results/", withoutQueries: []},
    // { name: 'geocoordinates', data: "../data/geocoordinates/fragments/", queries: "../data/geocoordinates/queries/queries.json", results: "../data/geocoordinates/results/", withoutQueries: []}
  ],
  options: {
    activeSon: false,
    shuffleCountBeforeStart: 0,
    foglet: {
      rps:{
        options: {
          timeout: 60 * 1000,
          delta: 30 * 1000,
        }
      }
    }
  }
}