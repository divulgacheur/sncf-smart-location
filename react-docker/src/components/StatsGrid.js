import React from 'react';
import googleMapsIconUrl from '../google-maps-icon.svg';
import openStreetMapIconUrl from '../openstreetmap-icon.svg';

const formatCoordinate = (value) => {
  if (value === null || value === undefined) return '--';
  return Number(value).toFixed(5);
};

const StatsGrid = ({
  speedValue,
  isMoving,
  speedPercent,
  hasLineMaxSpeed,
  speedMax,
  distanceKm,
  distanceKmDisplay,
  proximityPercent,
  trainData,
}) => {
  const stationName = trainData.nearestStation;
  const stationPrefix = (() => {
    if (!stationName) return 'de';
    const trimmed = stationName.trim();
    if (!trimmed) return 'de';
    const firstChar = trimmed[0].toLowerCase();
    return 'aeiouyh'.includes(firstChar) ? "d'" : 'de';
  })();
  const isStationaryNearStation = Boolean(
    stationName
      && !isMoving
      && distanceKm !== null
      && distanceKm <= 0.3
  );
  const proximityLabel = (() => {
    if (!stationName) {
      return distanceKmDisplay ? `${distanceKmDisplay} km` : 'N/A';
    }
    if (distanceKmDisplay) {
      return isStationaryNearStation
        ? `Stationné à ${stationName}`
        : `À ${distanceKmDisplay} km ${stationPrefix} ${stationName}`;
    }
    return `Gare la plus proche : ${stationName}`;
  })();

  return (
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
            {proximityLabel}
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
  );
};

export default StatsGrid;
