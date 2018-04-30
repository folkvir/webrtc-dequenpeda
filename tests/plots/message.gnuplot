set datafile separator ","
set title 'Number of messages by Round'                       # plot title
set xlabel 'Round'                              # x-axis label
set ylabel 'Number of messages (%)'                          # y-axis label
set terminal png size 800,600
set style data linespoints

location = input
out = outputname
print "Loaction: ".location
print "Output: ".out
set output out

SIZE = system("ls -1 " . location . "| wc -l")
set multiplot layout SIZE,1
FILES = system("ls -1 " . location)
print FILES
do for [file in FILES] {
  print 'File: '.file
  plot file using 1:3 lw 2 title "#AppMessage", \
    file using 1:4 lw 2 title "#edges-RPS", \
    file using 1:5 lw 2 title "#edges-SON", \
    file using 1:6 lw 2 title "#NetworkMessages"
}
unset multiplot

# plot 'test.csv' using 1:2 with lines, 'test.csv' using 1:3 with lines, '4col.csv' using 1:4 with lines
