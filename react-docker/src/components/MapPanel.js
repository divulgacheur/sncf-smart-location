import React, { useEffect } from 'react';
import { MapContainer, TileLayer, Marker, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import trainIconUrl from '../train-icon.svg';

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

const MapPanel = ({ mapCenter, mapZoom, hasCoordinates, autoCenter, setAutoCenter }) => {
  return (
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
  );
};

export default MapPanel;
