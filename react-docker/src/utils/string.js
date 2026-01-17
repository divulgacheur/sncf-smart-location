export const correctLineName = (lineName) => lineName.replace(/\bSt\b/g, 'Saint');

export const normalizeKey = (value) => (
  value
    ? value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
    : ''
);
