
function onupload(){
  console.log(document.getElementById('mygraph').files)
}

const graphs = new Map()
let id = 0
// createGraph(defaultGraph)
const data = datad3(defaultGraph)

console.log(data)
graph(data, id)

function createGraph(data) {
  const parent = document.getElementById('allgraphs')
  const elem = document.createElement('div')
  elem.id = 'graph'+id
  parent.appendChild(elem)
  const graph = P2PGraph('#graph'+id)
  id++
  data.forEach(node => {
    graph.add({
      id: name(node),
      name: node.inview.slice(0, -2)
    })
  })

  const done = []

  data.forEach(node => {
    node.rps.forEach(n => {
      const link = name(node)+nameFromId(n)
      if(!done.includes(link)) graph.connect(name(node), nameFromId(n))
      done.push(link)
    })
  })
}

function name(node) {
  return node.inview+node.outview
}

function nameFromId(id) {
  const n = id.slice(0, -2)
  return n+'-I'+n+'-O'
}



function datad3(data) {
  // data2graph
  const dataParsed = {
    links: [],
    nodes: []
  }
  let group = new Map()
  let revertedGroup = new Map()
  data.forEach(node => {
    if(!revertedGroup.has(node.type)) {
      revertedGroup.set(node.type, group.size+1)
      group.set(group.size+1, node.type)
    }
    dataParsed.nodes.push({
      group: revertedGroup.get(node.type),
      id: name(node),
      name: node.inview.slice(0, -2),
    })
  })
  const done = []
  data.forEach(node => {
    node.rps.forEach(n => {
      const link = name(node)+nameFromId(n)
      if(!done.includes(link)) dataParsed.links.push({
        source: name(node),
        target: nameFromId(n),
        value: 1
      })
      done.push(link)
    })
  })
  console.log(group)
  return dataParsed
}

function graph(data, id) {
  let svg = d3.select("#d3").append("svg:svg").style("width", 800).style("height", 600)
  width = 800
  height = 600
  console.log(width, height)

  let color = d3.scaleOrdinal(d3.schemePaired);
  console.log(color, d3.schemePaired)

  let simulation = d3.forceSimulation(data.nodes)
      .force("link", d3.forceLink(data.links).id(function (d) {return d.id;}).distance(200).strength(2))
      .force("charge", d3.forceManyBody())
      .force("center", d3.forceCenter(width/2, height/2));



  let links = svg.append("g")
      .attr("class", "links")
      .selectAll("line")
      .data(data.links)
      .enter().append("line")
      .attr("stroke-width", function(d) { return d.value })
      .attr("fill", (d) => color(d.group))
      .attr("stroke", "black")

  let nodes = svg.append("g")
      .attr("class", "nodes")
      .selectAll("circle")
      .data(data.nodes)
      .enter().append("circle")
      .attr("r", 5)
      .attr("fill", function(d) { return color(d.group); })
      .call(d3.drag()
      .on("start", dragstarted)
      .on("drag", dragged));

  nodes.append("title")
      .text(function(d) { return d.name; });

  simulation
      .nodes(data.nodes)
      .on("tick", ticked);

  function ticked() {
    links
        .attr("x1", function(d) { return d.source.x; })
        .attr("y1", function(d) { return d.source.y; })
        .attr("x2", function(d) { return d.target.x; })
        .attr("y2", function(d) { return d.target.y; });

    nodes
        .attr("cx", function(d) { return d.x; })
        .attr("cy", function(d) { return d.y; });
  }

  function dragstarted(d) {
    if (!d3.event.active) simulation.alphaTarget(0.3).restart();
    d.fx = d.x;
    d.fy = d.y;
  }

  function dragged(d) {
    d.fx = d3.event.x;
    d.fy = d3.event.y;
  }

  function dragended(d) {
    if (!d3.event.active) simulation.alphaTarget(0);
    d.fx = null;
    d.fy = null;
  }
}
