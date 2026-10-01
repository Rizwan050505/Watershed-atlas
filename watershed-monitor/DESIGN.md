# Design System: Watershed Atlas

## 1. Visual Theme & Atmosphere

An evidence-first geospatial workspace with the clarity of a field atlas and the depth of a physical terrain model. Keep the public story open and calm; make the signed-in workspace information-rich but scannable. Density 6/10, variance 7/10, motion 5/10. Use one large, offset hero composition and let watershed geometry carry the visual identity. A 3D terrain surface should feel like a measured model, not a game map.

## 2. Color Palette & Roles

- **Atlas Canvas** (`#F6F8F5`) — primary page background.
- **Paper Surface** (`#FFFFFF`) — form and information surfaces.
- **Charcoal Ink** (`#243531`) — headings and primary text; never pure black.
- **Field Graphite** (`#61716B`) — supporting text, labels, and metadata.
- **Survey Line** (`#DCE5DC`) — quiet borders and map divisions.
- **Watershed Teal** (`#285C4D`) — the single accent for primary actions, selected states, and focus rings. Keep saturation below 80%; no secondary accent palette.
- **Terrain Relief** (`#809A72` to `#B1BD8D`) — illustration-only elevation tints, not interactive state colors.

No purple/blue neon. No luminous outer glows. Use tinted, low-opacity shadows only where depth explains hierarchy.

## 3. Typography Rules

- **Display and body:** Arial with Helvetica and Segoe UI fallbacks; use locally available system fonts so text stays readable without a font download.
- **Body:** 16px minimum for regular copy and controls, 14px minimum for secondary metadata, 1.6 line height, and a 65-character reading measure.
- **Mono:** Geist Mono for coordinates, IDs, scale values, and timestamps.
- Body text remains at least 16px; secondary metadata remains at least 14px. Keep Devanagari line-height generous and remove tracking on Hindi copy.
- Use font weight, spacing, and color to create hierarchy; do not solve hierarchy by shrinking supporting text.
- Serif type is not used in the dashboard.

## 4. Component Stylings

- **Buttons:** 44px minimum touch target. Accent fill for one primary action; secondary actions are quiet outlines or text. Press feedback is a brief 1px transform, with a visible keyboard focus ring and no glow.
- **Cards:** Use white surfaces and a fine survey-line border. Reserve shadows for the active terrain inspector or modal; otherwise use spacing and separators.
- **Inputs:** Persistent label above the control, 44px minimum height, and inline error/help copy below. Preserve entered values after server errors.
- **Loading:** Stable-width skeletons with reduced-motion support; avoid generic spinning marks.
- **Errors:** Show the actionable reason beside the form. Distinguish API unavailable, duplicate account, and invalid input instead of reducing all failures to “Failed to fetch.”
- **Empty states:** Explain what data is missing, who can provide it, and what a user can do next.
- **Public contact details:** Show the organization, monitored email, public office address, and optional phone as separate labeled fields. Use a dashed, warm-tinted treatment for any missing value. Never make a sample email or phone link clickable.
- **Project setup notes:** Keep missing details explicit and actionable: tell the owner what information to provide and where to configure it. Do not make a visitor mistake a setup prompt for verified project data.

## 5. Layout Principles

- Use a left-aligned, asymmetric split hero: concise story and actions on the left; a single 3D terrain relief on the right.
- Keep text and terrain in distinct grid cells. Nothing overlaps the headline or form.
- Build the terrain from layered SVG/CSS surfaces with contour paths, a watershed channel, scale/context annotations, and clearly labeled illustrative data. Use CSS transforms and SVG rather than an unneeded WebGL dependency.
- Use 12-column desktop grids and consistent 8px spacing increments. Contain content at 1440px.
- Avoid three equal feature cards; use a two-column, staggered module grid with deliberate negative space.
- Collapse all multi-column compositions to one column below 768px, preserving a map-first flow and no horizontal scrolling.
- Keep a consistent outer gutter on every public and authenticated page. Let wide data tables scroll inside their own container, never across the browser viewport.
- Keep the workspace sidebar and map inspector readable at desktop sizes; collapse the sidebar into the horizontal module navigation on narrower screens.

## 6. Motion & Interaction

- Animate the terrain with a restrained transform/opacity float; keep its cycle slow and its displacement under 8px.
- Use short ease-out transitions for menus, tabs, focus, and buttons. Use staggered reveals only for the first viewport and never delay form access.
- Respect `prefers-reduced-motion`; remove perpetual motion in that mode.
- Keep motion on `transform` and `opacity`. No animated layout dimensions, map pan on load, or scroll-jacking.
- Controls retain at least a 44px touch target. Preserve clear keyboard focus and allow every animated surface to settle for reduced-motion users.

## 7. Project Content Rules

- The public contact section marks the sample email and missing organization, address, and phone as items to complete. Use the exact configuration keys and field guidance in `PROJECT_CONTENT_GUIDE.md`.
- Indore is the pilot search district only. Keep the exact watershed, block/tehsil, authoritative boundary, and agency confirmation pending until those details are supplied.
- Label all synthetic boundary, intervention, and observation records as illustrative. The Bhuvan LULC 2015–16 overlay is regional context; it is not a current scene or a verified result.

## 8. Anti-Patterns (Banned)

- No emojis, Inter, generic serif fonts, pure black, neon, purple glows, or saturated multi-accent palettes.
- No generic centered hero, stacked overlapping cards, three equal feature cards, or tiny metadata used as essential information.
- No unlabeled 3D/Satellite imagery that could be mistaken for official pilot data.
- No fake accuracy claims, fabricated ISRO/SRISHTI-DRISHTI analysis, or decorative map data presented as field evidence.
- No “Failed to fetch” as the only registration error explanation.
- No filler prompts, fake emails presented as real contacts, or generic AI copywriting clichés.
- No custom cursors, heavy 3D/WebGL dependency, motion without a reduced-motion path, or horizontal mobile overflow.
