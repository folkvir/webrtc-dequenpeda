/* file : construct-operator.js
MIT License

Copyright (c) 2018 Thomas Minier

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
*/

'use strict'

const { TransformIterator } = require('asynciterator')
const { Writer } = require('n3')
const compact = require('lodash.compact')

/**
 * Return a high-order function to apply bindings to a given triple pattern
 * @param  {Object} triple   - A triple pattern on which bindings will be inkected
 * @return {function} Function callbale with a set of bindings,
 * which returns `null` if no substitution was found, otheriwse returns a RDF triple
 */
function applyBindings (triple) {
  const subjVar = triple.subject.startsWith('?')
  const predVar = triple.predicate.startsWith('?')
  const objVar = triple.object.startsWith('?')
  return bindings => {
    const newTriple = Object.assign({}, triple)
    if (subjVar) {
      newTriple.subject = newTriple.subject.substr(1)
      if (!(newTriple.subject in bindings)) return null
      newTriple.subject = bindings[newTriple.subject].value
    }
    if (predVar) {
      newTriple.predicate = newTriple.predicate.substr(1)
      if (!(newTriple.predicate in bindings)) return null
      newTriple.predicate = bindings[newTriple.predicate].value
    }
    if (objVar) {
      newTriple.object = newTriple.object.substr(1)
      if (!(newTriple.object in bindings)) return null
      newTriple.object = bindings[newTriple.object].value
    }
    return newTriple
  }
}

/**
 * A ConstructOperator transform solution mappings into RDF triples, according to a template
 * @extends TransformIterator
 * @author Thomas Minier
 */
class ConstructOperator extends TransformIterator {
  /**
   * Constructor
   * @param {AsyncIterator} source  - Source iterator
   * @param {Object[]} templates - Set of triples patterns in the CONSTRUCT clause
   */
  constructor (source, templates) {
    super(source)
    this._nbTriples = 0
    this._writer = new Writer()
    // filter out triples with no SPARQL variables to output them only once
    this._templates = templates.filter(t => {
      if (t.subject.startsWith('?') || t.predicate.startsWith('?') || t.object.startsWith('?')) {
        return true
      }
      this._push(this._writer.tripleToString(t.subject, t.predicate, t.object))
      return false
    }).map(applyBindings)
  }

  get cardinality () {
    return this._nbTriples
  }

  /**
   * Transform bindings into RDF triples
   * @private
   * @param  {[type]}   bindings [description]
   * @param  {Function} done     [description]
   * @return {void}
   */
  _transform (bindings, done) {
    compact(this._templates.map(f => f(bindings)))
      .forEach(t => {
        this._nbTriples++
        this._push(this._writer.tripleToString(t.subject, t.predicate, t.object))
      })
    done()
  }
}

module.exports = ConstructOperator
