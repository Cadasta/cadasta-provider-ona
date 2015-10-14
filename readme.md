#ONA Provider for Cadasta Ingestion Engine

The Cadasta Ingestion Engine is the interface between the Cadasta database and various survey providers.

## Installation

This package should be automatically installed into the `node_modules` directory of `cadasta-api`.
However, you also need to install the python dependencies for pyxform. `pyxform` is used inside of this provider.

```
pip install -r requirements.txt
```

This provider will parse incoming ONA-exported.json datasets and

1) Load the data into the Cadasta DB

Note - the `_geolocation` property in the .json structure (that normally contains an array with y, x point coordinates) should be replaced with a GeoJSON snippet that can handle any geometry type
