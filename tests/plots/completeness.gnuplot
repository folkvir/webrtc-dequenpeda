set datafile separator ","
set title 'Query Completeness by Round'                       # plot title
set xlabel 'Round'                              # x-axis label
set ylabel 'Query Completeness (%)'                          # y-axis label
set terminal png
set output outputname
set style data linespoints



location = input

SIZE = system("ls -1 " . location . "| wc -l")
FILES = system("ls -1 " . location)

plot for [file in FILES] file using 1:2 lw 3 notitle

print 'Size:', SIZE

# plot 'test.csv' using 1:2 with lines, 'test.csv' using 1:3 with lines, '4col.csv' using 1:4 with lines
