const sql = require('sql.js')
const fs = require('fs')
const readline = require('readline')
const shell = require('shelljs')
const uniqid = require('uniqid')

/*
writeStringToMemory is deprecated and should not be called! Use stringToUTF8() instead!
Number of errored triples:  989
Number of triples transformed:  202271
 */
const outputDir = require('path').join(__dirname, './dataset/triple_person/')
if (!fs.existsSync(outputDir)) shell.mkdir('-p', outputDir)

const output = require('path').join(__dirname, './triple_person_all.ttl')

// Create a database
let db = new sql.Database()

const createTable2 = `
  CREATE TABLE triple_person (
    subject VARCHAR(250) NOT NULL default '',
    predicate VARCHAR(250) NOT NULL default '',
    object VARCHAR(250) NOT NULL default '',
    anno_subject TINYINT(1) NOT NULL default '0',
    literal_object TINYINT(1) NOT NULL default '0',
    anno_object TINYINT(1) default NULL,
    url VARCHAR(250) default NULL
  )
`

db.run(createTable2)

const stream = fs.createReadStream(require('path').join(__dirname, './dataset/triple_person.sql'), { encoding: 'utf8' })
stream.setEncoding('utf8')
const rl = readline.createInterface({
  input: stream,
  crlfDelay: Infinity
})

let triples = new Map()
let errored = 0
const select = `SELECT * FROM triple_person`
let i = 0
rl.on('line', (line) => {
  const tmp = line.replace(/\\'/, "''")
  i++
  try {
    db.run(`${tmp}`)
  } catch (e) {
    // console.error(line)
    errored++
  }
})

rl.on('close', () => {
  const res = db.exec(select)
  res[0].values.forEach(val => {
    const subject = `<${val[0]}>`
    const predicate = `<${val[1]}>`
    let object
    if (val[4] === 1) {
      object = JSON.stringify(`${val[2]}`)
    } else {
      object = `<${fixedEncodeURI(val[2].replace(/\s+/g, ''))}>`
    }
    if (!triples.has(subject)) {
      triples.set(subject, [])
    }
    triples.get(subject).push(`${subject} ${predicate} ${object} .\n`)
  })
  let all = ''
  triples.forEach((v, k) => {
    let res = ''
    let id = uniqid()
    v.forEach(e => {
      res += e
      all += e
    })
    fs.writeFileSync(require('path').join(outputDir, id + '.ttl'), res)
  })
  fs.writeFileSync(output, all)
  console.log('Number of errored triples: ', errored)
  console.log('Number of triples transformed: ', i)
})

function fixedEncodeURI (str) {
  return encodeURI(str).replace(/%5B/g, '[').replace(/%5D/g, ']')
}
