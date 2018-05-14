set datafile separator ","
set title 'Convergence of the SON by round in pourcentage'                       # plot title
set xlabel 'Round'                              # x-axis label
set ylabel 'Convergence (%)'                          # y-axis label
set terminal png size 1600,1200

set style data linespoints

location = input
out = outputname
print "Loaction: ".location
print "Output: ".out
set output out

SIZE = system("ls -1 " . location . "| wc -l")
FILES = system("ls -1 " . location)
plot for [file in FILES] file using 1:2 lw 2 title file

# plot 'test.csv' using 1:2 with lines, 'test.csv' using 1:3 with lines, '4col.csv' using 1:4 with lines
