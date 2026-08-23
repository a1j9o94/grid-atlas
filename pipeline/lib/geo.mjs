// Planar point-in-polygon for lon/lat GeoJSON.
//
// Not d3-geo's geoContains, deliberately. geoContains reasons on the sphere,
// where a ring's winding order decides which side is "inside". ArcGIS exports
// clockwise exterior rings, which the spherical test reads as the complement,
// so every territory appeared to contain every point on Earth: a checkpoint in
// Texas matched utilities in Alaska and Hawaii. At the scale of a service
// territory a planar test is exact enough and cannot be fooled by winding.
export function inRing(ring, x, y) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i], [xj, yj] = ring[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}
export function inPolygon(poly, x, y) {
  if (!inRing(poly[0], x, y)) return false;
  for (let k = 1; k < poly.length; k++) if (inRing(poly[k], x, y)) return false; // hole
  return true;
}
export function contains(feature, [x, y]) {
  const g = feature.geometry;
  if (!g) return false;
  const polys = g.type === "Polygon" ? [g.coordinates]
    : g.type === "MultiPolygon" ? g.coordinates : [];
  return polys.some(p => inPolygon(p, x, y));
}
