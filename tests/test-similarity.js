const Profile = require('../src/son/profile')
const similarity = require('../src/son/similarity-tpq.js').compare
const shuffle = require('lodash.shuffle')
const queries = require('../data/diseasome/queries/queries.json')
const assert = require('assert')
console.log('Number of queries: ', queries.length)

let   profiles = []

queries.forEach(q => {
  const newProfile = new Profile()
  const triples = analyse(q.query)
  console.log('Number of triples:', triples.length)
  triples.forEach(tpq => {
    newProfile.update(tpq)
  })
  profiles.push(newProfile.export())
})

const spo = {
  subject: '_',
  predicate: '_',
  object: '_'
}

let us = profiles.shift()
us = [spo]
console.log('Number of profiles:', profiles.length)
console.log('Let\'s shuffle profiles...')
profiles.push([spo])
profiles = shuffle(profiles)
console.log('Now sort them with the similarity')

profiles = profiles.sort(compare(us))

profiles.forEach(p => {
  console.log(similarity(us, p))
})

const indexSpo = profiles.findIndex((s) => {
  let find = false
  s.forEach(tpq => {
    if(!find && tpq.subject === spo.subject && tpq.predicate === spo.predicate && tpq.object === spo.object) {
      find = true
    }
  })
  return find
})

console.log('Indexof spo nned to be the first!! => 0: ', indexSpo)
assert.equal(indexSpo, 0)
const lastEntry = [ { subject: 'http://www4.wiwiss.fu-berlin.de/diseasome/resource/diseases/705',
      predicate: 'http://www4.wiwiss.fu-berlin.de/diseasome/resource/diseasome/name',
      object: '_' },
    { subject: 'http://www4.wiwiss.fu-berlin.de/diseasome/resource/diseases/705',
      predicate: 'http://www.w3.org/2002/07/owl#sameAs',
      object: '_' },
    { subject: 'http://www4.wiwiss.fu-berlin.de/diseasome/resource/diseases/705',
      predicate: 'http://www4.wiwiss.fu-berlin.de/diseasome/resource/diseasome/size',
      object: '_' },
    { subject: 'http://www4.wiwiss.fu-berlin.de/diseasome/resource/diseases/705',
      predicate: 'http://www4.wiwiss.fu-berlin.de/diseasome/resource/diseasome/classDegree',
      object: '_' },
    { subject: 'http://www4.wiwiss.fu-berlin.de/diseasome/resource/diseases/705',
      predicate: 'http://www4.wiwiss.fu-berlin.de/diseasome/resource/diseasome/class',
      object: '_' } ]

console.log('US: ', us)
console.log(similarity(us, lastEntry))
console.log(similarity(lastEntry, us))

// containment
console.log(similarity([spo], us))
// subset
console.log(similarity(us, [spo]))


function compare(us) {
  return (a, b) => {
    const simA = similarity(us, a)
    const simB = similarity(us, b)
    console.log('Sima: ', simA, '| Simb', simB)
    return simB - simA
  }
}

function analyse (query) {
  const SparqlParser = require('sparqljs').Parser
  const parser = new SparqlParser()
  const _parsedQuery = parser.parse(query)
  return _extractTriplePattern(_parsedQuery)
}

function _extractTriplePattern (parsedQuery) {
  //console.log(parsedQuery)
  const extract = (whereClause) => {
    const extractBis = (object) => {
      if (object.type === 'union' || object.type === 'group' || object.type === 'optional' || object.type === 'graph') {
        //console.log('Recursive call: ', object.patterns);
        return object.patterns.map(p => extractBis(p)).reduce((acc, cur) => {
          //console.log('reduce: cur', cur, 'reduce acc:', acc)
          acc.push(...cur)
          return [...acc]
        }, [])
      } else if (object.type === 'bgp') {
        //console.log('Found a bgp: ', object.type);
        return object.triples
      } else if (object.type === 'filter') {
        // console.log('Found a filter: ', object.type);
        return []
      } else {
        throw new Error(`Unknown type in the query object.type found: ${object.type}`)
      }
    }
    const mappedClauses = whereClause.map(obj => extractBis(obj))
    //console.log(mappedClauses)
    if (mappedClauses.length > 0) {
      const res = mappedClauses.reduce((acc, cur) => { acc.push(...cur); return acc }, [])
      return res
    } else {
      return []
    }
  }
  return extract(parsedQuery.where)
}
