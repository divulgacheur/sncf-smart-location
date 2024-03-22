import React, { useState, useEffect } from 'react';

const TrainPosition = () => {

  const [isLoading, setIsLoading] = useState(false);
  const [isStationLoading, setIsStationLoading] = useState(false);
  const [error, setError] = useState(null);
  

  const [trainData, setTrainData] = useState({
    latitude: null,
    longitude: null,
    speed: null,
    nearestStation: null,
    nearestStationWikiUrl: null,
    stationDistance: null,
    lineName: null,
    wikiSummary: null,
    wikiUrl: null
  });

  useEffect(() => {
    fetchTrainData();
  }, []);

  useEffect(() => {
    if (trainData.latitude && trainData.longitude) {
      fetchAndSetTrainLineData(trainData.latitude, trainData.longitude);
    }
  }, [trainData.latitude, trainData.longitude]);
  

  const fetchTrainData = async () => {
    setIsLoading(true);
  
    // Retrieve the saved endpoint from localStorage
    let savedEndpoint = localStorage.getItem('trainApiEndpoint');
  
    // Check if the train type has changed and clear the saved endpoint
    try {
      const response = await fetch(savedEndpoint);
    } catch (error) {
      savedEndpoint = null;
      localStorage.removeItem('trainApiEndpoint');
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
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 2000)
  
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
  
      if (data && data.latitude && data.longitude) {
        setTrainData(prevData => ({
          ...prevData,
          latitude: data.latitude,
          longitude: data.longitude,
          speed: (data.speed ? (data.speed * 3.6).toFixed(1) : 0 )
        }));
      } else {
        setError({ message: "Données reçues de l'API sont incomplètes ou dans un format incorrect, le train est impossible à localiser :" + data });
      }
  
      const nearestStation = await findNearestStation(data.latitude, data.longitude);
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
          stationDistance: distance.toFixed(2)
        }));
  
        fetchNearestStationWikiUrl(nearestStation.tags.name);
      } else {
        setTrainData(prevData => ({
          ...prevData,
          nearestStation: "Aucune gare trouvée à proximité",
          stationDistance: null
        }));
      }
    } catch (error) {
      console.error("Erreur lors de la récupération des données GPS via l'API du réseau WiFi SNCF:", error);
    } finally {
      setIsLoading(false);
    }
  };
  
  
  

  const fetchAndSetTrainLineData = (latitude, longitude) => {
    const query = `[out:json];
    (
      way[railway="rail"](around:10,${latitude},${longitude});
    );
    out body;
    >;
    out skel qt;`;
    setIsLoading(true);
    fetch(`https://overpass-api.de/api/interpreter?data=${encodeURIComponent(query)}`)
      .then(response => response.json())
      .then(data => {
        setIsLoading(false);
        const lineNames = new Set();
        data.elements.forEach(element => {
          if (element.type === "way") {
            lineNames.add(element.tags.name);
          }
        });

        const uniqueLineNames = Array.from(lineNames).map(name => {
          return name ? correctLineName(name) : ''; // Vérifier si name n'est pas undefined
        }).filter(name => name); // Filtrer les chaînes vides

        if (uniqueLineNames.length > 0) {
          setTrainData(prevData => ({
            ...prevData,
            lineName: uniqueLineNames.join(', ')
          }));
      
          fetchWikiPages(uniqueLineNames.join(', '));
        }
      })
      .catch(error => {
        console.error('Erreur lors de la récupération des données Overpass:', error);
      });
  };

  const correctLineName = (lineName) => {
    return lineName.replace(/\bSt\b/g, 'Saint');
  };

  const fetchWikiPages = (searchQuery) => {
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
  };

  const fetchWikiSummary = (lineName) => {
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
  };
  
  const formatTextWithLineBreaks = (text) => {
    return text.split('\n').map((line, index) => (
      <React.Fragment key={index}>
        {line}
        <br />
      </React.Fragment>
    ));
  };

  const distances = [500, 1000, 2000, 5000, 10000, 20000, 30000];

  const findNearestStation = async (latitude, longitude) => {
    setIsStationLoading(true);
    for (let distance of distances) {
      const query = `
        [out:json][timeout:25];
        (
          node["railway"="station"]["train"="yes"](around:${distance},${latitude},${longitude});
        );
        out body 1;
      `;
  
      try {
        const response = await fetch(`https://overpass-api.de/api/interpreter?data=${encodeURIComponent(query)}`);
        const data = await response.json();
  
        if (data.elements.length > 0) {
          setIsStationLoading(false);
          return data.elements[0];
        }
      } catch (error) {
        console.error('Erreur lors de la récupération des données Overpass de la gare la plus proche', error);
      }
    }
  
    return null; // Retourne null si aucune gare n'est trouvée
  };

   
  function calculateDistance(lat1, lon1, lat2, lon2) {
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
  }

  const fetchNearestStationWikiUrl = async (stationName) => {
    const searchUrl = `https://fr.wikipedia.org/w/api.php?action=opensearch&search=${encodeURIComponent(stationName)}&format=json&origin=*`;
  
    try {
      const response = await fetch(searchUrl);
      const data = await response.json();
      const articleUrl = data[3][0]; // L'URL de l'article est le premier élément du quatrième élément du tableau résultant
      if (articleUrl) {
        setTrainData(prevData => ({
          ...prevData,
          nearestStationWikiUrl: articleUrl,
        }));
      }
      console.log(data);

    } catch (error) {
      console.error('Erreur lors de la récupération de l\'URL Wikipedia de la gare:', error);
    }
  };
  
  
  return (
    <div className="container my-4">
      <h1 className="text-center mb-4">Position du Train</h1>
      {error && <div className="alert alert-danger">Erreur: {error.message}</div>}
      {isLoading ? (
        <div className="text-center">
          <div className="spinner-border text-primary" role="status">
            <span className="sr-only">Chargement...</span>
          </div>
        </div>
      ) : (
        <div className="card">
          <div className="card-body">
            <h5 className="card-title">Informations sur la ligne</h5>
            <p className="card-text">Latitude : {trainData.latitude}</p>
            <p className="card-text">Longitude : {trainData.longitude}</p>
            <p className="card-text">Vitesse : {trainData.speed > 0.5 ? trainData.speed + ' km/h': "train à l'arrêt"}</p>
            <p className="card-text">Nom de la ligne : {trainData.lineName && <a href={trainData.wikiUrl} target="_blank" rel="noopener noreferrer">{trainData.lineName}</a>}</p>
            <p className="card-text">
              Gare la plus proche :{" "}
              {isStationLoading ? (
                <span>Recherche en cours...</span>
              ) : (
                trainData.nearestStation && (
                  <>
                    {trainData.nearestStation}
                    {trainData.stationDistance && ` (${trainData.stationDistance} km)`}
                    {trainData.nearestStationWikiUrl && (
                      <a href={trainData.nearestStationWikiUrl} target="_blank" rel="noopener noreferrer"> (Voir sur Wikipedia)</a>
                    )}
                  </>
                )
              )}
              {!isStationLoading && !trainData.nearestStation && "Aucune gare trouvée à proximité"}
            </p>
            <p className="card-text"><a href={`https://signal.eu.org/rail/spot/${trainData.latitude}/${trainData.longitude}`} target="_blank" rel="noopener noreferrer">Trains passants à proximité de l'emplacement actuel</a></p>

            {trainData.wikiSummary && (
              <div>
                <h5 className="card-title">Résumé de la ligne</h5>
                <p className="card-text">{formatTextWithLineBreaks(trainData.wikiSummary)}</p>
              </div>
            )}
          <div className="mt-3">
            <iframe
              src={`https://www.openrailwaymap.org/mobile.php?lat=${trainData.latitude}&lon=${trainData.longitude}&zoom=15`}
              style={{ width: '100%', height: '500px', border: '0' }}
              title="Open Railway Map"
              allowFullScreen
            ></iframe>
          </div>
          </div>
        </div>
        
      )}
    </div>
  );
  

  
};

export default TrainPosition;
