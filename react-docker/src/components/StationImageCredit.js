import React from 'react';

const getStationImageAlt = (imageSource) => {
  if (imageSource === 'wikipedia') {
    return "Photo issue d'une recherche du nom de la gare.";
  }
  if (imageSource === 'wikidata') {
    return 'Photo issue d\'une recherche via Wikidata.';
  }
  return 'Source de la photo non précisée.';
};

const StationImageCredit = ({ trainData }) => {
  if (!trainData.stationImageUrl || !(trainData.stationImageTitle || trainData.stationImageSourceUrl)) {
    return null;
  }

  const altText = getStationImageAlt(trainData.stationImageSource);

  return (
    <div className="text-end small text-muted mb-3">
      <span title={altText}>Photo :</span>{' '}
      <span className="visually-hidden">{altText}</span>
      <a
        href={
          trainData.stationImageFileName
            ? `https://commons.wikimedia.org/wiki/File:${encodeURIComponent(trainData.stationImageFileName)}`
            : trainData.stationImageUrl
        }
        target="_blank"
        rel="noopener noreferrer"
        aria-label={`${trainData.stationImageTitle || "Source de l'image"} (${altText})`}
      >
        {trainData.stationImageTitle || 'Source de l\'image'}
      </a>
    </div>
  );
};

export default StationImageCredit;
