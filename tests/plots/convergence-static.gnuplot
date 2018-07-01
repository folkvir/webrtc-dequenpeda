set datafile separator ","
set title 'Convergence of the SON by round'                       # plot title
set xlabel 'Round'                              # x-axis label
set ylabel 'Convergence (%)'                          # y-axis label
set terminal png size 1600,1200

set style data linespoints

location = input
out = outputname
print "Loaction: ".location
print "Output: ".out
set output out

full = location."averagefull-son-only.csv"
half = location."averagefull-son-half.csv"
quarter = location."averagefull-son-quarter.csv"

plot full using 1:2 lw 2 title "All", \
  half using 1:2 lw 2 title "Half", \
  quarter using 1:2 lw 2 title "Quarter"


# plot 'test.csv' using 1:2 with lines, 'test.csv' using 1:3 with lines, '4col.csv' using 1:4 with lines
