import { Link } from '../lib/router.jsx';
import { PLACEHOLDER_SCALE, buildingSize, locationToPlaceholderPoint } from '../lib/campus.js';
import { categoryColor, categoryLabel } from '../lib/locationCategories.js';

// A site plan of the campus: the same generated layout the 3D scene shows, drawn as an isometric SVG from the real
// campus locations. Each building links to that place in the explorer; the trail is the user's own last shared
// positions. It is deliberately light (no WebGL), so it can sit on the dashboard next to the page's content.
//
// Projection: x runs down-right, z down-left, so north (-z) points up and to the right. Everything is drawn in
// scene units (see lib/campus.js) scaled by SCALE pixels.
const SCALE = 2.55;
const KX = Math.cos(Math.PI / 6) * SCALE;
const KY = Math.sin(Math.PI / 6) * SCALE;
const RISE = SCALE * 0.92;
const GROUND = { x: 85, z: 60 };
const DROP = -11 / RISE; // the plate's thickness, as a height below the ground (11 px)
const GEOFENCE = [[-72, -50], [66, -48], [74, 42], [-58, 52]];
const ROADS = [
  { x0: -75, x1: 75, z0: -3.5, z1: 3.5 },
  { x0: 3, x1: 9, z0: -47.5, z1: 47.5 },
];
const PLAZA = { x: 6, z: 0, radius: 7.5 }; // where the two roads cross (see scene/greenery.js)
const METERS_PER_UNIT = 1 / PLACEHOLDER_SCALE; // see locationToPlaceholderPoint
const SCALE_BAR_METERS = 50;

const project = (x, z, y = 0) => [(x - z) * KX, (x + z) * KY - y * RISE];
const fmt = (n) => n.toFixed(1);
const points = (list) => list.map(([x, z, y]) => project(x, z, y).map(fmt).join(',')).join(' ');

// A few trees scattered over the lawn, placed from a tiny seeded generator so the plan looks the same every time.
function treeSpots(places) {
  let seed = 31;
  const random = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  const spots = [];
  for (let attempt = 0; attempt < 300 && spots.length < 22; attempt += 1) {
    const x = (random() * 2 - 1) * 70;
    const z = (random() * 2 - 1) * 46;
    const clear = Math.abs(z) > 8 && Math.abs(x - 6) > 7.5 && Math.hypot(x - PLAZA.x, z - PLAZA.z) > 12
      && !places.some((p) => Math.abs(x - p.x) < p.width / 2 + 7 && Math.abs(z - p.z) < p.depth / 2 + 7)
      && !spots.some((s) => Math.hypot(s.x - x, s.z - z) < 9);
    if (clear) spots.push({ x, z, r: 1.7 + random() * 1.1 });
  }
  return spots.sort((a, b) => a.x + a.z - (b.x + b.z));
}

// Window quads on the two faces that face the viewer: the one along x at the front (z + d/2) and the one along z on the
// right (x + w/2).
function windowQuads({ x, z, width, depth, height }) {
  const rows = Math.max(1, Math.floor((height - 2.5) / 3.2));
  const quads = [];
  const cols = (span) => Math.max(1, Math.floor((span - 3) / 3.8));
  const along = (span, count) => Array.from({ length: count }, (_, c) => -span / 2 + 1.6 + (c * (span - 3.2)) / Math.max(count - 1, 1));
  along(width, cols(width)).forEach((u) => {
    for (let r = 0; r < rows; r += 1) {
      const y0 = 2.2 + r * 3.2;
      const a = x + u;
      const zz = z + depth / 2;
      quads.push(points([[a, zz, y0], [a + 1.7, zz, y0], [a + 1.7, zz, y0 + 1.9], [a, zz, y0 + 1.9]]));
    }
  });
  along(depth, cols(depth)).forEach((u) => {
    for (let r = 0; r < rows; r += 1) {
      const y0 = 2.2 + r * 3.2;
      const b = z + u;
      const xx = x + width / 2;
      quads.push(points([[xx, b, y0], [xx, b + 1.7, y0], [xx, b + 1.7, y0 + 1.9], [xx, b, y0 + 1.9]]));
    }
  });
  return quads;
}

