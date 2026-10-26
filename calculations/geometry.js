/** Pure geometry in SI units. Rings includes the center: 1 → 1, 2 → 7, 3 → 19. */
export function geometry(rings, flatToFlatM) {
  if (!Number.isInteger(rings) || rings < 1 || rings > 100) throw new Error('Rings must be an integer from 1 to 100.');
  if (!Number.isFinite(flatToFlatM) || flatToFlatM <= 0) throw new Error('Flat-to-flat dimension must be positive.');
  const n = rings - 1;
  const circumradiusM = flatToFlatM / Math.sqrt(3);
  const segmentCount = 1 + 3 * n * (n + 1);
  const segmentAreaM2 = Math.sqrt(3) / 2 * flatToFlatM ** 2;
  const coordinates = [];
  for (let q = -n; q <= n; q++) {
    for (let r = Math.max(-n, -q - n); r <= Math.min(n, -q + n); r++) {
      coordinates.push({q, r, x:1.5 * circumradiusM * q, y:Math.sqrt(3) * circumradiusM * (r + q / 2), ring:Math.max(Math.abs(q),Math.abs(r),Math.abs(q+r))});
    }
  }
  return {
    rings, flatToFlatM, segmentCount, segmentAreaM2,
    totalAreaM2:segmentAreaM2 * segmentCount,
    circumradiusM, inradiusM: flatToFlatM / 2,
    perimeterM:2 * Math.sqrt(3) * flatToFlatM,
    diameterM:2 * circumradiusM * Math.sqrt(3 * n * n + 3 * n + 1),
    widthM:(3 * n + 2) * circumradiusM,
    heightM:(2 * n + 1) * flatToFlatM,
    diameterDefinition:'Diameter of the smallest circle enclosing all segment vertices; gaps are not modeled.',
    coordinates
  };
}

export const calculateGeometry = geometry;
