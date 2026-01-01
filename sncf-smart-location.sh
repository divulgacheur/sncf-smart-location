#!/bin/bash
LC_NUMERIC="en_US.UTF-8"

POSITIONAL_ARGS=()

if ! command -v curl &> /dev/null || ! command -v jq &> /dev/null || ! command -v bc &> /dev/null; then
    echo "$MSG_DEPS_MISSING"
    exit 1
fi


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
      echo "$MSG_UNKNOWN_OPTION $1"
      exit 1
      ;;
    *)
      POSITIONAL_ARGS+=("$1") # Collect unused positional args (currently not used, kept for future extensions)
      shift # past argument
      ;;
  esac
done

# log(): prints only in verbose mode
function log() {
  [[ $_V -eq 1 ]] && echo "$@"
}

# whisper(): prints unless quiet mode is enabled
function whisper() {
  [[ $QUIET -ne 1 ]] && echo "$@"
}

# Localized messages (FR/EN based on $LANG)
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
  MSG_DEPS_MISSING="Erreur : dépendances requises (curl, jq, bc) introuvables."
  MSG_UNKNOWN_OPTION="Option inconnue"
  MSG_FETCH_POSITION_FAILED="Erreur : impossible de récupérer la position du train."
  MSG_CURL_FAILED="Erreur : curl a échoué."
  MSG_OVERPASS_504="API Overpass saturée (HTTP 504 Gateway Timeout) — requête ignorée."
  MSG_OVERPASS_HTTP_ERROR="Erreur API Overpass : HTTP"
  MSG_OVERPASS_IGNORED="— requête ignorée."
  MSG_OVERPASS_NON_JSON="Overpass a renvoyé une réponse non-JSON. Premières lignes :"
  MSG_NO_STATION_FOUND="Aucune gare à proximité trouvée (API Overpass indisponible ou limitée). Réessayez dans quelques secondes."
  MSG_LAT_LON="Latitude Longitude"
  MSG_STATION_WORD="gare"
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
  MSG_DEPS_MISSING="Error: Required dependencies (curl, jq, bc) not found."
  MSG_UNKNOWN_OPTION="Unknown option"
  MSG_FETCH_POSITION_FAILED="Error: Failed to fetch train position."
  MSG_CURL_FAILED="Error: curl failed."
  MSG_OVERPASS_504="Overpass API overloaded (HTTP 504 Gateway Timeout) — request ignored."
  MSG_OVERPASS_HTTP_ERROR="Overpass API error: HTTP"
  MSG_OVERPASS_IGNORED="— request ignored."
  MSG_OVERPASS_NON_JSON="Overpass returned non-JSON. First lines:"
  MSG_NO_STATION_FOUND="No nearby station found (Overpass API unavailable or rate-limited). Please retry in a few seconds."
  MSG_LAT_LON="Latitude Longitude"
  MSG_STATION_WORD="station"
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

# Great-circle distance between two GPS points (returns kilometers).
# Uses a trigonometric formula (acos-based) with bc -l for floating-point math.
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
# Intercités uses two different onboard APIs depending on the train (day vs night):
# - If the SNCF Wi-Fi endpoint responds, use it (day)
# - Otherwise fall back to ombord.info JSONP endpoint (night), which needs "uncapsulate_response"
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

# Detect the onboard Wi-Fi SSID to choose the correct GPS API endpoint (TGV INOUI / OUIGO / LYRIA / INTERCITES)
CURRENT_SSID=$(nmcli device wifi show-password | awk '/SSID/ {print $2}')
case $CURRENT_SSID in
  *"INTERCITES"*) determine_intercites_type ;;
  *"INOUI"*) url_root="wifi.sncf/router/api/train/gps"; log "$MSG_CONNECTED_TGV_INOUI";;
  *"LYRIA"*) url_root="wifi.tgv-lyria.com/router/api/train/gps"; log "$MSG_CONNECTED_LYRIA";;
  *"OUIFI"*) url_root="ouifi.ouigo.com:8084/api/gps"; log "$MSG_CONNECTED_OUIGO";;
esac

