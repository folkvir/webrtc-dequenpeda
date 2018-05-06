# gnuplot -e "path='pathtodata'" completeness-static.gnuplot

set datafile separator ","

set xlabel 'Round'                              # x-axis label
set ylabel 'Query Completeness (%)'                          # y-axis label
set terminal png size 800,600

set style data linespoints
set key bottom right

quarterrps = path."full-quarter-global-completeness.csv"
quarterson = path."full-son-quarter-global-completeness.csv"

halfrps = path."full-half-global-completeness.csv"
halfson = path."full-son-half-global-completeness.csv"

fullrps = path."full-rps-global-completeness.csv"
fullson = path."full-son-only-global-completeness.csv"

first = 1
second = 2

set output path."completeness-25.png"
set title 'Query Completeness by Round (49Q/196P)'
plot quarterrps using first:second lw 2 title "RPS", \
  quarterson using first:second lw 2 title "RPS+SON"

set output path."completeness-50.png"
set title 'Query Completeness by Round (98Q/196P)'
plot halfrps using first:second lw 2 title "RPS", \
  halfson using first:second lw 2 title "RPS+SON"

set output path."completeness-100.png"
set title 'Query Completeness by Round (196Q/196P)'
plot fullrps using first:second lw 2 title "RPS", \
  fullson using first:second lw 2 title "RPS+SON"
