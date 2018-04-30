set datafile separator ","
set title 'Query Completeness by Round'                       # plot title
set xlabel 'Round'                              # x-axis label
set ylabel 'Query Completeness (%)'                          # y-axis label
set terminal png size 800,600

set style data linespoints
set key bottom right

quarterrps = "./Archive/16-38-29-3-2018955f795f-07fb-4885-8109-83df623f188f/global-completeness.csv"
quarterson = "./Archive/16-38-29-3-2018eaae6976-dd5e-49c7-8263-0deae43af9aa/global-completeness.csv"

halfrps = "./Archive/16-38-29-3-2018396dadee-ea6f-42c2-81ef-77eb20d3bb7f/global-completeness.csv"
halfson = "./Archive/16-38-29-3-2018feb7b5b3-eb11-4104-be8f-7f13533971eb/global-completeness.csv"

fullrps = "./Archive/16-38-29-3-2018918a9fe8-7808-4651-8a1b-ced825dd21ff/global-completeness.csv"
fullson = "./Archive/16-38-29-3-201855e5fb5b-8664-4a45-bffe-daab63bc8f90/global-completeness.csv"

set output "./completeness-25.png"
plot quarterrps using 1:2 lw 2 title "RPS", \
  quarterson using 1:2 lw 2 title "RPS+SON"
set output "./completeness-50.png"
plot halfrps using 1:2 lw 2 title "RPS", \
  halfson using 1:2 lw 2 title "RPS+SON"
set output "./completeness-100.png"
plot fullrps using 1:2 lw 2 title "RPS", \
  fullson using 1:2 lw 2 title "RPS+SON"
