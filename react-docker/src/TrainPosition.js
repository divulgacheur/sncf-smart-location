import React, { useState, useEffect } from 'react';
import 'bootstrap/dist/css/bootstrap.min.css';


const TrainPosition = () => {

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  

  const [trainData, setTrainData] = useState({
    latitude: null,
    longitude: null,
    speed: null,
    nearestStation: null,
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
  

  const fetchTrainData = () => {
    setIsLoading(true);
    fetch('https://www.ombord.info/api/jsonp/position')
      .then(response => response.text())
      .then(text => {
        const cleanedText = text.replace(/^\(|\)[^)]*$/g, '');
        const data = JSON.parse(cleanedText);
        setTrainData(prevData => ({
          ...prevData,
          latitude: data.latitude,
          longitude: data.longitude,
          speed: data.speed ? (data.speed * 3.6).toFixed(2) + ' km/h' : null // Convertit en km/h et arrondit à deux décimales
        }));
        setIsLoading(false);
      })
      .catch(error => {
        console.error('Erreur lors de la récupération des données:', error);
        setIsLoading(false); // Définir isLoading sur false en cas d'erreur
      });
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
        <div>
          <p>Latitude : {trainData.latitude}</p>
          <p>Longitude : {trainData.longitude}</p>
          <p>Vitesse : {trainData.speed}</p>
          <p>Nom de la ligne : <a href={trainData.wikiUrl} target="_blank" rel="noopener noreferrer" >{trainData.lineName}</a></p>
          {trainData.wikiUrl && (
            <p>
              {formatTextWithLineBreaks(trainData.wikiSummary)}
            </p>
          )}
        </div>
      )}
    </div>
  );

  
};

export default TrainPosition;
