function log () {
    if [[ $_V -eq 1 ]]; then
        echo "$@"
    fi
}

CURRENT_SSID=$(nmcli device wifi  show-password  | grep SSID | cut --delimiter ' ' --field 2)
if [[ $CURRENT_SSID == *"INTERCITES"* ]]; then
  log "You are connected to a Intercités train !"
  url_root="wifi.intercites.sncf"
elif [[ $CURRENT_SSID == *"INOUI"* ]]; then
  log "You are connected to a TGV-Inoui train !"
  url_root="wifi.sncf"
elif [[ $CURRENT_SSID == *"LYRIA"* ]]; then
  log "You are in a Lyria train !"
    url_root="wifi.tgv-lyria.com"
fi

curl "https://$url_root/router/api/train/gps" -s > gps ;
curl -s --data-urlencode "$(echo `echo 'data=way[railway](around:20,' ; cat gps | cut -d, -f4,5 | cut -d\" -f 3,5 | tr -d \": ; echo -n ');(._;>;);out;'  `)" https://overpass-api.de/api/interpreter \
| grep 'maxspeed\|description\|name' ;
speed=$(cat gps | cut -d, -f7 | cut -d: -f2)
echo "Actual speed : "$( echo "$speed * 3.6" | bc) "km/h"
