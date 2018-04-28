#! /usr/bin/env python3
# coding: utf-8

from graph_tool.all import *
import json
import sys
import numpy as np
import matplotlib.pyplot as plt

def readFile(file):
    return json.load(open(file))

def createGraph(data, type, filename):
    g = Graph()

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

    for node in data:
        for edge in node[type]:
            # print(edge)
            g.add_edge(ids[node["inview"]], ids[edge])

    g.shrink_to_fit()

    cmap = plt.get_cmap('Set3')
    print(cmap)
    colors = cmap(np.linspace(0, 1, len(typeColor)))
    print(typeColor, colors)
    prop = g.new_vertex_property("vector<float>")
    g.vertex_properties["color"] = prop
    for v in g.vertices():
        g.vertex_properties["color"][v] = colors[typeColor.index(g.vertex_properties["type"][v])]
        #print(g.vertex_properties["color"][v])

    graph_draw(g, vertex_text=g.vertex_index, groups=g.vertex_properties["type"], vertex_fill_color=g.vp.color, vertex_font_size=10, output_size=(1000, 1000), output=filename+'-'+type+"-graph.png")


def main():
    print ('Number of arguments:', len(sys.argv), 'arguments.')
    print ('Argument List:', str(sys.argv))
    filename = sys.argv[1]
    type = sys.argv[2]
    print('Loading: ', filename)
    data = readFile(filename)
    createGraph(data, type, filename)

if __name__ == "__main__":
    main()
