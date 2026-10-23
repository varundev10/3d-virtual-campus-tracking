// Guards the UI against silent loss, which is what a careless merge does: a conflicted file resolved the wrong way
// still builds and lints. Run by `npm run lint`; fails (exit 1) if
//   - the sign-in page stops rendering the campus mini map,
//   - the dashboard stops rendering the site plan (or its greeting, buttons and quick actions),
//   - campus-buildings is missing, malformed, outside the campus boundary, out of step with the backend seed
//     (DataInitializer.java), or has fewer than MIN_BUILDINGS entries once it is no longer marked provisional.
// Source-level checks only: no browser and no dependencies.
// Usage: node scripts/check-ui.mjs [srcDir] [DataInitializer.java]
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath, pathToFileURL } from 'node:url';

const MIN_BUILDINGS = 10;
const CATEGORIES = ['ACADEMIC_BLOCK', 'CLASSROOM', 'LAB', 'LIBRARY', 'DEPARTMENT', 'ADMINISTRATION', 'HOSTEL', 'FACILITY'];

const here = path.dirname(fileURLToPath(import.meta.url));
const src = path.resolve(process.argv[2] ?? path.join(here, '..', 'src'));
const seedFile = path.resolve(process.argv[3] ?? path.join(here, '..', '..', 'tracking-backend', 'src', 'main', 'java',
  'com', 'campus', 'tracking', 'config', 'DataInitializer.java'));

const read = (file) => {
  const full = path.join(src, file);
  if (!fs.existsSync(full)) return null;
  // Comments are dropped, so a render that was commented out does not count as rendered.
  return fs.readFileSync(full, 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|\s)\/\/.*$/gm, '$1');
};

const results = [];
const check = (name, ok, detail = '') => results.push({ name, ok, detail });

