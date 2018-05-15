const debug = require('debug')('dequenpeda:similarity')

// DEBUG=dequenpeda:similarity node tests/test-similarity.js

const SCORES = {
  spo: Infinity,
  equal: Infinity,
  containment: 2,
  subset: 1,
  empty: 0
}
const spo = {
  subject: '_',
  predicate: '_',
  object: '_'
}

function compare(profileA, profileB) {
  let score = 0
  profileA.forEach(tpa => {
    profileB.forEach(tpb => {
      score += getScore(tpa, tpb)
    })
  })
  return score
}

function getScore(tpa, tpb) {
  if(equal(tpa, tpb)) {
    debug('equality')
    return SCORES.equal
  } else if(containment(tpa, tpb)) {
    debug('containment')
    return SCORES.containment
  // } else if(subset(tpa, tpb)) {
  //   debug('subset')
  //   return SCORES.subset
  } else {
    debug('nothing')
    return SCORES.empty
  }
}

function containment(tpa, tpb) {
  return contain(tpa.subject, tpb.subject) && contain(tpa.predicate, tpb.predicate) && contain(tpa.object, tpb.object)
}

function subset(tpa, tpb) {
  return sub(tpa.subject, tpb.subject) && sub(tpa.predicate, tpb.predicate) && sub(tpa.object, tpb.object)
}

function isSPO(tp) {
  return equal(tp, spo)
}

function equal(tpa, tpb) {
  return eq(tpa.subject, tpb.subject) && eq(tpa.predicate, tpb.predicate) && eq(tpa.object, tpb.object)
}

function contain(v1, v2) {
  return eq(v1, v2) || ( !eq(v1, '_') && eq(v2, '_'))
}

function sub(v1, v2) {
  return eq(v1, v2) || ( eq(v1, '_') && !eq(v2, '_'))
}

function eq(v1, v2) {
  return (v1 === v2)
}

module.exports = {
  isSPO,
  compare,
  containment,
  subset,
  equal,
  eq,
  contain,
  sub
}
