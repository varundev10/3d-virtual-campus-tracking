// Guards the UI against silent loss, which is what a careless merge does: a conflicted file resolved the wrong way
// still builds and lints. Run by `npm run lint`; fails (exit 1) if
//   - the sign-in page stops rendering the campus mini map,
//   - the dashboard stops rendering the site plan (or its greeting, buttons and quick actions), or
//   - the campus-buildings data has fewer than MIN_BUILDINGS entries.
// Source-level checks only: no browser and no dependencies. Usage: node scripts/check-ui.mjs [srcDir]
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath, pathToFileURL } from 'node:url';

const MIN_BUILDINGS = 10;
// The real UCER layout (campus-buildings) is still to come. Until the file exists the check says so out loud and
// skips it; flip this to true in the commit that adds the data so that deleting it fails from then on.
const BUILDINGS_REQUIRED = false;

const here = path.dirname(fileURLToPath(import.meta.url));
const src = path.resolve(process.argv[2] ?? path.join(here, '..', 'src'));

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

// ---- campus-buildings: enough real entries
function findBuildings(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      const found = findBuildings(full);
      if (found) return found;
    } else if (/^campus-buildings\.(m?js|json)$/.test(entry.name)) {
      return full;
    }
  }
  return null;
}

const buildingsFile = findBuildings(src);
if (buildingsFile === null) {
  if (BUILDINGS_REQUIRED) check('campus-buildings: data file exists', false, 'no campus-buildings.{js,json} under src/');
  else console.log('note  campus-buildings: no data file yet (the real UCER layout is pending); skipped');
} else {
  try {
    const mod = buildingsFile.endsWith('.json')
      ? { default: JSON.parse(fs.readFileSync(buildingsFile, 'utf8')) }
      : await import(pathToFileURL(buildingsFile).href);
    const list = mod.default ?? mod.CAMPUS_BUILDINGS ?? mod.campusBuildings ?? Object.values(mod).find((value) => typeof value === 'object');
    const count = Array.isArray(list) ? list.length : Object.keys(list?.buildings ?? list ?? {}).length;
    check(`campus-buildings: at least ${MIN_BUILDINGS} entries`, count >= MIN_BUILDINGS,
      `${path.relative(src, buildingsFile)} has ${count}`);
  } catch (error) {
    check('campus-buildings: data file loads', false, `${path.relative(src, buildingsFile)}: ${error.message}`);
  }
}

let failed = 0;
for (const { name, ok, detail } of results) {
  if (!ok) failed += 1;
  console.log(`${ok ? 'ok   ' : 'FAIL '} ${name}${!ok && detail ? `\n       ${detail}` : ''}`);
}
console.log(failed ? `\ncheck-ui: ${failed} of ${results.length} checks failed` : `\ncheck-ui: all ${results.length} checks passed`);
process.exitCode = failed ? 1 : 0;
