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

# Multilingual messages
if [[ $LANG == *"fr"* ]]; then
  MSG_POSITION_NOT_AVAILABLE="Position non disponible"
  MSG_CURRENT_POSITION="Position actuelle (latitude longitude) :"
  MSG_CONNECTED_INTERCITES_JOUR="Vous êtes à bord d'un train Intercités de jour !"
  MSG_CONNECTED_INTERCITES_NUIT="Vous êtes à bord d'un train Intercités de nuit !"
  MSG_CONNECTED_TGV_INOUI="Vous êtes à bord d'un train TGV-Inoui !"
  MSG_CONNECTED_LYRIA="Vous êtes à bord d'un train Lyria !"
  MSG_CONNECTED_OUIGO="Vous êtes à bord d'un train OuiGo !"
  MSG_NEAREST_STATION_FOUND="Gare la plus proche trouvée :"
  MSG_YOU_ARE_HERE="Vous êtes ici :"
  MSG_SEARCHING_STATIONS="Recherche de gares à moins de"
  MSG_SINGLE_TRACK="Voie unique"
  MSG_RAILWAY_LINES="Voies de"
  MSG_KM_FROM="à"
  MSG_TRAIN_STOPPED="Le train est arrêté à"
  MSG_APPROACHING_STATION="Le train approche de la gare de"
  MSG_MOVING_AWAY_STATION="Le train s'éloigne de la gare de"
  MSG_TRAIN_WAS="Le train était"
  MSG_AT="à"
  MSG_KM_H="km/h"
  MSG_FROM="de"
  MSG_AND="et"
  MSG_IS_NOW="est maintenant"
else
  MSG_POSITION_NOT_AVAILABLE="Position not available"
  MSG_CURRENT_POSITION="Current position (latitude longitude):"
  MSG_CONNECTED_INTERCITES_JOUR="You are aboard an Intercités de jour train!"
  MSG_CONNECTED_INTERCITES_NUIT="You are aboard an Intercités de nuit train!"
  MSG_CONNECTED_TGV_INOUI="You are aboard a TGV-Inoui train!"
  MSG_CONNECTED_LYRIA="You are aboard a Lyria train!"
  MSG_CONNECTED_OUIGO="You are aboard an OuiGo train!"
  MSG_NEAREST_STATION_FOUND="Nearest station found:"
  MSG_YOU_ARE_HERE="You are here:"
  MSG_SEARCHING_STATIONS="Searching for stations within"
  MSG_SINGLE_TRACK="Single Track of"
  MSG_RAILWAY_LINES="Railway Lines of"
  MSG_KM_FROM="from"
  MSG_TRAIN_STOPPED="The train is stopped at"
  MSG_APPROACHING_STATION="The train is approaching"
  MSG_MOVING_AWAY_STATION="The train is moving away from"
  MSG_TRAIN_WAS="The train was"
  MSG_AT="at"
  MSG_KM_H="km/h"
  MSG_FROM="from"
  MSG_AND="and"
  MSG_IS_NOW="is now"
fi

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
  if curl -s "https://wifi.intercites.sncf/router/api/train/gps" -o /dev/null ; \
  then url_root="wifi.intercites.sncf/router/api/train/gps"; log "$MSG_CONNECTED_INTERCITES_JOUR";
  else url_root="www.ombord.info/api/jsonp/position/"; uncapsulate_response=true; log "$MSG_CONNECTED_INTERCITES_NUIT"
  fi
}
print_distance(){
  if (( $(echo "$1 < 1" | bc -l) )); then
    echo $(printf "%.0f m" "$(bc <<< "$1 * 1000")")
  else
    echo $(printf "%.2f km" "$1")
  fi
}

CURRENT_SSID=$(nmcli device wifi show-password | awk '/SSID/ {print $2}')
case $CURRENT_SSID in
  *"INTERCITES"*) determine_intercites_type ;;
  *"INOUI"*) url_root="wifi.sncf/router/api/train/gps"; log "$MSG_CONNECTED_TGV_INOUI";;
  *"LYRIA"*) url_root="wifi.tgv-lyria.com/router/api/train/gps"; log "$MSG_CONNECTED_LYRIA";;
  *"OUIFI"*) url_root="ouifi.ouigo.com:8084/api/gps"; log "$MSG_CONNECTED_OUIGO";;
esac

