set datafile separator ","
set title 'Number of messages by Round'                       # plot title
set xlabel 'Round'                              # x-axis label
set ylabel 'Number of messages (%)'                          # y-axis label
set terminal png size 800,600
set output outputname
set style data linespoints



location = input

SIZE = system("ls -1 " . location . "| wc -l")
FILES = system("ls -1 " . location)

plot for [file in FILES] file using 1:3 lw 2 notitle

print 'Size:', SIZE

# plot 'test.csv' using 1:2 with lines, 'test.csv' using 1:3 with lines, '4col.csv' using 1:4 with lines
