{
  "title": "3in1 LDF Server with Diseasome, GeoCoordinates and LinkedMDB",
  "datasources": {
    "diseasome": {
      "title": "Diseasome",
      "type": "HdtDatasource",
      "description": "Diseasome Dataset",
      "settings": { "file": "./diseasome/federationData.hdt" }
    },
    "geocoordinates": {
      "title": "GeoCoordinates",
      "type": "HdtDatasource",
      "description": "GeoCoordinates Dataset",
      "settings": { "file": "./geocoordinates/federationData.hdt" }
    },
    "linkedmdb": {
      "title": "LinkedMDB",
      "type": "HdtDatasource",
      "description": "LinkedMDB Dataset",
      "settings": { "file": "./linkedmdb/federationData.hdt" }
    }
  }
  "logging": {
    "enabled": true,
    "file": "access.log"
  }
}