function get_train_position(){
  position_response=$(curl https://$url_root -s )
  if $uncapsulate_response; then
    position_response=$( echo "$position_response" | sed 's/[()]//g' | sed 's/;//g')
  fi

  echo "$position_response" | jq -r '.latitude, .longitude, .speed'  | xargs -d '\n'

  [[ "$latitude $longitude" == "0 0" ]] && echo "$MSG_POSITION_NOT_AVAILABLE" && exit 0
}

read -r LATITUDE LONGITUDE SPEED <<< $(get_train_position)
whisper "$MSG_CURRENT_POSITION $LATITUDE $LONGITUDE"

curl --silent https://overpass-api.de/api/interpreter \
  --data-urlencode   "data=[out:json];way[railway](around:10,$LATITUDE,$LONGITUDE);(._;>;);out;" \
  | jq '.elements | map(select(.type=="way")) | .[] | .tags | .name |select( . != null )'  --raw-output | sort | uniq --count | sed 's/^ *//' | sed -E "s/^([2-9]+)/\1 $MSG_RAILWAY_LINES/g" | sed "s/^1/$MSG_SINGLE_TRACK/g"
for DISTANCE in 500 1000 2000 5000 10000 20000 30000; do
  log "$MSG_SEARCHING_STATIONS $DISTANCE $MSG_KM_FROM $LATITUDE, $LONGITUDE."
  read -r FOUND_STATION_LAT FOUND_STATION_LON FOUND_STATION <<<$(curl --silent https://overpass-api.de/api/interpreter \
   --data-urlencode "data=[out:json];node[railway=station][station!=subway](around:$DISTANCE,$LATITUDE,$LONGITUDE);(._;>;);out 1;" \
   | jq '.elements | map(select(.type=="node")) | .[] | .lat, .lon, .tags.name' --raw-output | xargs -d '\n' | uniq |  head -1)
  if [[ -n $FOUND_STATION ]]; then
    whisper "$MSG_NEAREST_STATION_FOUND $FOUND_STATION Latitude Longitude $FOUND_STATION_LAT $FOUND_STATION_LON"
    DISTANCE=$(echo "scale=0; $DISTANCE/1000" | bc)
    break
  fi
done

whisper "$MSG_YOU_ARE_HERE https://www.openrailwaymap.org/?lat=$LATITUDE&lon=$LONGITUDE&zoom=14"
SPEED_WITH_UNITS="$(printf "%.0f" "$(echo "scale=2; $SPEED*3.6" | bc -l)") $MSG_KM_H"

first_position_distance_from_station=$(distance "$FOUND_STATION_LAT" "$FOUND_STATION_LON"  "$LATITUDE" "$LONGITUDE")

# Get the train position again to be able to determine if the train moves away from or approaches the station
read -r SECOND_LATITUDE SECOND_LONGITUDE SECOND_SPEED <<< $(get_train_position)
second_position_distance_from_station=$(distance "$FOUND_STATION_LAT" "$FOUND_STATION_LON"  "$SECOND_LATITUDE" "$SECOND_LONGITUDE")
log "$MSG_TRAIN_WAS $MSG_AT $first_position_distance_from_station km $MSG_FROM $FOUND_STATION $MSG_AND $MSG_IS_NOW $MSG_AT $second_position_distance_from_station km $MSG_FROM $FOUND_STATION."
if [ 1 -gt "$(printf "%.0f" "$(echo "scale=0; $SPEED*3.6" | bc -l)")" ]
then
  echo "$MSG_TRAIN_STOPPED $(print_distance $second_position_distance_from_station) $MSG_FROM $FOUND_STATION station."
elif [ 1 -eq $(echo "$second_position_distance_from_station < $first_position_distance_from_station" | bc -l ) ]
then
  echo "$MSG_APPROACHING_STATION $FOUND_STATION $MSG_AT $(print_distance $second_position_distance_from_station) $MSG_AND $MSG_AT $SPEED_WITH_UNITS"
elif [ 1 -eq $(echo "$second_position_distance_from_station > $first_position_distance_from_station" | bc -l ) ]
then
  echo "$MSG_MOVING_AWAY_STATION $FOUND_STATION $MSG_AT $(print_distance $second_position_distance_from_station) $MSG_AND $MSG_AT $SPEED_WITH_UNITS"
else 
  echo "$MSG_TRAIN_STOPPED $(print_distance $second_position_distance_from_station) $MSG_FROM $FOUND_STATION station."
fi
