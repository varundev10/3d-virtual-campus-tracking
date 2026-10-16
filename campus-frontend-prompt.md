# 3D Virtual Campus Tracking: Cinematic Frontend Upgrade Prompt

> Isse Claude Code (ya kisi coding agent) mein project folder khol kar paste karo.
> Pehle Plan mode mein plan approve karwao, phir implement karwao. Git branch bana lo: `git checkout -b ui-redesign`

---

## ROLE

You are a senior creative developer (Three.js / WebGL / React-style frontend) working INSIDE my existing project: **"3D Virtual Campus Tracking"**. Upgrade its **FRONTEND ONLY** into a cinematic, award-level, interactive digital twin of a campus, suitable for a final-year engineering demo.

## INSPIRATION (patterns only, never copy code, assets or layout)

### 1. bruno-simon.com (PRIMARY REFERENCE, 3D feel must be inspired by this)
- Loading screen with REAL asset-loading progress that melts into the live 3D world (no fake timers).
- One clear "Start" moment, then the world is immediately alive.
- Playful, physical, toy-like feel: soft lighting, chunky friendly shapes, small delightful details, things that react when you touch or approach them.
- The camera glides and eases, it never jumps or snaps.
- The 3D world IS the interface; UI is minimal and floats around it.
- Points of interest feel like places you discover, not rows in a list.
- Subtle ambient life (drifting particles, light movement, idle camera drift).

### 2. webdesignawards.io/technology/three-js
- Polish, restraint, strong typography, smooth integration between HTML UI and the 3D canvas, premium micro-interactions.

### 3. mesh3d.gallery
- Expressive lighting, materials, emissive accents, shader-style glow, atmosphere and depth.

---

## HARD RULES (project must keep working)

1. Do NOT touch backend, API contracts, DB schema, auth logic, tracking algorithms, route/path algorithms, Socket.IO event names, or campus coordinates.
2. Do NOT replace real data with mock data, fake stats, fake routes or dead buttons.
3. Do NOT rebuild the campus geometry or the scene lifecycle. Reuse existing scene, camera, controls, building objects and render loop. ONE animation loop only.
4. Inspect first: framework, routes, dependencies, 3D code, building data, camera controls, user vs admin screens, login flow. Write a short summary of what exists before changing anything. Add a new dependency only if truly needed, and justify it.
5. Work in small steps. After each step run lint / type-check / build and fix errors before moving on. Never claim something works without verifying it.

---

## VISUAL IDENTITY (free to change colors, fonts, layout)

- Pick a palette that suits the existing campus scene. Default idea: obsidian/midnight surfaces, ice-white type, electric cyan primary accent, amber or lime for selected states.
- Create design tokens (CSS variables): colors, semantic states, type scale, spacing, radii, borders, shadows/glow, motion durations and easing, z-index layers.
- Thin borders, subtle translucent panels. No random neon, no giant headings covering the map, no generic dashboard look.

---

## 3D EFFECTS (MUST-HAVE, THIS IS THE CORE OF THE UPGRADE)

The final result must feel unmistakably 3D, not a flat dashboard with a canvas. Implement these using the EXISTING scene and renderer:

- **Depth and lighting:** warm directional "sun" light with soft shadows, ambient/hemisphere fill, and gentle rim light on buildings so shapes read clearly. Night mode uses emissive windows, lamp glows and light pools on paths.
- **Atmosphere:** soft distance fog that matches the sky color, subtle gradient sky, optional light-weight volumetric or light-shaft feel (fake it cheaply, no heavy post-processing).
- **Materials:** better material feel on existing meshes (roughness/metalness tuning, subtle env-map reflections, slight edge highlight on hover/selection).
- **Building interaction in 3D:** on hover the building lifts slightly or glows with an outline/emissive pulse; on select it stands out while the rest of the campus dims a little; smooth scale/position easing, never sudden jumps.
- **Cinematic camera:** intro fly-through along a smooth curved path, then eased fly-to on selection with a slight orbit, subtle FOV change, and gentle idle drift when the user is inactive. Damping on orbit controls so movement feels weighty.
- **3D markers and labels:** floating pin markers that bob and pulse, labels that billboard toward the camera and fade/scale with distance (no clutter when zoomed out).
- **Route in 3D:** glowing animated tube/line that draws itself from origin to destination, with a moving light pulse along it (only when real route data exists).
- **Ambient life:** light floating particles (dust, fireflies at night), drifting clouds or soft light movement, all cheap and toggleable.
- **Parallax / depth cues in UI:** panels may subtly shift with mouse movement over the canvas, but never at the cost of usability.
- **Optional (if performance allows):** very light bloom on emissive elements only, depth-of-field blur during the intro only. Disable automatically on low-power devices.