function Building({ place, index }) {
  const {
    x, z, width: w, depth: d, height: h,
  } = place;
  const x0 = x - w / 2;
  const x1 = x + w / 2;
  const z0 = z - d / 2;
  const z1 = z + d / 2;
  const [labelX, labelY] = project(x, z, h + 13);
  const [pinX, pinY] = project(x, z, h + 7);
  const [stemX, stemY] = project(x, z, h + 1.8);
  const labelWidth = Math.max(40, place.code.length * 7.6 + 18);
  const color = categoryColor(place.category);

  return (
    <Link
      to={`/app/explore?location=${encodeURIComponent(place.code)}`}
      className="atlas-place"
      style={{ '--i': index }}
      aria-label={`${place.name}, ${categoryLabel(place.category)}. Open in the 3D explorer.`}
    >
      <g className="atlas-building">
        <polygon className="atlas-shadow" points={points([[x0 + 3, z0 + 3, 0], [x1 + 8, z0 + 3, 0], [x1 + 8, z1 + 8, 0], [x0 + 3, z1 + 8, 0]])} />
        <polygon className="atlas-wall atlas-wall-front" points={points([[x0, z1, 0], [x1, z1, 0], [x1, z1, h], [x0, z1, h]])} />
        <polygon className="atlas-wall atlas-wall-side" points={points([[x1, z1, 0], [x1, z0, 0], [x1, z0, h], [x1, z1, h]])} />
        {windowQuads(place).map((quad) => <polygon key={quad} className="atlas-window" points={quad} />)}
        <polygon className="atlas-roof" points={points([[x0 - 0.7, z0 - 0.7, h + 1.2], [x1 + 0.7, z0 - 0.7, h + 1.2], [x1 + 0.7, z1 + 0.7, h + 1.2], [x0 - 0.7, z1 + 0.7, h + 1.2]])} />
        <polygon className="atlas-core" points={points([[x - w * 0.34, z - d * 0.3, h + 3.6], [x - w * 0.08, z - d * 0.3, h + 3.6], [x - w * 0.08, z - d * 0.02, h + 3.6], [x - w * 0.34, z - d * 0.02, h + 3.6]])} />
        <line className="atlas-stem" x1={stemX} y1={stemY} x2={pinX} y2={pinY + 6} />
        <polygon className="atlas-pin" style={{ fill: color }} points={`${fmt(pinX)},${fmt(pinY - 8)} ${fmt(pinX + 6)},${fmt(pinY)} ${fmt(pinX)},${fmt(pinY + 8)} ${fmt(pinX - 6)},${fmt(pinY)}`} />
        <g className="atlas-label" transform={`translate(${fmt(labelX)} ${fmt(labelY - 14)})`}>
          <rect x={-labelWidth / 2} y={-11} width={labelWidth} height={22} rx={11} />
          <text y={0.5} textAnchor="middle" dominantBaseline="middle">{place.code}</text>
        </g>
      </g>
    </Link>
  );
}

