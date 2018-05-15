# gnuplot -e "path='pathtodata'" completeness-static.gnuplot

set datafile separator ","

set xlabel 'Round'                              # x-axis label
set ylabel 'Average query completeness (%)'                          # y-axis label
set terminal png size 800,600

# for colors: https://stackoverflow.com/questions/19412382/gnuplot-line-types?utm_medium=organic&utm_source=google_rich_qa&utm_campaign=google_rich_qa

set style data linespoints
set key top left

quarterrps = path."full-quarter-global-completeness.csv"
quarterson = path."full-son-quarter-global-completeness.csv"

halfrps = path."full-half-global-completeness.csv"
halfson = path."full-son-half-global-completeness.csv"

fullrps = path."full-rps-global-completeness.csv"
fullson = path."full-son-only-global-completeness.csv"

round = 1
completeness = 2
messagebyround = 6
bound = 7
set xtics 20
set output path."completeness.png"
set multiplot layout 1,3
set yrange [0:45]
set title "49 Queries"
plot quarterrps using round:completeness lw 2 title "RPS", \
  quarterson using round:completeness lw 2 title "RPS+SON"
set title "98 Queries"
plot halfrps using round:completeness lw 2 title "RPS", \
  halfson using round:completeness lw 2 title "RPS+SON"
set title "196 Queries"
plot fullrps using round:completeness lw 2 title "RPS", \
  fullson using round:completeness lw 2 title "RPS+SON"
unset yrange
unset multiplot

set key bottom right
set output path."messages.png"
set multiplot layout 1,3
set ylabel 'Average number of messages'
set yrange [0:2000]
set title "49 Queries"
plot quarterrps using round:messagebyround lw 1 title "RPS", \
  quarterson using round:messagebyround lw 1 title "RPS+SON", \
  quarterson using round:bound lw 1 lt 7 title "Limit"
set title "98 Queries"
plot halfrps using round:messagebyround lw 1 title "RPS", \
halfson using round:messagebyround lw 1 title "RPS+SON", \
halfson using round:bound lw 1 lt 7 title "Limit"
set title "196 Queries"
plot fullrps using round:messagebyround lw 1 title "RPS", \
fullson using round:messagebyround lw 1 title "RPS+SON",  \
fullson using round:bound lw 1 lt 7 title "Limit"
unset yrange
unset multiplot
