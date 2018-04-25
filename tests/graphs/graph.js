
function onupload(){
  console.log(document.getElementById('mygraph').files)

}

const graphs = new Map()
let id = 0
createGraph(defaultGraph)

function createGraph(data) {
  const parent = document.getElementById('allgraphs')
  const elem = document.createElement('div')
  elem.id = 'graph'+id
  parent.appendChild(elem)
  const graph = P2PGraph('#graph'+id)
  id++

  data.forEach(node => {
    graph.add({
      id: node.inview,
      name: node.inview
    })
    graph.add({
      id: node.outview,
      name: node.outview
    })
  })

  data.forEach(node => {
    node.rps.forEach('')
    graph.connect(node.inview, )
  })
}
