set datafile separator ","

set xlabel 'Round'                              # x-axis label
set ylabel 'Query Completeness (%)'                          # y-axis label
set terminal png size 800,600

set style data linespoints
set key bottom right

quarterrps = "./auto-round-0-full-quarter-18-21-1-4-2018ab6167d6-c9eb-41ad-b61f-86bd8d01c663/global-completeness.csv"
quarterson = "./auto-round-0-full-son-quarter-18-21-1-4-20180fc30ad0-d77a-45cd-aa5e-bafed1326edf/global-completeness.csv"

halfrps = "./auto-round-0-full-half-18-21-1-4-2018cfaa5ffe-1d11-4564-9718-069524d6e15c/global-completeness.csv"
halfson = "./auto-round-0-full-son-half-18-21-1-4-20186fb6995a-3a8e-4f17-8eb4-bdf8649b7615/global-completeness.csv"

fullrps = "./auto-round-0-full-rps-18-21-1-4-20182170686e-099c-40cf-a43d-5f58348ff426/global-completeness.csv"
fullson = "./auto-round-0-full-son-18-21-1-4-2018d7570e23-75f7-4d4f-8e0c-b1bcbf3c0d5d/global-completeness.csv"

set output "./completeness-25.png"
set title 'Query Completeness by Round (49Q/196P)'
plot quarterrps using 1:2 lw 2 title "RPS", \
  quarterson using 1:2 lw 2 title "RPS+SON"

set output "./completeness-50.png"
set title 'Query Completeness by Round (98Q/196P)'
plot halfrps using 1:2 lw 2 title "RPS", \
  halfson using 1:2 lw 2 title "RPS+SON"

set output "./completeness-100.png"
set title 'Query Completeness by Round (196Q/196P)'
plot fullrps using 1:2 lw 2 title "RPS", \
  fullson using 1:2 lw 2 title "RPS+SON"