export default function CampusAtlas({ locations, trail = [] }) {
  const places = (locations ?? []).map((location, index) => ({
    ...location,
    ...locationToPlaceholderPoint(location.latitude, location.longitude),
    ...buildingSize(index),
  })).sort((a, b) => a.x + a.z - (b.x + b.z));
  const trees = treeSpots(places);
  const walked = trail
    .filter((ping) => ping.latitude != null && ping.longitude != null)
    .map((ping) => locationToPlaceholderPoint(ping.latitude, ping.longitude))
    .reverse(); // oldest first, so the line ends on the latest position
  const barUnits = SCALE_BAR_METERS / METERS_PER_UNIT;
  const barX0 = -332;
  const barY0 = 128;
  const barX1 = barX0 + barUnits * KX;
  const barY1 = barY0 + barUnits * KY;
  const corners = [[-GROUND.x, -GROUND.z], [GROUND.x, -GROUND.z], [GROUND.x, GROUND.z], [-GROUND.x, GROUND.z]];

  return (
    <figure className="atlas">
      <svg viewBox="-345 -236 690 452" role="group" aria-label="Site plan of the campus. Each building is a link to that place in the 3D explorer.">
        <g className="atlas-plate">
          <polygon className="atlas-side atlas-side-front" points={`${points([[-GROUND.x, GROUND.z, 0], [GROUND.x, GROUND.z, 0], [GROUND.x, GROUND.z, DROP], [-GROUND.x, GROUND.z, DROP]])}`} />
          <polygon className="atlas-side atlas-side-right" points={`${points([[GROUND.x, GROUND.z, 0], [GROUND.x, -GROUND.z, 0], [GROUND.x, -GROUND.z, DROP], [GROUND.x, GROUND.z, DROP]])}`} />
          <polygon className="atlas-ground" points={points(corners.map(([x, z]) => [x, z, 0]))} />
          <g className="atlas-grid">
            {Array.from({ length: 9 }, (_, i) => {
              const x = -GROUND.x + ((i + 1) * GROUND.x * 2) / 10;
              return <polyline key={`x${x}`} points={points([[x, -GROUND.z, 0], [x, GROUND.z, 0]])} />;
            })}
            {Array.from({ length: 5 }, (_, i) => {
              const z = -GROUND.z + ((i + 1) * GROUND.z * 2) / 6;
              return <polyline key={`z${z}`} points={points([[-GROUND.x, z, 0], [GROUND.x, z, 0]])} />;
            })}
          </g>
          {ROADS.map((r) => (
            <polygon key={`${r.x0}${r.z0}`} className="atlas-road" points={points([[r.x0, r.z0, 0], [r.x1, r.z0, 0], [r.x1, r.z1, 0], [r.x0, r.z1, 0]])} />
          ))}
          <ellipse
            className="atlas-plaza"
            cx={project(PLAZA.x, PLAZA.z)[0]}
            cy={project(PLAZA.x, PLAZA.z)[1]}
            rx={PLAZA.radius * Math.SQRT2 * KX}
            ry={PLAZA.radius * Math.SQRT2 * KY}
          />
          <polygon className="atlas-fence" points={points(GEOFENCE.map(([x, z]) => [x, z, 0]))} />
        </g>

        {trees.map((tree) => {
          const [tx, ty] = project(tree.x, tree.z);
          return (
            <g key={`${tree.x}${tree.z}`} className="atlas-tree">
              <line x1={tx} y1={ty} x2={tx} y2={ty - tree.r * 3.2} />
              <ellipse cx={tx} cy={ty - tree.r * 4.6} rx={tree.r * 3.1} ry={tree.r * 2.6} />
            </g>
          );
        })}

        {walked.length > 1 && (
          <polyline className="atlas-trail" points={walked.map(({ x, z }) => project(x, z, 0.5).map(fmt).join(',')).join(' ')} />
        )}
        {walked.map(({ x, z }, i) => {
          const [cx, cy] = project(x, z, 0.5);
          const latest = i === walked.length - 1;
          return (
            <g key={`${x}${z}${i}`} className={`atlas-ping ${latest ? 'is-latest' : ''}`}>
              {latest && <ellipse className="atlas-ping-ring" cx={cx} cy={cy} rx={13} ry={7.5} />}
              <circle cx={cx} cy={cy} r={latest ? 5 : 3} />
            </g>
          );
        })}

        {places.map((place, index) => <Building key={place.id ?? place.code} place={place} index={index} />)}

        <g className="atlas-compass" transform="translate(-290 -172)" aria-hidden="true">
          <circle r="26" />
          <g transform={`rotate(${fmt((Math.atan2(project(0, -1)[1], project(0, -1)[0]) * 180) / Math.PI + 90)})`}>
            <polygon points="0,-19 6,6 0,2 -6,6" />
          </g>
          <text y="-33" textAnchor="middle">N</text>
        </g>

        <g className="atlas-scale" aria-hidden="true">
          <polyline points={`${fmt(barX0)},${fmt(barY0 - 6)} ${fmt(barX0)},${fmt(barY0)} ${fmt(barX1)},${fmt(barY1)} ${fmt(barX1)},${fmt(barY1 - 6)}`} />
          <text x={barX1 + 10} y={barY1 + 4}>{SCALE_BAR_METERS} m</text>
        </g>
      </svg>
      <figcaption className="atlas-caption">
        {places.length > 0
          ? `Site plan of the campus with ${places.length} mapped place${places.length === 1 ? '' : 's'}. Pick a building to open it in 3D.`
          : 'Site plan of the campus. Buildings appear here once campus locations are added.'}
      </figcaption>
    </figure>
  );
}
