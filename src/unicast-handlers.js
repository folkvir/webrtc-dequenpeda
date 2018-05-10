function _handleAskTriples(id, message) {
  message.triples.reduce((acc, triple) => acc.then(result => {
    return new Promise((resolve, reject) => {
      const defaultGraph = this._encapsGraphId(this._options.defaultGraph, '<', '>')
      this._store.getTriples(defaultGraph, message.prefixes, triple).then((res) => {
        resolve([...result, {
          triple,
          data: res
        }])
      }).catch(e => {
        resolve([...result, {
          triple,
          data: []
        }])
      })
    })
  }), Promise.resolve([])).then(res => {
    try {
      if(this._foglet.getNeighbours(Infinity).includes(message.requester.outview) || (this._foglet.overlay('son') && this._foglet.overlay('son').network.getNeighbours(Infinity).includes(message.requester.outview))) {
        if(message.requester.overlay) {
          this._foglet.overlay('son').communication.sendUnicast(message.requester.outview, {
            start: message.start,
            owner: {
              fogletId: this._foglet.id,
              inview: this._foglet.inViewID,
              outview: this._foglet.outViewID
            },
            type: 'answer-triples',
            query: message.query,
            triples: res,
            jobId: message.jobId
          }).then(() => {
            //this._statistics.message++ do not count reply
          }).catch(e => {
            console.log(new Error('error when responding to a ask_triples', e))
          })

        } else {
          this._foglet.sendUnicast(message.requester.outview, {
            shuffleBegin: message.shuffleBegin,
            owner: {
              fogletId: this._foglet.id,
              inview: this._foglet.inViewID,
              outview: this._foglet.outViewID
            },
            type: 'answer-triples',
            query: message.query,
            triples: res,
            jobId: message.jobId
          }).then(() => {
            //this._statistics.message++ do not count reply
          }).catch(e => {
            console.log(new Error('error when responding to a ask_triples', e))
          })
        }

      }
    } catch (e) {
      console.log(e)
    }
  })
}

module.exports = {
  _handleAskTriples
}
