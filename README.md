# sncf-smart-location

Once connected on train Wi-Fi, display speed, max speed and name of current railway where your train (TGV INOUI, Intercités or TGV Lyria) is located.

Based on OpenStreetMap data, using Overpass-API

## Prerequisites

You need to be connected to the Wi-Fi hotspot of your train (`_SNCF_WIFI_INTERCITES`,  `_SNCF_WIFI_INOUI` or `_WIFI_LYRIA` ).  
Make sure you have been authenticated through the `wifi.sncf` portal.

## Usage

### TGV INOUI or Intercités

Run with

```
$ bash sncf-smart-location.sh
```

### TGV Lyria
```
$ bash sncf-smart-location.sh --lyria
```

