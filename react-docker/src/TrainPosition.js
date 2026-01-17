import React, { useState, useEffect, useRef, useCallback } from 'react';
import { MapContainer, TileLayer, Marker, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import trainIconUrl from './train-icon.svg';
import googleMapsIconUrl from './google-maps-icon.svg';
import openStreetMapIconUrl from './openstreetmap-icon.svg';

const trainIcon = L.icon({
  iconUrl: trainIconUrl,
  iconSize: [40, 40],
  iconAnchor: [20, 32],
});

const MapUpdater = ({ center, autoCenter }) => {
  const map = useMap();

  useEffect(() => {
    if (!center || !autoCenter) return;
    map.panTo(center, { animate: true });
  }, [center, autoCenter, map]);

  return null;
};

const MapInteractionHandler = ({ onUserInteract }) => {
  useMapEvents({
    dragstart: () => onUserInteract(),
  });

  return null;
};

const distances = [500, 1000, 2000, 5000, 10000, 20000, 30000];
const maxStationSearchKm = Math.max(...distances) / 1000;

const calculateDistance = (lat1, lon1, lat2, lon2) => {
  const R = 6371; // Rayon de la Terre en kilomètres
  const dLat = (lat2 - lat1) * Math.PI / 180;  // Conversion en radians
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = R * c; // Distance en kilomètres
  return distance;
};

const calculateBearing = (lat1, lon1, lat2, lon2) => {
  const toRad = (value) => (value * Math.PI) / 180;
  const toDeg = (value) => (value * 180) / Math.PI;
  const phi1 = toRad(lat1);
  const phi2 = toRad(lat2);
  const deltaLon = toRad(lon2 - lon1);
  const y = Math.sin(deltaLon) * Math.cos(phi2);
  const x = Math.cos(phi1) * Math.sin(phi2) -
    Math.sin(phi1) * Math.cos(phi2) * Math.cos(deltaLon);
  const brng = (toDeg(Math.atan2(y, x)) + 360) % 360;
  return brng;
};

const projectPosition = (lat, lon, distanceKm, bearingDeg) => {
  const R = 6371;
  const toRad = (value) => (value * Math.PI) / 180;
  const toDeg = (value) => (value * 180) / Math.PI;
  const brng = toRad(bearingDeg);
  const d = distanceKm / R;
  const phi1 = toRad(lat);
  const lambda1 = toRad(lon);

  const phi2 = Math.asin(
    Math.sin(phi1) * Math.cos(d) + Math.cos(phi1) * Math.sin(d) * Math.cos(brng)
  );
  const lambda2 = lambda1 + Math.atan2(
    Math.sin(brng) * Math.sin(d) * Math.cos(phi1),
    Math.cos(d) - Math.sin(phi1) * Math.sin(phi2)
  );

  return [toDeg(phi2), toDeg(lambda2)];
};

const correctLineName = (lineName) => lineName.replace(/\bSt\b/g, 'Saint');
const normalizeKey = (value) => (
  value
    ? value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
    : ''
);

const TrainPosition = () => {

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const refreshIntervalSec = 15;
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
  

  const [trainData, setTrainData] = useState({
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
    wikiUrl: null
  });
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
      const articleUrl = data[3][0]; // L'URL de l'article est le premier élément du quatrième élément du tableau résultant
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
          wikiUrl: url
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
          console.error("Aucune page correspondante au nom de la ligne trouvée sur Wikipédia.");

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
          if (element.type === "way") {
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
          return name ? correctLineName(name) : ''; // Vérifier si name n'est pas undefined
        }).filter(name => name); // Filtrer les chaînes vides

        if (uniqueLineNames.length > 0) {
          setTrainData(prevData => ({
            ...prevData,
            lineName: uniqueLineNames.join(', '),
            lineMaxSpeed: maxSpeedValues.length ? Math.max(...maxSpeedValues) : null
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
  
    return null; // Retourne null si aucune gare n'est trouvée
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
  
    // Retrieve the saved endpoint from localStorage
    let savedEndpoint = localStorage.getItem('trainApiEndpoint');
  
    // Check if the train type has changed and clear the saved endpoint
    if (savedEndpoint) {
      try {
        await fetch(savedEndpoint);
      } catch (error) {
        savedEndpoint = null;
        localStorage.removeItem('trainApiEndpoint');
      }
    }

    // List of possible API endpoints based on train types
    const apiEndpoints = [
      savedEndpoint || 'https://wifi.sncf/router/api/train/gps',
      'https://wifi.intercites.sncf/router/api/train/gps',
      'https://ouifi.ouigo.com:8084/api/gps', // Using HTTP since it's a unique case, adjust if needed
      'https://wifi.tgv-lyria.com/router/api/train/gps',
      'https://www.ombord.info/api/jsonp/position', 
      // Add more endpoints for other train types as needed
    ];
  
    try {
      let data;
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 2000);
  
      // Iterate through API endpoints until successful or exhaust the list
      for (const endpoint of apiEndpoints) {
        try {
          const response = await fetch(endpoint, { signal: controller.signal });
          const text = await response.text();
          const cleanedText = text.replace(/^\(|\)[^)]*$/g, '');
          data = JSON.parse(cleanedText);
  
          // If data is successfully obtained, save the endpoint to localStorage and break out of the loop
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
          speed: nextSpeedKmh
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
          nearestStationLon: nearestStation.lon
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
            stationDistance: null
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
  }, [fetchTrainData, refreshIntervalSec]);

  useEffect(() => {
    const countdownId = setInterval(() => {
      setRefreshCountdown((prev) => (prev <= 1 ? refreshIntervalSec : prev - 1));
    }, 1000);

    return () => clearInterval(countdownId);
  }, [refreshIntervalSec]);

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

  const formatTextWithLineBreaks = (text) => {
    return text.split('\n').map((line, index) => (
      <React.Fragment key={index}>
        {line}
        <br />
      </React.Fragment>
    ));
  };
  
  const speedValue = Number(trainData.speed) || 0;
  const hasLineMaxSpeed = Number.isFinite(trainData.lineMaxSpeed);
  const speedMax = hasLineMaxSpeed ? trainData.lineMaxSpeed : 320;
  const speedPercent = Math.min(100, (speedValue / speedMax) * 100);
  const distanceKm = liveDistanceKm !== null
    ? liveDistanceKm
    : (trainData.stationDistance ? Number(trainData.stationDistance) : null);
  const distanceKmDisplay = distanceKm !== null ? distanceKm.toFixed(2) : null;
  const distanceMax = 25;
  const proximityPercent = distanceKm !== null
    ? Math.max(0, 100 - (distanceKm / distanceMax) * 100)
    : 0;
  const isMoving = speedValue > 0.5;
  const hasCoordinates = trainData.latitude && trainData.longitude;
  const mapCenter = hasCoordinates
    ? [Number(trainData.latitude), Number(trainData.longitude)]
    : [46.7, 2.3];
  const mapZoom = hasCoordinates ? 13 : 6;
  const backgroundStyle = trainData.stationImageUrl
    ? {
        backgroundImage: `linear-gradient(rgba(255, 255, 255, 0.6), rgba(255, 255, 255, 0.6)), url(${trainData.stationImageUrl})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundAttachment: 'fixed',
        minHeight: '100vh',
      }
    : {
        background: 'linear-gradient(135deg, #f7f7f7, #eef6ff)',
        minHeight: '100vh',
      };

  const formatCoordinate = (value) => {
    if (value === null || value === undefined) return '--';
    return Number(value).toFixed(5);
  };

  const getStationImageAlt = () => {
    if (trainData.stationImageSource === 'wikipedia') {
      return "Photo issue d'une recherche du nom de la gare.";
    }
    if (trainData.stationImageSource === 'wikidata') {
      return "Photo issue d'une recherche via Wikidata.";
    }
    return 'Source de la photo non précisée.';
  };

  
  return (
    <div style={backgroundStyle}>
      <div className="container my-0 py-0">
        <div
          className="p-4 mb-4 rounded-3 border"
          style={{
            background: 'linear-gradient(135deg, #fff2e6, #e8f6ff)',
          }}
        >
          <div className="d-flex flex-wrap align-items-center justify-content-between gap-3">
            <div>
              <h1 className="mb-1">Position du train</h1>
              <div className="text-muted">
                {trainData.lineName ? `Ligne: ${trainData.lineName}` : 'Ligne en cours de détection'}
              </div>
              <div className="text-muted">
                {trainData.nearestStation ? (
                  <>
                    Gare la plus proche :{' '}
                    {trainData.nearestStationWikiUrl ? (
                      <a href={trainData.nearestStationWikiUrl} target="_blank" rel="noopener noreferrer">
                        {trainData.nearestStation}
                      </a>
                    ) : (
                      trainData.nearestStation
                    )}
                    {distanceKmDisplay && ` (${distanceKmDisplay} km)`}
                  </>
                ) : stationSearchStatus === 'not_found' && hasCoordinates ? (
                  `Aucune gare trouvée dans un rayon de ${maxStationSearchKm} km`
                ) : (
                  'Gare la plus proche : en attente'
                )}
                {isStationRefreshing && trainData.nearestStation && (
                  <span className="text-muted"> (actualisation en cours...)</span>
                )}
              </div>
            </div>
            <div className="text-end">
              <div className={`badge ${isMoving ? 'bg-success' : 'bg-secondary'} mb-2`}>
                {isMoving ? 'En circulation' : 'À l\'arrêt'}
              </div>
              <div className="small text-muted mb-2">
                Actualisation dans {refreshCountdown} s
              </div>
              <button
                type="button"
                className="btn btn-sm btn-outline-primary"
                onClick={() => {
                  fetchTrainData();
                  setRefreshCountdown(refreshIntervalSec);
                }}
                disabled={isLoading}
              >
                Actualiser maintenant
              </button>
            </div>
          </div>
        </div>
        {trainData.stationImageUrl && (trainData.stationImageTitle || trainData.stationImageSourceUrl) && (
          <div className="text-end small text-muted mb-3">
            <span title={getStationImageAlt()}>Photo :</span>{' '}
            <span className="visually-hidden">{getStationImageAlt()}</span>
            <a
              href={
                trainData.stationImageFileName
                  ? `https://commons.wikimedia.org/wiki/File:${encodeURIComponent(trainData.stationImageFileName)}`
                  : trainData.stationImageUrl
              }
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`${trainData.stationImageTitle || "Source de l'image"} (${getStationImageAlt()})`}
            >
              {trainData.stationImageTitle || 'Source de l\'image'}
            </a>
          </div>
        )}
        {error && <div className="alert alert-danger">Erreur: {error.message}</div>}
        {isLoading ? (
          <div className="text-center">
            <div className="spinner-border text-primary" role="status">
              <span className="sr-only">Chargement...</span>
            </div>
          </div>
        ) : (
          <div>
            <div className="row g-3 mb-3">
              <div className="col-md-4">
                <div className="h-100 p-3 border rounded">
                  <h5 className="mb-2">Vitesse</h5>
                  <div className="display-6">{isMoving ? `${speedValue} km/h` : 'Train à l\'arrêt'}</div>
                  <div className="progress mt-3" style={{ height: '10px' }}>
                    <div
                      className={`progress-bar ${isMoving ? 'bg-success' : 'bg-secondary'}`}
                      role="progressbar"
                      style={{ width: `${speedPercent}%` }}
                      aria-valuenow={speedPercent}
                      aria-valuemin="0"
                      aria-valuemax="100"
                    ></div>
                  </div>
                  {hasLineMaxSpeed && (
                    <div className="small text-muted mt-2">Vitesse maximum de la ligne : {speedMax} km/h</div>
                  )}
                </div>
              </div>
              <div className="col-md-4">
                <div className="h-100 p-3 border rounded">
                  <h5 className="mb-2">Proximité de la gare la plus proche</h5>
                  <div className="display-6">
                  {distanceKmDisplay ? `${distanceKmDisplay} km` : 'N/A'}
                  </div>
                  <div className="progress mt-3" style={{ height: '10px' }}>
                    <div
                      className="progress-bar bg-warning"
                      role="progressbar"
                      style={{ width: `${proximityPercent}%` }}
                      aria-valuenow={proximityPercent}
                      aria-valuemin="0"
                      aria-valuemax="100"
                    ></div>
                  </div>
                  <div className="small text-muted mt-2">Plus proche → barre plus remplie</div>
                </div>
              </div>
              <div className="col-md-4">
              <div className="h-100 p-3 border rounded">
                <div className="d-flex align-items-center justify-content-between mb-2">
                  <h5 className="mb-0">Coordonnées GPS</h5>
                  <div className="d-flex align-items-center gap-2">
                    <a
                      href={`https://www.google.com/maps?q=${trainData.latitude},${trainData.longitude}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      title="Ouvrir dans Google Maps"
                    >
                      <img
                        src={googleMapsIconUrl}
                        alt="Google Maps"
                        style={{ width: '22px', height: '22px' }}
                      />
                    </a>
                    <a
                      href={`https://www.openstreetmap.org/?mlat=${trainData.latitude}&mlon=${trainData.longitude}#map=16/${trainData.latitude}/${trainData.longitude}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      title="Ouvrir dans OpenStreetMap"
                    >
                      <img
                        src={openStreetMapIconUrl}
                        alt="OpenStreetMap"
                        style={{ width: '22px', height: '22px' }}
                      />
                    </a>
                  </div>
                </div>
                <div className="d-flex flex-column gap-2">
                  <div className="d-flex justify-content-between">
                    <span className="text-muted">Latitude</span>
                    <span>{formatCoordinate(trainData.latitude)}</span>
                  </div>
                  <div className="d-flex justify-content-between">
                    <span className="text-muted">Longitude</span>
                    <span>{formatCoordinate(trainData.longitude)}</span>
                  </div>
                  <div className="small text-muted">Précision à 5 décimales</div>
                  <a
                    href={`https://signal.eu.org/rail/spot/${trainData.latitude}/${trainData.longitude}`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Trains à proximité de l'emplacement actuel
                  </a>
                </div>
              </div>
            </div>
          </div>

            <div className="row g-3">
              <div className="col-lg-6">
                <div className="h-100 p-3 border rounded">
                  <h5 className="mb-3">Contexte de la ligne ferroviaire</h5>
                {trainData.wikiSummary && (
                  <div className="mt-3">
                    <h6 className="mb-2">Résumé de la ligne ferroviaire</h6>
                      <p className="card-text">{formatTextWithLineBreaks(trainData.wikiSummary)}</p>
                    </div>
                  )}
                </div>
              </div>
              <div className="col-lg-6">
                <div className="h-100 p-3 border rounded">
                  <h5 className="mb-3">Carte du réseau</h5>
                  <MapContainer
                    center={mapCenter}
                    zoom={mapZoom}
                    style={{ width: '100%', height: '420px' }}
                    scrollWheelZoom
                  >
                    <TileLayer
                      attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                      url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                    />
                    <TileLayer
                      attribution='&copy; <a href="https://www.openrailwaymap.org">OpenRailwayMap</a>'
                      url="https://{s}.tiles.openrailwaymap.org/standard/{z}/{x}/{y}.png"
                      opacity={0.8}
                    />
                    {hasCoordinates && <Marker position={mapCenter} icon={trainIcon} />}
                  <MapUpdater
                    center={hasCoordinates ? mapCenter : null}
                    autoCenter={autoCenter}
                  />
                    <MapInteractionHandler onUserInteract={() => setAutoCenter(false)} />
                  </MapContainer>
                  <div className="d-flex flex-wrap align-items-center gap-2 mt-2">
                    <button
                      type="button"
                      className={`btn btn-sm ${autoCenter ? 'btn-primary' : 'btn-outline-primary'}`}
                      onClick={() => setAutoCenter((prev) => !prev)}
                    >
                      {autoCenter ? 'Suivi activé' : 'Suivi désactivé'}
                    </button>
                    {!autoCenter && (
                      <button
                        type="button"
                        className="btn btn-sm btn-outline-secondary"
                        onClick={() => setAutoCenter(true)}
                      >
                        Recentrer la carte
                      </button>
                    )}
                  </div>
                  <div className="small text-muted mt-2">
                    Fond OpenStreetMap + surcouche OpenRailwayMap
                  </div>
                </div>
              </div>
            </div>
          </div>
          
        )}
      </div>
    </div>
  );
  

  
};

export default TrainPosition;
