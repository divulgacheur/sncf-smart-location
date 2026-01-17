import React from 'react';

const formatTextWithLineBreaks = (text) => {
  return text.split('\n').map((line, index) => (
    <React.Fragment key={index}>
      {line}
      <br />
    </React.Fragment>
  ));
};

const LineContextCard = ({ wikiSummary }) => {
  return (
    <div className="h-100 p-3 border rounded">
      <h5 className="mb-3">Contexte de la ligne ferroviaire</h5>
      {wikiSummary && (
        <div className="mt-3">
          <h6 className="mb-2">Résumé de la ligne ferroviaire</h6>
          <p className="card-text">{formatTextWithLineBreaks(wikiSummary)}</p>
        </div>
      )}
    </div>
  );
};

export default LineContextCard;
