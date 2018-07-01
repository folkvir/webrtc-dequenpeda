// gnuplot -e "input='./saved-results/auto-round-0-full-son*/convergence.csv'" -e "outputname='./saved-results/convergence.png'" plots/convergence.gnuplot

const fs = require('fs')
const path = require('path')
const commander = require('commander')
const similarity = require('../src/son/similarity-tpq.js').compare
const Profile = require('../src/son/profile')
const shell = require('shelljs')

commander
  .option('-p, --path <path>', 'path to network graph', (e) => path.resolve(e))
  .option('-r, --round <round>', 'Number of round', (e) => parseFloat(e))
  .parse(process.argv)

if(!commander.path) commander.help()
console.log(commander.path, commander.round)

const results = []
const patterns = ['full-son-only', 'full-son-half', 'full-son-quarter']
let index = 0

const ro = 3
for(let k=0; k<ro; k++) {
  shell.ls('-d', path.join(commander.path, `/auto-round-${k}-full-son-*/`)).forEach(p => {
    results.push({
      id: path.join(p, 'convergence.csv'),
      res: [],
      round: k
    })
    console.log('Writing: ', results[index].id)
    fs.writeFileSync(results[index].id, ['round', 'convergence'].join(',')+'\n', 'utf8')
    const subresults = results[index].res
    for(let i = 0; i<commander.round; i++) {
      const pattern = `${i}-neighbors.json`
      const pathtograph = path.join(p, pattern)
      const files = shell.ls(pathtograph)

      files.forEach(f => {
        //console.log(f)
        const file = JSON.parse(fs.readFileSync(f))
        const res = compute(file)
        subresults.push(res)
        fs.appendFileSync(results[index].id, [i, res].join(',')+'\n', 'utf8')
      })
    }
    ++index
  })
}
const averages = []
for(let j = 0; j<patterns.length; j++) {
  const r = []
  for(let i = 0; i<results.length; i++) {
    if (results[i].id.indexOf(patterns[j]) > -1) {
      r.push(results[i].res)
    }
  }
  const sum = r.reduce((acc, cur, l) => {
    if(l === 0) {
      return cur
    } else {
      const res = []
      for(let k = 0; k<cur.length; k++) {
        res.push(acc[k] + cur[k])
      }
      return res;
    }
  }, [])

  fs.writeFileSync(commander.path+'/average'+patterns[j]+'.csv', ['round', 'convergence'].join(',')+'\n', 'utf8')
  let towrite = sum.map(e => e/ro)
  for(let i = 0; i<towrite.length;i++) {
    fs.appendFileSync(commander.path+'/average'+patterns[j]+'.csv', [i, towrite[i]].join(',')+'\n', 'utf8')
  }
}



function compute(file) {
  let profiles = file
  // console.log('Number of profiles: %f', profiles.length)
  const nonemptyprofiles = profiles.filter(p => {
    if(p.profile.length > 0) return true
    return false
  })
  profiles = nonemptyprofiles
  profiles = profiles.map(p => {
    const prof = new Profile()
    p.profile.forEach(tpq => {
      prof.update(tpq)
    })
    p.profile = prof
    return p
  })
  // console.log('Number of non-empty profiles: %f', nonemptyprofiles.length)
  const bests = findkclosestprofile(5, profiles)
  const scores = bests.map(profile => {
    const bestids = profile.best.map(e => e.profile.inview)
    const overlayids = profile.overlay
    let score = 0
    overlayids.forEach(id => {
      if(bestids.includes(id)) score++
    })
    // console.log(score, profile.best.reduce((a, c) => a+c.score, 0), profile.overlay, )
    return score / bestids.length
  })
  const sum = scores.reduce((acc, cur) => acc+cur, 0)
  // console.log('Sum of all scores: ', sum)
  const average =  sum / scores.length * 100
  //console.log('Average of convergence of the son: %f%', average)
  return average
}




function findkclosestprofile(k, profiles) {
  return profiles.map(profile => {
    let sim = []
    profiles.forEach(prof => {
      sim.push({
        profile: prof,
        score: similarity(profile.profile.export(), prof.profile.export())
      })
    })
    sim.sort((a, b) => b.score - a.score)
    // sim.forEach(s => { if(s.score > 0) console.log(s) })
    const res = {
      profile,
      best: sim.filter((e, i) => i < k)
    }
    profile.best = sim.filter((e, i) => i < k)
    return profile
  })
}
