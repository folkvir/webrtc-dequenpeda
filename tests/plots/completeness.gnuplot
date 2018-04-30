set datafile separator ","
set title 'Query Completeness by Round'                       # plot title
set xlabel 'Round'                              # x-axis label
set ylabel 'Query Completeness (%)'                          # y-axis label
set terminal png size 800,600
set output outputname
set style data linespoints

location = input

SIZE = system("ls -1 " . location . "| wc -l")
FILES = system("ls -1 " . location)

print 'Size:', SIZE

plot for [file in FILES] file using 1:2 lw 2 title file