Performance guard: keep 60 fps target on a normal laptop, cap pixel ratio, auto-downgrade shadows/particles/bloom when FPS drops, and keep every effect behind a quality setting (Low / Medium / High) so the project stays usable everywhere.

---

## FEATURES

### 1. Cinematic Intro (uses the REAL campus scene)
- Dark screen -> real loading progress -> title **"CAMPUS / DIGITAL TWIN"** -> slow camera reveal of the actual campus -> settle into the interactive view -> "Explore your campus" + **[Enter Campus]**.
- **[Skip Intro]** visible from the first frame. Never block navigation or trap the user on loading.
- Plays once per session, not on every route change. Respect `prefers-reduced-motion`.
- Graceful fallback if WebGL fails or assets are slow (clear message + non-3D building list).
- Works without audio (audio optional, muted by default).

### 2. Campus as Hero (Bruno-style world feel)
- 3D viewport takes most of the screen; UI floats with minimal obstruction.
- Building hover highlight + cursor change; click selects + highlights; camera smoothly flies to it; floating info panel with only real data; clear Deselect and "Back to overview".
- Better labels and markers; markers gently pulse or float. Route line and selected building always visible.
- Warm, soft, playful lighting with good shadows; buildings should feel like touchable objects.
- Camera animations must never fight user input (cancel on user drag/scroll).

### 3. Smart Navigation UI
- Search with keyboard-navigable suggestions, destination selector, origin selector (only if supported), compact map controls, navigation status, Reset route / Reset selection.
- If real route data exists: animated route reveal, distinct origin and destination markers, distance/time ONLY from real data.
- If no route engine exists, do not fake one. Improve building exploration instead and state the limitation.

### 4. Interaction Language
- Ctrl/Cmd+K command palette (search buildings, switch day/night, reset view, go to admin/user if allowed by role).
- Shortcuts must not trigger while typing. Refined hover/press/focus states, tooltips, drawers/dialogs, smooth panel transitions, lightweight loading states.
- Motion guides attention only; no constant decorative animation.

### 5. Day / Night Mode
- Toggle changes lighting, sky/background, material emissive and label styles WITHOUT recreating the scene and WITHOUT losing camera position, selected building or active route.
- If part of it is unsafe, implement the best compatible version and document the limitation.

### 6. User View
- Minimal header, immersive 3D explorer, search, building details, existing profile/account controls, proper empty / loading / permission-denied / error states. No unnecessary analytics cards.

### 7. Admin View (same design system)
- Restyle sidebar, summary cards, existing charts, tables, filters, location forms, user management, status badges, dialogs, toasts.
- Real data only. Keep all existing features and authorization behavior exactly as is.

### 8. Responsive + Accessibility
- Desktop: large viewport, floating panels. Tablet: adaptive panels. Mobile: full-width canvas, bottom-sheet building details, touch-friendly controls, collapsible secondary panels, zero horizontal overflow.
- Integrate touch with existing controls (no second input system).
- Visible focus rings, accessible button names, good contrast, keyboard-accessible dialogs/search, a non-canvas way to find and select buildings, reduced-motion support.

### 9. Performance
- Animate transform/opacity in UI. Avoid re-rendering the 3D scene from UI state changes. Clean up listeners/resources.
- Cap pixel ratio, skip heavy post-processing, auto-reduce optional effects (particles, shadows, glow) on low-power devices.

---

## OPTIONAL BONUS (only after everything above works and builds cleanly)

- Bruno-style playful touches: ambient particles, idle camera drift, animated marker pulses, small easter eggs near landmarks.
- Optional "free explore" mode (for example a small avatar or vehicle that moves around the campus), ONLY if it fits the existing scene and controls without conflicting with them.
- Anything experimental must be behind a toggle and must never affect tracking, routes or data.

---

## PROCESS

1. Inspect the project and summarize what exists.
2. Design tokens.
3. Layout + intro.
4. 3D presentation (lighting, labels, markers).
5. Building selection + camera focus.
6. Search / navigation.
7. User + admin views.
8. Day/night + command palette.
9. Responsive + accessibility.
10. Lint / type-check / build.
11. Manual test: login, user route, admin route, building select, tracking, API calls, desktop + mobile sizes.
12. Fix regressions.

## FINAL REPORT

List changed files, features implemented, build/lint results, what you actually tested, and remaining limitations. No mockups or proposals: implement everything directly in this project.