# Output format: "latitude longitude speed" on a single line (read by `read -r LATITUDE LONGITUDE SPEED <<< ...`)
function get_train_position(){
  position_response=$(curl https://$url_root -s ) || { echo "$MSG_FETCH_POSITION_FAILED"; exit 1; }
  if $uncapsulate_response; then
    position_response=$( echo "$position_response" | sed 's/[()]//g' | sed 's/;//g')
  fi

  echo "$position_response" | jq -r '.latitude, .longitude, .speed'  | xargs -d '\n'

  [[ "$latitude $longitude" == "0 0" ]] && echo "$MSG_POSITION_NOT_AVAILABLE" && exit 0
}


read -r LATITUDE LONGITUDE SPEED <<< $(get_train_position)
whisper "$MSG_CURRENT_POSITION $LATITUDE $LONGITUDE"


# Query Overpass and return JSON on stdout.
# If HTTP != 200 (e.g., 429 rate-limit / 504 overload), return non-zero so the caller can skip and try another radius.
query_overpass_json() {
  local q="$1"
  local tmp
  tmp=$(mktemp)

  local http
  http=$(curl -sS -o "$tmp" -w '%{http_code}' \
    --connect-timeout 10 --max-time 60 \
    -H 'Accept: application/json' \
    -H 'User-Agent: overpass-bash-script/1.0' \
    https://overpass-api.de/api/interpreter \
    --data-urlencode "data=$q") || {
      echo "curl failed" >&2
      rm -f "$tmp"
      return 1
    }

  if [[ "$http" != "200" ]]; then
    if [[ "$http" == "504" ]]; then
      log "$MSG_OVERPASS_504"
    else
      log "$MSG_OVERPASS_HTTP_ERROR $http $MSG_OVERPASS_IGNORED"
    fi
    rm -f "$tmp"
    return 2
  fi


# Sanity-check: ensure the response looks like JSON before passing it to jq
  if ! head -c 1 "$tmp" | grep -q '[{[]'; then
    echo "$MSG_OVERPASS_NON_JSON" >&2
    head -n 10 "$tmp" >&2
    rm -f "$tmp"
    return 3
  fi

  cat "$tmp"
  rm -f "$tmp"
}

# Best-effort: query nearby railway ways (around 10m) to display track/line name(s)
q='[out:json];way[railway](around:10,'"$LATITUDE"','"$LONGITUDE"');(._;>;);out;'
json=$(query_overpass_json "$q") || true

if [[ -n "$json" ]]; then
  railway_lines=$(
    printf '%s' "$json" \
      | jq -r '.elements
               | map(select(.type=="way"))
               | .[]
               | .tags.name
               | select(. != null)' \
      | sort | uniq -c \
      | sed 's/^ *//' \
      | sed -E "s/^([2-9]+)/\1 $MSG_RAILWAY_LINES/g" \
      | sed "s/^1/$MSG_SINGLE_TRACK/g"
  )

  [[ -n "$railway_lines" ]] && echo "$railway_lines"
fi

# Progressive search radius (meters): start small, expand until a station is found
for DISTANCE in 500 1000 2000 5000 10000 20000 30000; do
  log "$MSG_SEARCHING_STATIONS $DISTANCE m $MSG_KM_FROM $LATITUDE, $LONGITUDE."

  q='[out:json];node[railway=station][station!=subway](around:'"$DISTANCE"','"$LATITUDE"','"$LONGITUDE"');out 1;'
  json=$(query_overpass_json "$q") || continue

  # Extract first matching station node: emit 3 lines (lat, lon, name), keep only the first triplet, then convert to one line for `read`
  read -r FOUND_STATION_LAT FOUND_STATION_LON FOUND_STATION < <(
    printf '%s' "$json" \
    | jq -r '.elements[] | select(.type=="node") | "\(.lat)\n\(.lon)\n\(.tags.name // "")"' \
    | head -n 3 \
    | xargs -d '\n'
  )

  if [[ -n "$FOUND_STATION" ]]; then
    whisper "$MSG_NEAREST_STATION_FOUND $FOUND_STATION $MSG_LAT_LON $FOUND_STATION_LAT $FOUND_STATION_LON"
    DISTANCE=$(echo "scale=0; $DISTANCE/1000" | bc)
    break
  fi
done

if [[ -z "$FOUND_STATION" || -z "$FOUND_STATION_LAT" || -z "$FOUND_STATION_LON" ]]; then
  echo "$MSG_NO_STATION_FOUND" >&2
  whisper "$MSG_YOU_ARE_HERE https://www.openrailwaymap.org/?lat=$LATITUDE&lon=$LONGITUDE&zoom=14"
  exit 0
fi

whisper "$MSG_YOU_ARE_HERE https://www.openrailwaymap.org/?lat=$LATITUDE&lon=$LONGITUDE&zoom=14"
SPEED_WITH_UNITS="$(printf "%.0f" "$(echo "scale=2; $SPEED*3.6" | bc -l)") $MSG_KM_H"

first_position_distance_from_station=$(distance "$FOUND_STATION_LAT" "$FOUND_STATION_LON"  "$LATITUDE" "$LONGITUDE")

# Fetch the train position a second time to determine whether it is approaching or moving away from the station
read -r SECOND_LATITUDE SECOND_LONGITUDE SECOND_SPEED <<< $(get_train_position)
second_position_distance_from_station=$(distance "$FOUND_STATION_LAT" "$FOUND_STATION_LON"  "$SECOND_LATITUDE" "$SECOND_LONGITUDE")
log "$MSG_TRAIN_WAS $MSG_AT $first_position_distance_from_station km $MSG_FROM $FOUND_STATION $MSG_AND $MSG_IS_NOW $MSG_AT $second_position_distance_from_station km $MSG_FROM $FOUND_STATION."

# Consider the train "stopped" if speed < 1 km/h, otherwise compare distances to decide approaching vs moving away
if [ 1 -gt "$(printf "%.0f" "$(echo "scale=0; $SPEED*3.6" | bc -l)")" ]
then
  echo "$MSG_TRAIN_STOPPED $(print_distance $second_position_distance_from_station) $MSG_FROM $FOUND_STATION."
elif [ 1 -eq $(echo "$second_position_distance_from_station < $first_position_distance_from_station" | bc -l ) ]
then
  echo "$MSG_APPROACHING_STATION $FOUND_STATION $MSG_AT $(print_distance $second_position_distance_from_station) $MSG_AND $MSG_AT $SPEED_WITH_UNITS"
elif [ 1 -eq $(echo "$second_position_distance_from_station > $first_position_distance_from_station" | bc -l ) ]
then
  echo "$MSG_MOVING_AWAY_STATION $FOUND_STATION $MSG_AT $(print_distance $second_position_distance_from_station) $MSG_AND $MSG_AT $SPEED_WITH_UNITS"
else 
  echo "$MSG_TRAIN_STOPPED $(print_distance $second_position_distance_from_station) $MSG_FROM $FOUND_STATION $MSG_STATION_WORD."

fi
