import React, { useEffect, useRef } from 'react';
import { viewpointSearchKm } from '../constants/train';

const formatDistance = (distanceKm) => {
  if (distanceKm == null) return '';
  if (distanceKm < 1) {
    return `${Math.round(distanceKm * 1000)} m`;
  }
  return `${distanceKm.toFixed(1)} km`;
};

const getDistanceIntensity = (distanceKm, maxDistanceKm) => {
  if (distanceKm == null || maxDistanceKm <= 0) return 0.15;
  const ratio = Math.max(0, Math.min(1, 1 - distanceKm / maxDistanceKm));
  return 0.15 + ratio * 0.45;
};

const ViewpointsCard = ({ viewpoints, viewpointStatus, onRefresh, queryUrl }) => {
  const previousDistancesRef = useRef({});

  useEffect(() => {
    const nextDistances = {};
    viewpoints.forEach((viewpoint) => {
      if (viewpoint?.id) {
        nextDistances[viewpoint.id] = viewpoint.distanceKm;
      }
    });
    previousDistancesRef.current = nextDistances;
  }, [viewpoints]);

  const maxDistanceKm = viewpointSearchKm || 2;

  return (
    <div className="h-100 p-3 border rounded">
      <style>
        {`
        @keyframes viewpointPulse {
          0% { box-shadow: 0 0 0 0 rgba(255, 193, 7, 0.6); }
          70% { box-shadow: 0 0 0 10px rgba(255, 193, 7, 0); }
          100% { box-shadow: 0 0 0 0 rgba(255, 193, 7, 0); }
        }
        .viewpoint-pulse {
          animation: viewpointPulse 1.6s ease-out 1;
        }
        `}
      </style>
      <div className="d-flex align-items-start justify-content-between mb-3">
        <h5 className="mb-0">Eglises proches</h5>
        <button
          type="button"
          className="btn btn-sm btn-outline-secondary"
          onClick={onRefresh}
          disabled={!onRefresh || viewpointStatus === 'loading'}
          aria-label="Rafraichir les eglises"
          title="Rafraichir"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M23 4v6h-6" />
            <path d="M20.49 15a9 9 0 1 1 2.13-9" />
          </svg>
        </button>
      </div>
      {viewpointStatus === 'loading' && (
        <div className="text-muted">Recherche des eglises...</div>
      )}
      {viewpointStatus === 'error' && (
        <div className="text-muted">Impossible de charger les points de vue pour le moment.</div>
      )}
      {viewpointStatus !== 'loading' && viewpointStatus !== 'error' && viewpoints.length === 0 && (
        <div className="text-muted">Aucune eglise detectee a proximite.</div>
      )}
      {viewpoints.length > 0 && (
        <div className="d-flex flex-column gap-2">
          {viewpoints.map((viewpoint) => {
            const previousDistance = previousDistancesRef.current[viewpoint.id];
            const movingAway = previousDistance != null
              && viewpoint.distanceKm != null
              && viewpoint.distanceKm - previousDistance > 0.05;
            const intensity = getDistanceIntensity(viewpoint.distanceKm, maxDistanceKm);
            const backgroundColor = `rgba(255, 236, 179, ${intensity})`;

            return (
              <div
                key={viewpoint.id}
                className={`d-flex justify-content-between align-items-start rounded p-2 ${movingAway ? 'viewpoint-pulse' : ''}`}
                style={{ backgroundColor }}
              >
                <div>
                  <div className="fw-semibold">{viewpoint.name}</div>
                  <div className="small text-muted">
                    {viewpoint.side ? `Cote ${viewpoint.side}` : 'Orientation non disponible'}
                  </div>
                </div>
                <div className="fw-semibold">{formatDistance(viewpoint.distanceKm)}</div>
              </div>
            );
          })}
        </div>
      )}
      <div className="small text-muted mt-2">
        Donnees OpenStreetMap (amenity=place_of_worship, building=church)
        {queryUrl && (
          <>
            {' '}
            <a href={queryUrl} target="_blank" rel="noopener noreferrer">
              Voir la requete Overpass
            </a>
          </>
        )}
      </div>
    </div>
  );
};

export default ViewpointsCard;
