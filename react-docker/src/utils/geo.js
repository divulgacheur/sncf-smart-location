export const calculateDistance = (lat1, lon1, lat2, lon2) => {
  const R = 6371; // Rayon de la Terre en kilometres
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

export const calculateBearing = (lat1, lon1, lat2, lon2) => {
  const toRad = (value) => (value * Math.PI) / 180;
  const toDeg = (value) => (value * 180) / Math.PI;
  const phi1 = toRad(lat1);
  const phi2 = toRad(lat2);
  const deltaLon = toRad(lon2 - lon1);
  const y = Math.sin(deltaLon) * Math.cos(phi2);
  const x = Math.cos(phi1) * Math.sin(phi2) -
    Math.sin(phi1) * Math.cos(phi2) * Math.cos(deltaLon);
  return (toDeg(Math.atan2(y, x)) + 360) % 360;
};

export const projectPosition = (lat, lon, distanceKm, bearingDeg) => {
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
