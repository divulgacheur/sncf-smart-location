curl https://wifi.sncf/router/api/train/gps -s > gps ;
curl -s --data-urlencode "$(echo `echo 'data=way[railway](around:20,' ; cat gps | cut -d, -f4,5 | cut -d\" -f 3,5 | tr -d \": ; echo -n ');(._;>;);out;'  `)" https://overpass-api.de/api/interpreter \
| grep 'maxspeed\|description\|name' ;
speed=$(cat gps | cut -d, -f7 | cut -d: -f2)
echo "Actual speed : "$( echo "$speed * 3.6" | bc) "km/h"
