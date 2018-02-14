const Dequenpeda = require('../webrtc-dequenpeda').Client
const datasetSub = 'triple_person/2xusiez7gijdmxg4my.ttl'
// const datasetAll = 'triple_person_all.ttl'

const query = `
  PREFIX foaf:   <http://xmlns.com/foaf/0.1/>
  PREFIX rdf:   <http://www.w3.org/1999/02/22-rdf-syntax-ns#>
  SELECT ?person1Name ?mbox1 ?person2Name ?mbox2
  WHERE {
    ?person1 foaf:mbox ?mbox1 .
    ?person1 rdf:type foaf:Person .
    ?person1 foaf:knows ?person2 .
    ?person2 foaf:mbox ?mbox2 .
    ?person2 rdf:type foaf:Person .
    ?person1 foaf:name ?person1Name .
    ?person2 foaf:name "andreas"
  }
`

let client1 = createClient()
let client2 = createClient()

function createClient () {
  return new Dequenpeda()
}

// connect the first client
client1.connection().then(() => {
  console.log(`${client1._foglet.id}`, 'Client1 connected and ready to go !')
  // connect the second client
  client2.connection().then(() => {
    console.log(`${client2._foglet.id}`, 'Client2 connected and ready to go !')

    // read data for the second client
    readTurtleFile(require('path').join(__dirname, './../data/' + datasetSub)).then((file) => {
      // insert data into the rdfstore of the client
      client2.loadTriples(file).then(() => {
        console.log(`${client2._foglet.id}`, 'Data red.')

        // get all data of the client
        client2.getTriples(undefined, [], {
          subject: '<http://www.blog.morgaine-lefaye.net/foaf.rdf#croberts>',
          predicate: '?p',
          object: '?o'
        }).then((res) => {
          const queryObject = client1.query(query)
        }).catch(e => {
          console.log(e)
        })
      }).catch(e => {
        console.error(e)
      })
    })
  }).catch(e => {
    throw new Error(e)
  })
}).catch(e => {
  throw new Error(e)
})

function readTurtleFile (location) {
  return new Promise((resolve, reject) => {
    const fs = require('fs')
    fs.readFile(location, 'utf8', (err, data) => {
      if (err) reject(err)
      resolve(data)
    })
  })
}
