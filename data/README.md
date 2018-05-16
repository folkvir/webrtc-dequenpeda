# Data and fragments generation
Dataset are:
* Diseasome
* GeoCoordinates
* LinkedMDB

Fragments are generated with CONSTRUCT queries on Triple Pattern from queries in
 `/data/[dataset]/queries/queries2execute.txt` (this is line numbers referring to queries in `/data/[dataset]/queries/queries.txt`)

 We load dataset into a LDF server, then we execute all CONSTRUCT queries to generate fragments.

 Then we fragment again all generated fragments with a **fragmentation factor of 0.5**

# LDF Server using Docker
Available dataset:
* Diseasome: /diseasome
* GeoCoordinates: /geocoordinates
* LinkedMDB: /linkedmdb

```bash
# build the image with a ldf tag name
docker build -t ldf .
# run on the port 5678 with the container name ldf
docker run --name ldf -d -p 5678:5678 ldf /config/config.json 5678
# generate fragments
node generateData.js
# genereate results and the full logs of queries in queries/queries.json and all individual files in results/
node generateResults.
```

# Without docker
You can generate fragments without docker but you need to install pm2 and ldf-server
```bash
npm install -g pm2
npm install -g ldf-server
pm2 start ldfpm2.js --name ldf
node generateData.js
```
