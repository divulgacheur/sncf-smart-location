# SNCF Smart Location

## Overview

`SNCF Smart Location` is a Bash command-line utility crafted to retrieve real-time positional and velocity data for trains in France.
It's a resource tailored for travelers on trains who desire to garner detailed insights regarding their ongoing journey. This tool discerns the type of train based on the WiFi SSID (INTERCITES, INOUI, LYRIA, OUIFI) and employs train service APIs to procure the current latitude, longitude, and speed of the train.

## Features

- Retrieves and displays the real-time latitude and longitude coordinates and speed of the train.
- Automatically identifies the train service type (Intercités de jour, Intercités de nuit, TGV-Inoui, Lyria, OuiGo) based on the WiFi SSID (INTERCITES, INOUI, LYRIA, OUIFI).
- Utilizes the Overpass API to identify and exhibit nearby railway tracks and stations based on the current coordinates.
- Offers a link to OpenRailwayMap for a visual representation of the train's location.
- Assesses whether the train is nearing or departing from a specific station.

## Requirements

- `jq` for processing JSON responses.
- `curl` for executing HTTP requests.
- `bc` for performing mathematical operations.
- A Unix-like operating environment for executing the Bash script.

## Usage

1. Clone the GitHub repository to your local device.
2. Grant execute permission to the script: `chmod +x sncf_smart_location.sh`
3. Execute the script: `./sncf_smart_location.sh`
   Use `-v` or `--verbose` for detailed output and `-q` or `--quiet` to mute additional output.

## Example

```bash
$ ./sncf_smart_location.sh
Current position (latitude longitude): 45.954069 5.341012
2 Railway Lines of Ligne de Mâcon à Ambérieu
Nearest station found: Ambérieu-en-Bugey Latitude Longitude 45.9538732 5.3418521
You are here: https://www.openrailwaymap.org/?lat=45.954069&lon=5.341012&zoom=14
The train is approaching Ambérieu-en-Bugey at 37 m and at 57 km/h
```

## Limitations

- Assumes that the user is aboard a train and connected to the train's WiFi network (`_SNCF_WIFI_INOUI`, `_SNCF_WIFI_INTERCITES`, `OUIFI` or `_WIFI_LYRIA`) for determining the train type.
- The precision of the positional and speed data is contingent upon the train service APIs.

## Contribution

Contributions to enhance `SNCF Smart Location` are welcomed. Generate a pull request to commence the contribution process.

## License

The project is under the MIT License.

## Disclaimer

`SNCF Smart Location` is an independent tool and is not officially associated with any train service providers. The precision and availability of data rely on the respective APIs utilized.
