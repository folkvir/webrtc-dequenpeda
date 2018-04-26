
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
  data.forEach(node => {
    dataParsed.nodes.push({
      group: node.name,
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
  return dataParsed
}

function graph(data, id) {



  let svg = d3.select("#d3").append("svg:svg").style("width", 800).style("height", 600)
  width = +svg.attr("width")
  height = +svg.attr("height")
  console.log(width, height)

  let color = d3.scaleOrdinal(d3.schemeCategory20);

  let simulation = d3.forceSimulation()
      .force("link", d3.forceLink().id(function(d) { return d.id; }))
      .force("charge", d3.forceManyBody())
      .force("center", d3.forceCenter(width / 2, height / 2));



  let link = svg.append("g")
      .attr("class", "links")
    .selectAll("line")
    .data(data.links)
    .enter().append("line")
      .attr("stroke-width", function(d) { return Math.sqrt(d.value); });

  let node = svg.append("g")
      .attr("class", "nodes")
    .selectAll("circle")
    .data(data.nodes)
    .enter().append("circle")
      .attr("r", 5)
      .attr("fill", function(d) { return color(d.group); })
      .call(d3.drag()
          .on("start", dragstarted)
          .on("drag", dragged));

  node.append("title")
      .text(function(d) { return d.id; });

  simulation
      .nodes(data.nodes)
      .on("tick", ticked);

  simulation.force("link")
      .links(data.links);

  function ticked() {
    link
        .attr("x1", function(d) { return d.source.x; })
        .attr("y1", function(d) { return d.source.y; })
        .attr("x2", function(d) { return d.target.x; })
        .attr("y2", function(d) { return d.target.y; });

    node
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

  // function dragended(d) {
  //   if (!d3.event.active) simulation.alphaTarget(0);
  //   d.fx = null;
  //   d.fy = null;
  // }
}
