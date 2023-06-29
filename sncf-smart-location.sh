#!/bin/bash
LC_NUMERIC="en_US.UTF-8"

POSITIONAL_ARGS=()

while [[ $# -gt 0 ]]; do
  case $1 in
    -v|--verbose)
      _V=1
      shift # past argument
      ;;
    -q|--quiet)
      QUIET=1
      shift # past argument
      ;;
    -*|--*)
      echo "Unknown option $1"
      exit 1
      ;;
    *)
      POSITIONAL_ARGS+=("$1") # save positional arg
      shift # past argument
      ;;
  esac
done

function log() {
  [[ $_V -eq 1 ]] && echo "$@"
}

function whisper() {
  [[ $QUIET -ne 1 ]] && echo "$@"
}

deg2rad () {
  bc -l <<< "$1 * 0.0174532925"
}

rad2deg () {
  bc -l <<< "$1 * 57.2957795"
}

acos () {
  pi="3.141592653589793"
  bc -l <<<"$pi / 2 - a($1 / sqrt(1 - $1 * $1))"
}

distance () {
  lat_1="$1"
  lon_1="$2"
  lat_2="$3"
  lon_2="$4"
  delta_lat=`bc <<<"$lat_2 - $lat_1"`
  delta_lon=`bc <<<"$lon_2 - $lon_1"`
  lat_1="`deg2rad $lat_1`"
  lon_1="`deg2rad $lon_1`"
  lat_2="`deg2rad $lat_2`"
  lon_2="`deg2rad $lon_2`"
  delta_lat="`deg2rad $delta_lat`"
  delta_lon="`deg2rad $delta_lon`"

  distance=`bc -l <<< "s($lat_1) * s($lat_2) + c($lat_1) * c($lat_2) * c($delta_lon)"`
  distance=`acos $distance`
  distance="`rad2deg $distance`"
  distance=`bc -l <<< "$distance * 60 * 1.15078"`
  distance=`bc <<<"scale=4; $distance / 1 *  1.609344"`
  printf "%.4f\n" $distance
}

determine_intercites_type(){
  if curl -Is "https://wifi.intercites.sncf/router/api/train/gps"; \
  then url_root="wifi.intercites.sncf/router/api/train/gps"; log "You are connected to an Intercités de jour train!";
  else url_root="www.ombord.info/api/jsonp/position/"; uncapsulate_response=true; log "You are connected to an Intercités de nuit train!"
  fi
}

CURRENT_SSID=$(nmcli device wifi show-password | awk '/SSID/ {print $2}')
case $CURRENT_SSID in
  *"INTERCITES"*) determine_intercites_type ;;
  *"INOUI"*) url_root="wifi.sncf/router/api/train/gps"; log "You are connected to a TGV-Inoui train!";;
  *"LYRIA"*) url_root="wifi.tgv-lyria.com/router/api/train/gps"; log "You are in a Lyria train!";;
  *"OUIFI"*) url_root="ouifi.ouigo.com:8084/api/gps"; log "You are in OuiGo train!";;
esac

function get_train_position(){
  position_response=$(curl https://$url_root -s )
  if $uncapsulate_response; then
    position_response=$( echo "$position_response" | sed 's/[()]//g' | sed 's/;//g')
  fi

  echo "$position_response" | jq -r '.latitude, .longitude, .speed'  | xargs -d '\n'
  #[[ "$position_response" == "0" ]] && echo "Position not available" && exit 0
}

read -r LATITUDE LONGITUDE SPEED <<< $(get_train_position)
whisper "Current position (latitude longitude) is $LATITUDE $LONGITUDE"

curl --silent https://overpass-api.de/api/interpreter \
  --data-urlencode   "data=[out:json];way[railway](around:10,$LATITUDE,$LONGITUDE);(._;>;);out;" \
  | jq '.elements | map(select(.type=="way")) | .[] | .tags | .name |select( . != null )'  --raw-output | sort | uniq --count | sed 's/^ *//' | sed -E 's/^([2-9]+)/\1 Voies de/g' | sed 's/^1/Voie unique/g'
for DISTANCE in 500 1000 2000 5000 10000 20000 30000; do
  log "Check stations within $DISTANCE meters"
  read -r FOUND_STATION_LAT FOUND_STATION_LON FOUND_STATION <<<$(curl --silent https://overpass-api.de/api/interpreter \
   --data-urlencode "data=[out:json];node[railway=station][station!=subway](around:$DISTANCE,$LATITUDE,$LONGITUDE);(._;>;);out 1;" \
   | jq '.elements | map(select(.type=="node")) | .[] | .lat, .lon, .tags.name' --raw-output | xargs -d '\n' | uniq |  head -1)
  if [[ -n $FOUND_STATION ]]; then
    whisper "Nearest station found : $FOUND_STATION Latitude Longitude $FOUND_STATION_LAT $FOUND_STATION_LON"
    DISTANCE=$(echo "scale=0; $DISTANCE/1000" | bc)
    break
  fi
done



log "https://www.openrailwaymap.org/?style=standard&lat=$LATITUDE&lon=$LONGITUDE&zoom=15"
log "$(printf "%.0f" "$(echo "scale=2; $SPEED*3.6" | bc -l)") km/h"

first_position_distance_from_station=$(distance "$FOUND_STATION_LAT" "$FOUND_STATION_LON"  "$LATITUDE" "$LONGITUDE")

# Get the train position again
read -r SECOND_LATITUDE SECOND_LONGITUDE SECOND_SPEED <<< $(get_train_position)


second_position_distance_from_station=$(distance "$FOUND_STATION_LAT" "$FOUND_STATION_LON"  "$SECOND_LATITUDE" "$SECOND_LONGITUDE")
log "$first_position_distance_from_station $second_position_distance_from_station"

if [ 1 -eq $(echo "$second_position_distance_from_station < $first_position_distance_from_station" | bc -l ) ]
then
  echo "Le train s'approche de la gare de $FOUND_STATION à -$DISTANCE km"
elif [ 1 -eq $(echo "$second_position_distance_from_station > $first_position_distance_from_station" | bc -l ) ]
then
  echo "Le train s'éloigne de la gare de $FOUND_STATION à -$DISTANCE km"
else 
  echo "Le train est arrêté en gare à -$DISTANCE km de $FOUND_STATION"
fi
