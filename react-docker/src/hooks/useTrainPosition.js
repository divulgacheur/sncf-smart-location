import { useState, useEffect, useRef, useCallback } from 'react';
import { distances, refreshIntervalSec } from '../constants/train';
import { calculateDistance, calculateBearing, projectPosition } from '../utils/geo';
import { correctLineName, normalizeKey } from '../utils/string';

const initialTrainData = {
  latitude: null,
  longitude: null,
  speed: null,
  nearestStation: null,
  nearestStationWikiUrl: null,
  stationDistance: null,
  nearestStationLat: null,
  nearestStationLon: null,
  lineName: null,
  lineMaxSpeed: null,
  stationImageUrl: null,
  stationImageSourceUrl: null,
  stationImageTitle: null,
  stationImageFileName: null,
  stationImageSource: null,
  wikiSummary: null,
  wikiUrl: null,
};

export const useTrainPosition = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [refreshCountdown, setRefreshCountdown] = useState(refreshIntervalSec);
  const [autoCenter, setAutoCenter] = useState(true);
  const [isStationRefreshing, setIsStationRefreshing] = useState(false);
  const [stationSearchStatus, setStationSearchStatus] = useState('idle');
  const isTrainFetchInFlightRef = useRef(false);
  const imageRequestRef = useRef({ stationKey: null, source: null });
  const lastPositionRef = useRef({
    lat: null,
    lon: null,
    ts: null,
    speedKmh: null,
    bearingDeg: null,
  });
  const lastOverpassRef = useRef({
    line: { lat: null, lon: null, at: 0, inFlight: false },
    station: { lat: null, lon: null, at: 0, inFlight: false },
  });

  const [trainData, setTrainData] = useState(initialTrainData);
  const [liveDistanceKm, setLiveDistanceKm] = useState(null);

  const fetchStationImageSource = useCallback(async (fileName) => {
    if (!fileName) return;
    const imageInfoUrl = `https://commons.wikimedia.org/w/api.php?action=query&prop=imageinfo&iiprop=url|extmetadata&format=json&titles=File:${encodeURIComponent(fileName)}&origin=*`;

    try {
      const response = await fetch(imageInfoUrl);
      const data = await response.json();
      const page = data.query.pages;
      const pageId = Object.keys(page)[0];
      const info = page[pageId].imageinfo?.[0];
      const titleValue = info?.extmetadata?.ObjectName?.value || page[pageId].title || fileName;
      const cleanTitle = String(titleValue).replace(/<[^>]+>/g, '').trim();
      const sourceUrl = info?.descriptionurl;

      if (sourceUrl) {
        setTrainData(prevData => ({
          ...prevData,
          stationImageSourceUrl: sourceUrl,
          stationImageTitle: cleanTitle || page[pageId].title || fileName,
          stationImageFileName: fileName,
        }));
      }
    } catch (error) {
      console.error('Erreur lors de la récupération de la source de l\'image:', error);
    }
  }, []);

  const fetchStationImageFromWikidata = useCallback(async (stationName) => {
    if (!stationName) return;
    const stationKey = normalizeKey(stationName);
    if (imageRequestRef.current.stationKey === stationKey && imageRequestRef.current.source === 'wikipedia') {
      return;
    }
    const searchUrl = `https://www.wikidata.org/w/api.php?action=wbsearchentities&search=${encodeURIComponent(stationName)}&language=fr&format=json&origin=*`;

    try {
      const searchResponse = await fetch(searchUrl);
      const searchData = await searchResponse.json();
      const firstResult = searchData.search?.[0];
      if (!firstResult?.id) {
        return;
      }

      const entityUrl = `https://www.wikidata.org/w/api.php?action=wbgetentities&ids=${firstResult.id}&props=claims|labels&languages=fr&format=json&origin=*`;
      const entityResponse = await fetch(entityUrl);
      const entityData = await entityResponse.json();
      const entity = entityData.entities?.[firstResult.id];
      const imageClaim = entity?.claims?.P18?.[0]?.mainsnak?.datavalue?.value;
      const label = entity?.labels?.fr?.value || stationName;

      if (imageClaim) {
        imageRequestRef.current = { stationKey, source: 'wikidata' };
        const imageUrl = `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(imageClaim)}?width=1600`;
        setTrainData(prevData => (
          prevData.stationImageUrl === imageUrl
            ? prevData
            : {
                ...prevData,
                stationImageUrl: imageUrl,
                stationImageTitle: label,
                stationImageSourceUrl: `https://www.wikidata.org/wiki/${firstResult.id}`,
                stationImageFileName: imageClaim,
                stationImageSource: 'wikidata',
              }
        ));
        fetchStationImageSource(imageClaim);
      }
    } catch (error) {
      console.error('Erreur lors de la récupération de l\'image via Wikidata:', error);
    }
  }, [fetchStationImageSource]);

  const fetchStationImageUrl = useCallback(async (pageTitle, fallbackName) => {
    const imageUrl = `https://fr.wikipedia.org/w/api.php?format=json&action=query&prop=pageimages&piprop=thumbnail|original&pithumbsize=1600&titles=${encodeURIComponent(pageTitle)}&origin=*`;
    const fallbackSourceUrl = `https://fr.wikipedia.org/wiki/${encodeURIComponent(pageTitle)}`;
    const stationKey = normalizeKey(fallbackName || pageTitle);

    try {
      const response = await fetch(imageUrl);
      const data = await response.json();
      const page = data.query.pages;
      const pageId = Object.keys(page)[0];
      const pageImageName = page[pageId].pageimage;
      const image = page[pageId].thumbnail?.source || page[pageId].original?.source;
      if (image) {
        imageRequestRef.current = { stationKey, source: 'wikipedia' };
        setTrainData(prevData => (
          prevData.stationImageUrl === image
            ? prevData
            : {
                ...prevData,
                stationImageUrl: image,
                stationImageTitle: pageTitle,
                stationImageSourceUrl: fallbackSourceUrl,
                stationImageFileName: pageImageName || null,
                stationImageSource: 'wikipedia',
              }
        ));
      }
      if (pageImageName) {
        fetchStationImageSource(pageImageName);
      } else if (!image) {
        fetchStationImageFromWikidata(fallbackName || pageTitle);
      }
    } catch (error) {
      console.error('Erreur lors de la récupération de l\'image Wikipedia de la gare:', error);
    }
  }, [fetchStationImageSource, fetchStationImageFromWikidata]);

  const fetchNearestStationWikiUrl = useCallback(async (stationName) => {
    const searchUrl = `https://fr.wikipedia.org/w/api.php?action=opensearch&search=${encodeURIComponent(stationName)}&format=json&origin=*`;

    try {
      const stationKey = normalizeKey(stationName);
      if (imageRequestRef.current.stationKey === stationKey && trainData.stationImageUrl) {
        return;
      }
      const response = await fetch(searchUrl);
      const data = await response.json();
      const articleUrl = data[3][0];
      const pageTitle = data[1][0];
      if (articleUrl) {
        setTrainData(prevData => ({
          ...prevData,
          nearestStationWikiUrl: articleUrl,
        }));
      }
      if (pageTitle) {
        fetchStationImageUrl(pageTitle, stationName);
      } else {
        fetchStationImageFromWikidata(stationName);
      }
      console.log(data);
    } catch (error) {
      console.error('Erreur lors de la récupération de l\'URL Wikipedia de la gare:', error);
    }
  }, [fetchStationImageUrl, fetchStationImageFromWikidata, trainData.stationImageUrl]);

  const fetchWikiSummary = useCallback((lineName) => {
    if (!lineName) return;

    const url = `https://fr.wikipedia.org/wiki/${encodeURIComponent(lineName)}`;

    fetch(`https://fr.wikipedia.org/w/api.php?format=json&action=query&prop=extracts&exintro&explaintext&redirects=1&titles=${encodeURIComponent(lineName)}&origin=*`)
      .then(response => response.json())
      .then(data => {
        const page = data.query.pages;
        const pageId = Object.keys(page)[0];
        setTrainData(prevData => ({
          ...prevData,
          wikiSummary: page[pageId].extract,
          wikiUrl: url,
        }));
      })
      .catch(error => {
        console.error('Erreur lors de la récupération des données Wikipédia:', error);
      });
  }, []);

  const fetchWikiPages = useCallback((searchQuery) => {
    fetch(`https://api.wikimedia.org/core/v1/wikipedia/fr/search/page?q=${encodeURIComponent(searchQuery)}&limit=5`)
      .then(response => response.json())
      .then(data => {
        const pageTitle = data.pages.length > 0 ? data.pages[0].title : '';
        if (pageTitle) {
          fetchWikiSummary(pageTitle);
        } else {
          console.error('Aucune page correspondante au nom de la ligne trouvée sur Wikipédia.');
        }
      })
      .catch(error => {
        console.error('Erreur lors de la recherche du titre de la page:', error);
      });
  }, [fetchWikiSummary]);

  const fetchAndSetTrainLineData = useCallback((latitude, longitude) => {
    const now = Date.now();
    const last = lastOverpassRef.current.line;
    const distanceSinceLast = last.lat && last.lon
      ? calculateDistance(latitude, longitude, last.lat, last.lon)
      : null;
    const timeSinceLast = now - last.at;
    const isTooSoon = timeSinceLast < 60000;
    const isTooClose = distanceSinceLast !== null && distanceSinceLast < 0.5;

    if (last.inFlight || (isTooSoon && isTooClose)) {
      return;
    }

    lastOverpassRef.current.line = {
      lat: latitude,
      lon: longitude,
      at: now,
      inFlight: true,
    };

    const query = `[out:json];
    (
      way[railway="rail"](around:10,${latitude},${longitude});
    );
    out body;
    >;
    out skel qt;`;
    fetch(`https://overpass.private.coffee/api/interpreter?data=${encodeURIComponent(query)}`)
      .then(response => response.json())
      .then(data => {
        const lineNames = new Set();
        const maxSpeedValues = [];
        data.elements.forEach(element => {
          if (element.type === 'way') {
            if (element.tags && element.tags.name) {
              lineNames.add(element.tags.name);
            }
            if (element.tags && element.tags.maxspeed) {
              const parsedSpeed = parseFloat(String(element.tags.maxspeed).replace(/[^\d.]/g, ''));
              if (!Number.isNaN(parsedSpeed)) {
                maxSpeedValues.push(parsedSpeed);
              }
            }
          }
        });

        const uniqueLineNames = Array.from(lineNames).map(name => {
          return name ? correctLineName(name) : '';
        }).filter(name => name);

        if (uniqueLineNames.length > 0) {
          setTrainData(prevData => ({
            ...prevData,
            lineName: uniqueLineNames.join(', '),
            lineMaxSpeed: maxSpeedValues.length ? Math.max(...maxSpeedValues) : null,
          }));

          fetchWikiPages(uniqueLineNames.join(', '));
        }
      })
      .catch(error => {
        console.error('Erreur lors de la récupération des données Overpass:', error);
      })
      .finally(() => {
        lastOverpassRef.current.line.inFlight = false;
      });
  }, [fetchWikiPages]);

  const findNearestStation = useCallback(async (latitude, longitude, { silent = false } = {}) => {
    const now = Date.now();
    const last = lastOverpassRef.current.station;
    const distanceSinceLast = last.lat && last.lon
      ? calculateDistance(latitude, longitude, last.lat, last.lon)
      : null;
    const timeSinceLast = now - last.at;
    const isTooSoon = timeSinceLast < 60000;
    const isTooClose = distanceSinceLast !== null && distanceSinceLast < 0.5;

    if (last.inFlight || (isTooSoon && isTooClose)) {
      return null;
    }

    lastOverpassRef.current.station = {
      lat: latitude,
      lon: longitude,
      at: now,
      inFlight: true,
    };

    if (silent) {
      setIsStationRefreshing(true);
    }
    for (let distance of distances) {
      const query = `
        [out:json][timeout:25];
        (
          node["railway"="station"]["train"="yes"](around:${distance},${latitude},${longitude});
        );
        out body 1;
      `;

      try {
        let response = await fetch(`https://overpass.private.coffee/api/interpreter?data=${encodeURIComponent(query)}`);
        if (response.status === 504) {
          response = await fetch(`https://overpass.private.coffee/api/interpreter?data=${encodeURIComponent(query)}`);
        }
        const data = await response.json();

        if (data.elements.length > 0) {
          if (silent) {
            setIsStationRefreshing(false);
          }
          lastOverpassRef.current.station.inFlight = false;
          return data.elements[0];
        }
      } catch (error) {
        console.error('Erreur lors de la récupération des données Overpass de la gare la plus proche', error);
      }
    }
    if (silent) {
      setIsStationRefreshing(false);
    }
    lastOverpassRef.current.station.inFlight = false;

    return null;
  }, []);

  const fetchTrainData = useCallback(async ({ silent = false } = {}) => {
    if (isTrainFetchInFlightRef.current) {
      return;
    }
    isTrainFetchInFlightRef.current = true;
    const shouldShowSpinner = !silent && !(trainData.latitude && trainData.longitude);
    if (shouldShowSpinner) {
      setIsLoading(true);
    }

    let savedEndpoint = localStorage.getItem('trainApiEndpoint');

    if (savedEndpoint) {
      try {
        await fetch(savedEndpoint);
      } catch (error) {
        savedEndpoint = null;
        localStorage.removeItem('trainApiEndpoint');
      }
    }

    const apiEndpoints = [
      savedEndpoint || 'https://wifi.sncf/router/api/train/gps',
      'https://wifi.intercites.sncf/router/api/train/gps',
      'https://ouifi.ouigo.com:8084/api/gps',
      'https://wifi.tgv-lyria.com/router/api/train/gps',
      'https://www.ombord.info/api/jsonp/position',
    ];

    try {
      let data;
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 2000);

      for (const endpoint of apiEndpoints) {
        try {
          const response = await fetch(endpoint, { signal: controller.signal });
          const text = await response.text();
          const cleanedText = text.replace(/^\(|\)[^)]*$/g, '');
          data = JSON.parse(cleanedText);

          if (data && data.latitude && data.longitude) {
            localStorage.setItem('trainApiEndpoint', endpoint);
            break;
          }
        } catch (e) {
          console.error(`Failed to fetch data from ${endpoint}`);
        }
      }
      clearTimeout(timeoutId);

      if (data && data.latitude && data.longitude) {
        const nextLat = Number(data.latitude);
        const nextLon = Number(data.longitude);
        const nextSpeedKmh = data.speed ? Number((data.speed * 3.6).toFixed(1)) : 0;
        const prev = lastPositionRef.current;
        let bearing = prev.bearingDeg;
        if (prev.lat !== null && prev.lon !== null && (prev.lat !== nextLat || prev.lon !== nextLon)) {
          bearing = calculateBearing(prev.lat, prev.lon, nextLat, nextLon);
        }

        lastPositionRef.current = {
          lat: nextLat,
          lon: nextLon,
          ts: Date.now(),
          speedKmh: nextSpeedKmh,
          bearingDeg: bearing,
        };

        setError(null);
        setTrainData(prevData => ({
          ...prevData,
          latitude: nextLat,
          longitude: nextLon,
          speed: nextSpeedKmh,
        }));
      } else {
        setError({ message: "Données reçues de l'API sont incomplètes ou dans un format incorrect, le train est impossible à localiser :" + data });
      }

      if (silent) {
        setStationSearchStatus((prev) => (prev === 'not_found' ? 'not_found' : 'refreshing'));
      } else {
        setStationSearchStatus('searching');
      }
      const nearestStation = await findNearestStation(data.latitude, data.longitude, { silent });
      if (nearestStation) {
        const distance = calculateDistance(
          data.latitude,
          data.longitude,
          nearestStation.lat,
          nearestStation.lon
        );

        setTrainData(prevData => ({
          ...prevData,
          nearestStation: nearestStation.tags.name,
          stationDistance: distance.toFixed(2),
          nearestStationLat: nearestStation.lat,
          nearestStationLon: nearestStation.lon,
        }));
        setLiveDistanceKm(distance);
        setStationSearchStatus('found');

        fetchNearestStationWikiUrl(nearestStation.tags.name);
      } else {
        if (trainData.nearestStation) {
          setStationSearchStatus('stale');
        } else if (!silent) {
          setTrainData(prevData => ({
            ...prevData,
            nearestStation: null,
            stationDistance: null,
          }));
          setLiveDistanceKm(null);
          setStationSearchStatus('not_found');
        } else {
          setStationSearchStatus((prev) => (prev === 'not_found' ? 'not_found' : 'idle'));
        }
      }
    } catch (error) {
      console.error("Erreur lors de la récupération des données GPS via l'API du réseau WiFi SNCF:", error);
    } finally {
      setIsLoading(false);
      isTrainFetchInFlightRef.current = false;
    }
  }, [trainData.latitude, trainData.longitude, trainData.nearestStation, findNearestStation, fetchNearestStationWikiUrl]);

  useEffect(() => {
    fetchTrainData();
  }, [fetchTrainData]);

  useEffect(() => {
    const intervalId = setInterval(() => {
      fetchTrainData({ silent: true });
      setRefreshCountdown(refreshIntervalSec);
    }, 15000);

    return () => clearInterval(intervalId);
  }, [fetchTrainData]);

  useEffect(() => {
    const countdownId = setInterval(() => {
      setRefreshCountdown((prev) => (prev <= 1 ? refreshIntervalSec : prev - 1));
    }, 1000);

    return () => clearInterval(countdownId);
  }, []);

  useEffect(() => {
    if (trainData.latitude && trainData.longitude) {
      fetchAndSetTrainLineData(trainData.latitude, trainData.longitude);
    }
  }, [trainData.latitude, trainData.longitude, fetchAndSetTrainLineData]);

  useEffect(() => {
    const intervalId = setInterval(() => {
      if (trainData.nearestStationLat == null || trainData.nearestStationLon == null) {
        return;
      }
      const { lat, lon, ts, speedKmh, bearingDeg } = lastPositionRef.current;
      if (lat == null || lon == null || ts == null) {
        return;
      }
      const elapsedSec = (Date.now() - ts) / 1000;
      const distanceKm = speedKmh ? (speedKmh * elapsedSec) / 3600 : 0;
      let projectedLat = lat;
      let projectedLon = lon;
      if (bearingDeg != null && distanceKm > 0) {
        const projected = projectPosition(lat, lon, distanceKm, bearingDeg);
        projectedLat = projected[0];
        projectedLon = projected[1];
      }
      const liveDistance = calculateDistance(
        projectedLat,
        projectedLon,
        trainData.nearestStationLat,
        trainData.nearestStationLon
      );
      setLiveDistanceKm(liveDistance);
    }, 1000);

    return () => clearInterval(intervalId);
  }, [trainData.nearestStationLat, trainData.nearestStationLon]);

  return {
    autoCenter,
    error,
    fetchTrainData,
    isLoading,
    isStationRefreshing,
    liveDistanceKm,
    refreshCountdown,
    setAutoCenter,
    setRefreshCountdown,
    stationSearchStatus,
    trainData,
  };
};
