import React from 'react';

const TrainHeader = ({
  trainData,
  stationSearchStatus,
  isStationRefreshing,
  isMoving,
  refreshCountdown,
  onRefresh,
  isLoading,
  maxStationSearchKm,
  hasCoordinates,
  distanceKmDisplay,
}) => {
  return (
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
            onClick={onRefresh}
            disabled={isLoading}
          >
            Actualiser maintenant
          </button>
        </div>
      </div>
    </div>
  );
};

export default TrainHeader;
