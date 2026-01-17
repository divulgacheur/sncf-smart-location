import React from 'react';
import { maxStationSearchKm, refreshIntervalSec } from './constants/train';
import { useTrainPosition } from './hooks/useTrainPosition';
import LineContextCard from './components/LineContextCard';
import MapPanel from './components/MapPanel';
import StationImageCredit from './components/StationImageCredit';
import StatsGrid from './components/StatsGrid';
import TrainHeader from './components/TrainHeader';
import ViewpointsCard from './components/ViewpointsCard';

const TrainPosition = () => {
  const {
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
    viewpoints,
    viewpointStatus,
    refreshViewpoints,
    viewpointQueryUrl,
  } = useTrainPosition();

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

  return (
    <div style={backgroundStyle}>
      <div className="container my-0 py-0">
        <TrainHeader
          trainData={trainData}
          stationSearchStatus={stationSearchStatus}
          isStationRefreshing={isStationRefreshing}
          isMoving={isMoving}
          refreshCountdown={refreshCountdown}
          onRefresh={() => {
            fetchTrainData();
            setRefreshCountdown(refreshIntervalSec);
          }}
          isLoading={isLoading}
          maxStationSearchKm={maxStationSearchKm}
          hasCoordinates={hasCoordinates}
          distanceKmDisplay={distanceKmDisplay}
        />
        <StationImageCredit trainData={trainData} />
        {error && <div className="alert alert-danger">Erreur: {error.message}</div>}
        {isLoading ? (
          <div className="text-center">
            <div className="spinner-border text-primary" role="status">
              <span className="sr-only">Chargement...</span>
            </div>
          </div>
        ) : (
          <div>
            <StatsGrid
              speedValue={speedValue}
              isMoving={isMoving}
              speedPercent={speedPercent}
              hasLineMaxSpeed={hasLineMaxSpeed}
              speedMax={speedMax}
              distanceKmDisplay={distanceKmDisplay}
              proximityPercent={proximityPercent}
              trainData={trainData}
            />
            <div className="row g-3">
              <div className="col-lg-6">
                <LineContextCard wikiSummary={trainData.wikiSummary} />
              </div>
              <div className="col-lg-6">
                <MapPanel
                  mapCenter={mapCenter}
                  mapZoom={mapZoom}
                  hasCoordinates={hasCoordinates}
                  autoCenter={autoCenter}
                  setAutoCenter={setAutoCenter}
                />
              </div>
              <div className="col-lg-6">
                <ViewpointsCard
                  viewpoints={viewpoints}
                  viewpointStatus={viewpointStatus}
                  onRefresh={refreshViewpoints}
                  queryUrl={viewpointQueryUrl}
                />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default TrainPosition;
