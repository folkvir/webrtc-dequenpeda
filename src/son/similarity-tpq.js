const SCORES = {
  equal: 3,
  containment: 2,
  overlap: 1,
  empty: 0
}

function compare(profileA, profileB) {
  // console.log(profileA, profileB)
  let score = 0
  profileA.forEach(tpa => {
    profileB.forEach(tpb => {
      score += getScore(tpa, tpb)
    })
  })
  //console.log('score: ', score, `LA: ${profileA.length}, LB: ${profileB.length}`)
  return score
}

function getScore(tpa, tpb) {
  if(equal(tpa, tpb)) return SCORES.equal
  if(containment(tpa, tpb)) return SCORES.containment
  if(overlap(tpa, tpb)) return SCORES.overlap
  return SCORES.empty
}

function containment(tpa, tpb) {
  return contain(tpa.subject, tpb.subject) && contain(tpa.predicate, tpb.predicate) && contain(tpa.object, tpb.object)
}

function overlap(tpa, tpb) {
  return over(tpa.subject, tpb.subject) && over(tpa.predicate, tpb.predicate) && over(tpa.object, tpb.object)
}

function equal(tpa, tpb) {
  return eq(tpa.subject, tpb.subject) && eq(tpa.predicate, tpb.predicate) && eq(tpa.object, tpb.object)
}

function contain(v1, v2) {
  return eq(v1, v2) || ( !eq(v1, '_') && eq(v2, '_'))
}

function over(v1, v2) {
  return eq(v1, v2) || ( eq(v1, '_') && !eq(v2, '_'))
}

function eq(v1, v2) {
  return (v1 === v2)
}

module.exports = {
  compare,
  containment,
  overlap,
  equal,
  eq,
  contain,
  over
}
