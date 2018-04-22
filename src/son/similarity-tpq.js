const SCORES = {
  equal: 5,
  containment: 5,
  overlap: 3,
  empty: 0
}

function compare(profileA, profileB) {
  // console.log(profileA, profileB)
  let score = 0
  profileA.forEach(pa => {
    profileB.forEach(pb => {
      if(equal(pa, pb)) {
        score += SCORES.equal
      } else if(containment(pa, pb)){
        score += SCORES.containment
      } else if (overlap(pa, pb)) {
        score += SCORES.overlap
      } else if(empty(pa, pb)) {
        score += SCORES.empty
      }
    })
  })
  console.log('score: ', score, `LA: ${profileA.length}, LB: ${profileB.length}`)
  return score
}

function containment(tpa, tpb) {
  // TODO
  return true
}

function overlap(tpa, tpb) {
  // TODO
  return true
}

function empty(tpa, tpb) {
  // TODO
  return true
}

function equal(tpa, tpb) {
  // TODO
  return true
}

module.exports = {
  containment,
  overlap,
  empty,
  equal,
  compare
}