// ---- sign-in page: the campus mini map
const auth = read('pages/auth/AuthPages.jsx');
check('login: AuthPages.jsx exists', auth !== null, 'pages/auth/AuthPages.jsx is missing');
if (auth !== null) {
  check('login: mini map is the showcase 3D scene',
    /import\s+LazyCampusScene\s+from/.test(auth) && /<LazyCampusScene\b[^>]*\bshowcase\b/.test(auth),
    'CampusViewport must render <LazyCampusScene showcase ... />');
  check('login: mini map sits in the .auth-viewport figure', /className=\{?[`"']auth-viewport/.test(auth));
  check('login: the page frame renders the mini map (wide and compact)',
    /<CampusViewport\s*\/>/.test(auth) && /<CampusViewport\s+compact\s*\/>/.test(auth),
    'AuthFrame must render <CampusViewport /> beside the form and <CampusViewport compact /> under it');
  check('login: LoginPage uses that frame', /function LoginPage\b[\s\S]*?<AuthFrame\b/.test(auth));
}

// ---- dashboard: greeting, both buttons, site plan, quick actions
const dash = read('pages/user/UserDashboard.jsx');
check('dashboard: UserDashboard.jsx exists', dash !== null, 'pages/user/UserDashboard.jsx is missing');
if (dash !== null) {
  check('dashboard: renders the site plan',
    /import\s+CampusAtlas\s+from\s+['"][^'"]*CampusAtlas\.jsx['"]/.test(dash) && /<CampusAtlas\b/.test(dash),
    'UserDashboard must import and render <CampusAtlas />');
  check('dashboard: time-of-day greeting', /function\s+greeting\b/.test(dash) && /\{greeting\(\)\}/.test(dash));
  const actions = /className="hero-actions"[\s\S]*?<\/div>/.exec(dash)?.[0] ?? '';
  check('dashboard: hero has both buttons', (actions.match(/<Link\b/g) ?? []).length >= 2,
    'the hero needs "Open the 3D explorer" and "Find a place"');
  check('dashboard: quick actions', /QUICK_ACTIONS\.map/.test(dash) && /className="quick-card"/.test(dash));
}
const atlas = read('components/CampusAtlas.jsx');
check('dashboard: CampusAtlas.jsx draws buildings', atlas !== null && /className="atlas"/.test(atlas) && /atlas-building/.test(atlas),
  'components/CampusAtlas.jsx is missing or no longer draws .atlas / .atlas-building');
const styles = read('styles.css');
check('dashboard: site plan stylesheet is imported', styles !== null && /@import\s+["']\.\/styles\/atlas\.css["']/.test(styles) && read('styles/atlas.css') !== null,
  'styles.css must import styles/atlas.css');

// ---- campus-buildings: real, well-formed, inside the campus, in step with the backend seed, and enough of them
const buildingsFile = path.join(src, 'lib', 'campus-buildings.js');
check('campus-buildings: lib/campus-buildings.js exists', fs.existsSync(buildingsFile), 'the real UCER layout data file is missing');
if (fs.existsSync(buildingsFile)) {
  try {
    const mod = await import(pathToFileURL(buildingsFile).href);
    const list = mod.CAMPUS_BUILDINGS;
    check('campus-buildings: exports a CAMPUS_BUILDINGS array', Array.isArray(list));
    if (Array.isArray(list)) {
      const provisional = mod.CAMPUS_BUILDINGS_PROVISIONAL === true;
      if (list.length >= MIN_BUILDINGS) {
        check(`campus-buildings: at least ${MIN_BUILDINGS} entries`, true);
        if (provisional) console.log('note  campus-buildings: has enough entries, so CAMPUS_BUILDINGS_PROVISIONAL can be removed');
      } else if (provisional) {
        console.log(`note  campus-buildings: PROVISIONAL, ${list.length} of ${MIN_BUILDINGS} entries (the A-D blocks and other facilities are still to come)`);
      } else {
        check(`campus-buildings: at least ${MIN_BUILDINGS} entries`, false, `${list.length} entries and not marked provisional`);
      }

      const bad = list.filter((b) => !(typeof b.code === 'string' && b.code && typeof b.name === 'string' && b.name
        && CATEGORIES.includes(b.category) && Number.isFinite(b.latitude) && Number.isFinite(b.longitude)));
      check('campus-buildings: every entry has code, name, category, latitude and longitude', bad.length === 0,
        `malformed: ${bad.map((b) => b.code ?? JSON.stringify(b)).join(', ')}`);
      const codes = list.map((b) => String(b.code).toUpperCase());
      check('campus-buildings: codes are unique', new Set(codes).size === codes.length);

      const campus = await import(pathToFileURL(path.join(src, 'lib', 'campus.js')).href);
      const outside = list.filter((b) => !campus.isLikelyInsideCampus(b.latitude, b.longitude)).map((b) => b.code);
      check('campus-buildings: every entry is inside the campus boundary', outside.length === 0, `outside: ${outside.join(', ')}`);

      // The explorer list comes from the database, which DataInitializer seeds; the login map and the tests use this
      // file. If the two disagree, clicking a building would select nothing (or the wrong place).
      if (fs.existsSync(seedFile)) {
        const java = fs.readFileSync(seedFile, 'utf8');
        const seeded = [...java.matchAll(/seed\(\s*"([^"]+)"\s*,\s*"([^"]+)"\s*,\s*CampusLocation\.Category\.(\w+)\s*,\s*(-?[\d.]+)\s*,\s*(-?[\d.]+)\s*\)/g)]
          .map(([, code, name, category, lat, lng]) => ({ code, name, category, latitude: Number(lat), longitude: Number(lng) }));
        const same = (a, b) => a.code === b.code && a.name === b.name && a.category === b.category
          && Math.abs(a.latitude - b.latitude) < 1e-9 && Math.abs(a.longitude - b.longitude) < 1e-9;
        const missing = list.filter((b) => !seeded.some((s) => same(s, b))).map((b) => b.code);
        const extra = seeded.filter((s) => !list.some((b) => same(s, b))).map((s) => s.code);
        check('campus-buildings: matches the backend seed (DataInitializer.java)', missing.length === 0 && extra.length === 0,
          `not seeded identically: ${missing.join(', ') || '-'}; seeded but not in campus-buildings: ${extra.join(', ') || '-'}`);
      } else {
        console.log('note  campus-buildings: DataInitializer.java not found, backend seed comparison skipped');
      }
    }
  } catch (error) {
    check('campus-buildings: data file loads', false, error.message);
  }
}

let failed = 0;
for (const { name, ok, detail } of results) {
  if (!ok) failed += 1;
  console.log(`${ok ? 'ok   ' : 'FAIL '} ${name}${!ok && detail ? `\n       ${detail}` : ''}`);
}
console.log(failed ? `\ncheck-ui: ${failed} of ${results.length} checks failed` : `\ncheck-ui: all ${results.length} checks passed`);
process.exitCode = failed ? 1 : 0;
