
function onupload(files){
  console.log(files)
  for(let i=0; i<files.length; i++) {
    readFile(files[i]).then((res) => {
      const data = JSON.parse(res)
      console.log(data)
      graph(data, id, 'rps')
      graph(data, id, 'son')
    }).catch(e => {
      console.error(e)
    })
  }
}

function readFile(file) {
  return new Promise((resolve, reject) => {
    var reader = new FileReader();
    reader.readAsText(file, "UTF-8");
    reader.onload = function (evt) {
        resolve(evt.target.result)
    }
    reader.onerror = function (evt) {
        reject(new Error('error when reading the file...'))
    }
  })
}

const graphs = new Map()
let id = 0

// graph(defaultGraph, id, 'rps')
// graph(defaultGraph, id, 'son')

function name(node) {
  return node.inview+node.outview
}

function nameFromId(id) {
  const n = id.slice(0, -2)
  return n+'-I'+n+'-O'
}



function datad3(data, id, type) {
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
      radius: node.rps.length
    })
  })
  const done = []
  data.forEach(node => {
    if(type === 'rps' ) {
      console.log('RPS size: ', node.rps.length)
      node.rps.forEach(n => {
        const link = name(node)+nameFromId(n)
        if(!done.includes(link)) dataParsed.links.push({
          source: name(node),
          target: nameFromId(n),
          value: 1
        })
        done.push(link)
      })
    } else if(type === 'son') {
      console.log('SON size: ', node.overlay.length)
      node.overlay.forEach(n => {
        const link = name(node)+nameFromId(n)
        if(!done.includes(link)) dataParsed.links.push({
          source: name(node),
          target: nameFromId(n),
          value: 1
        })
        done.push(link)
      })
    }

  })
  return dataParsed
}

function graph(data, id, type) {
  id++
  const datas = datad3(data, id, type)
  let svg = d3.select("#d3").append("svg:svg").style("width", 800).style("height", 600)
  width = 800
  height = 600
  console.log(width, height)

  let color = d3.scaleOrdinal(d3.schemePaired);
  console.log(color, d3.schemePaired)

  let simulation = d3.forceSimulation(datas.nodes)
      .force("link", d3.forceLink(datas.links).id(function (d) {return d.id;}).distance(10).strength(1))
      .force("charge", d3.forceManyBody(200))
      .force("center", d3.forceCenter(width/2, height/2))
      .force("gravity", d3.forceManyBody(200))
      .force("cluster", forceCluster)
      .force("collide", forceCollide)

  var forceCollide = d3.forceCollide()
    .radius(function(d) { return d.radius + 1.5; })
    .iterations(1);

  function forceCluster(alpha) {
    for (var i = 0, n = nodes.length, node, cluster, k = alpha * 1; i < n; ++i) {
      node = nodes[i];
      cluster = clusters[node.cluster];
      node.vx -= (node.x - cluster.x) * k;
      node.vy -= (node.y - cluster.y) * k;
    }
  }

  let links = svg.append("g")
      .attr("class", "links")
      .selectAll("line")
      .data(datas.links)
      .enter().append("line")
      .attr("stroke-width", function(d) { return d.value })
      .attr("fill", (d) => color(d.group))
      .attr("stroke", "black")

  let nodes = svg.append("g")
      .attr("class", "nodes")
      .selectAll("circle")
      .data(datas.nodes)
      .enter().append("circle")
      .attr("r", 5)
      .attr("fill", function(d) { return color(d.group); })
      .call(d3.drag()
      .on("start", dragstarted)
      .on("drag", dragged));

  nodes.append("title")
      .text(function(d) { return d.name; });

  simulation
      .nodes(datas.nodes)
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
