const Dequenpeda = require('../webrtc-dequenpeda').Client

const datasetSub = 'triple_person/2xusiez7gijdmxg4my.ttl'
// const datasetAll = 'triple_person_all.ttl'

const query1 = `
  SELECT *
  FROM <http://mypersonaldata.com/>
  WHERE {
    ?s ?p ?o .
  }
`

const query3 = `PREFIX foaf:   <http://xmlns.com/foaf/0.1/>
 PREFIX rdf:   <http://www.w3.org/1999/02/22-rdf-syntax-ns#>
 SELECT ?person1 ?person1Name
 WHERE {
    ?person1 foaf:name ?person1Name .
  }`

let client1 = createClient()
let client2 = createClient()

function createClient () {
  return new Dequenpeda()
}

// connect the first client
client1.connection(client2).then(() => {
  console.log(`${client1._foglet.id}`, 'Client1 connected  to Client2 and ready to go !')
  // read data for the second client
  readTurtleFile(require('path').join(__dirname, './../data/' + datasetSub)).then((file) => {
    // insert data into the rdfstore of the client
    client2.loadTriples(file).then(() => {
      console.log(`${client2._foglet.id}`, 'Data red.')

      // query all data of client2
      const query = client1.query(query3)
      query.on('updated', (result) => {
        console.log(result)
      })
    }).catch(e => {
      console.error(e)
    })
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
