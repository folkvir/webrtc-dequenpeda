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
```


# Dataset for testing purposes only

1) Extract the dataset (always choose the option 'extract to dataset.tar' then 'extract here')
2) [optionnal] If you want a fresh dump simply run the script sql2rdf.js after extracting the archive
```
node sql2rdf.js
```

It will generate a dump with all triples in a turtle format and a folder with 33k files with a file per subject in the folder dataset.
Note: all files already exist in the archive
