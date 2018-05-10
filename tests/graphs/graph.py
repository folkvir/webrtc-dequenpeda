#! /usr/bin/env python3
# coding: utf-8

import graph_tool as gt
import graph_tool.draw
import json
import sys
import numpy as np
import matplotlib.pyplot as plt
import matplotlib.patches as mpatches
import cairo
from functools import reduce

plt.switch_backend('cairo')

def readFile(file):
    return json.load(open(file))

def createGraph(data, type, filename):
    g = gt.Graph()

    prop = g.new_vertex_property("string")
    g.vertex_properties["type"] = prop

    ids = dict()
    id = 0
    typeColor = []
    for node in data:
        n = g.add_vertex()
        if node["type"] not in typeColor:
            typeColor.append(node["type"])
        g.vertex_properties["type"][n] = node["type"]
        ids[node["inview"]] = n
        id += 1

    average = []
    for node in data:
        a = 0
        for edge in node[type]:
            # print(edge)
            a += 1
            g.add_edge(ids[node["inview"]], ids[edge])
        average.append(a)
    calculatedaverage = reduce((lambda x, y: x + y), average) / len(average)
    print('average pv for type: ', calculatedaverage ,  ' ',  type)

    g.shrink_to_fit()

    # add colors to vertex
    cmap = plt.get_cmap('Set3')
    print(cmap)
    colors = cmap(np.linspace(0, 1, len(typeColor)))
    print(typeColor, colors)
    prop = g.new_vertex_property("vector<float>")
    g.vertex_properties["color"] = prop
    for v in g.vertices():
        g.vertex_properties["color"][v] = colors[typeColor.index(g.vertex_properties["type"][v])]

    for v in typeColor:
        print(v, colors[typeColor.index(v)], list(map((lambda x: x*256), colors[typeColor.index(v)])))
    g.shrink_to_fit()
    # fig, ax = plt.subplots()
    output = filename+'-'+type+"-graph.png"
    # ax.set(xlabel='some x legend', ylabel='some y legend',
    #    title='Network')
    # ax.grid()
    # different layout possible
    # pos = gt.draw.fruchterman_reingold_layout(g)
    # pos = gt.draw.arf_layout(g)
    # pos = gt.draw.radial_tree_layout(g)
    # planar_layout
    # random_layout
    # get_hierarchy_control_points
    gt.draw.graph_draw(g,
        pos=gt.draw.sfdp_layout(g),
        vertex_text=g.vertex_index,
        vertex_fill_color=g.vp.color,
        vertex_font_size=13,
        output_size=[1000, 1000],
        bg_color=[1,1,1,1],
        #mplfig=fig,
        output=output)

    #fig.savefig(output)

def main():
    print ('Number of arguments:', len(sys.argv), 'arguments.')
    print ('Argument List:', str(sys.argv))
    filename = sys.argv[1]
    print('Loading: ', filename)
    data = readFile(filename)
    createGraph(data, "rps", filename)
    try:
        createGraph(data, "overlay", filename)
    except Exception as e:
        pass


if __name__ == "__main__":
    main()
