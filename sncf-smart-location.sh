#!/bin/bash

function log() {
  [[ $_V -eq 1 ]] && echo "$@"
}

[[ $1 == "-v" || $1 == "--verbose" ]] && _V=1 && log "Verbose mode enabled"


CURRENT_SSID=$(nmcli device wifi show-password | awk '/SSID/ {print $2}')
case $CURRENT_SSID in
  *"INTERCITES"*) url_root="wifi.intercites.sncf"; log "You are connected to an Intercités train!";;
  *"INOUI"*) url_root="wifi.sncf"; log "You are connected to a TGV-Inoui train!";;
  *"LYRIA"*) url_root="wifi.tgv-lyria.com"; log "You are in a Lyria train!";;
esac

POSITION=$(curl https://$url_root/router/api/train/gps -s | jq -r '.latitude, .longitude'  | xargs -d '\n' | sed 's/ /,/g' )
curl --silent https://overpass-api.de/api/interpreter \
  --data-urlencode   "data=[out:json];way[railway](around:25,$POSITION);(._;>;);out;" \
  | jq '.elements | map(select(.type=="way")) | .[] | .tags | .name |select( . != null )'  --raw-output | sort | uniq --count | sed 's/^ *//' | sed 's/^\([0-9]\)*/\1 Voies de/g' | sed 's/^1/Voie unique/g'

for DISTANCE in 500 1000 2000 5000 10000 20000 30000; do
  log "Distance is $DISTANCE meters"
  FOUND_STATION=$(curl --silent https://overpass-api.de/api/interpreter \
   --data-urlencode "data=[out:json];node[railway=station][train=yes](around:$DISTANCE,$POSITION);(._;>;);out;" \
   | jq '.elements | map(select(.type=="node")) | .[] | .tags | .name' --raw-output | uniq |  head -1)
  if [[ -n $FOUND_STATION ]]; then
    DISTANCE=$(echo "scale=0; $DISTANCE/1000" | bc)
    echo "Gare la plus proche : $FOUND_STATION (-$DISTANCE km)"
    break
  fi
done
