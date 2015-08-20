#ONA Provider for Cadasta Ingestion Engine

The Cadasta Ingestion Engine is the interface between the Cadasta database and various survey providers.

This provider will parse incoming ONA-exported.json datasets and

1) Load the data into the Cadasta DB

Note - the `_geolocation` property in the .json structure (that normally contains an array with y, x point coordinates) should be replaced with a GeoJSON snippet that can handle any geometry type
