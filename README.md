# Star Dial

An interactive astronomy learning app for seasonal constellations, with a star dial, constellation atlas, 3D sky exploration, student activities, reflections, and a teacher report dashboard.

Built with HTML, CSS, JavaScript, and an inline copy of Three.js r160. No build step, package installation, backend, or API key is needed.

## Final release — 17 October 2026

This release includes the separate app sections, astronomy-themed interface, complete 88-constellation Star Atlas, shared Bataan reference for Star Dial and Free Roam, and the **CER-only assessment: Claim, Evidence, and Reasoning**. Rebuttal is no longer part of the form, report, or teacher exports. Older saved reports remain readable. The offline cache version is `v20`.

For the final ZIP, extract it first, then follow [GITHUB_UPLOAD.md](GITHUB_UPLOAD.md). It explains the two browser-upload batches and GitHub Pages setup. The archive contains the complete source, local assets, references, licenses, and verification tests.

## Visual design

The interface uses an astronomy field-guide style: dark navy surfaces, brass actions, pale-blue chart details, thin catalogue rules, and an annotated constellation on Home. Oxanium gives headings their astronomy-instrument character; Source Sans 3 keeps instructions and controls easy to read. Both variable fonts are bundled locally (about 674 KiB total) and cached for offline use. Font sources and SIL Open Font Licenses are in `assets/fonts/` and `THIRD_PARTY_NOTICES.md`.

## App sections

Home provides shortcuts to Star Dial, Free Roam, and Assessment. Use the sidebar on desktop or the **Sections** menu on smaller screens to open one section at a time, including the warm-up, explanation, atlas, reflection, and teacher dashboard. Switching sections keeps current inputs and tool settings in memory. Browser Back/Forward and direct links such as `#dial`, `#explore`, and `#lesson` are supported.

## Bataan reference point

Star Dial and Free Roam's 3D sky share **Bataan National High School, Barangay Bagong Silang, Balanga City, Bataan** at **14.6753° N, 120.5201° E**. These published coordinates come from DepEd's recipient-school list, PDF page 3, school ID 300702. This is a specific point within the province, not its centroid or the user's GPS location.

Both views use **day 2 of the selected month in 2026, 9:00 PM PHT (13:00 UTC)**. The initial month is September; the app remembers later choices locally. Changing the dial month updates Free Roam's horizon. `observer.js` supplies the shared month, coordinates and US Naval Observatory sidereal-time and horizon calculations, together with the Earth marker, location labels and Star Atlas latitude reference.

The dial selects four patterns whose plotted main stars are above the geometric horizon, ranked by their mean altitude. Cards report the direction and altitude of the brightest plotted star; their sketches show pattern shapes, not scaled sky placement. Southern constellations are eligible when they rise above Bataan's horizon. This is an approximate J2000 teaching model without precession, refraction, terrain or weather. Free Roam's background stars are decorative. The Flat map remains an equatorial overview with a separate mid-August 2026 Sun/planet snapshot; these dated objects are omitted from the shared 3D horizon. The assessment keeps its separate seasonal schematic.

Open **Our Bataan reference point** in Free Roam for a student explanation and source links. [BATAAN_REFERENCE.md](BATAAN_REFERENCE.md) includes the presentation explanation, verified source row, calculation and limits. The source PDF and explanation are available offline after the app finishes downloading.

## Star Atlas content and sources

Star Atlas contains a referenced entry for each of the 88 IAU constellations: the official name, English meaning, pronunciation, abbreviation, Latin genitive, approximate declination range and observing notes for the app's Bataan reference latitude (14.6753° N). All 89 IAU / Sky & Telescope charts are included locally; Serpens has separate head and tail charts. Eleven entries also include a short, sourced closer-look feature.

Students can search names, English meanings, abbreviations and the included catalog objects. Filters distinguish northern, southern, equatorial and the 13 constellations along the Sun's path. A quick guide explains the chart terms. Each entry links to its primary references, and **Where the information comes from** provides the complete downloadable [reference list](ATLAS_REFERENCES.md).

Charts default to night colors, with an original-color toggle and full-size/print links. The bundled GIFs add approximately 11.1 MiB to the initial offline download. Online source articles and print PDFs are not cached. The latitude notes are approximate geometric calculations, not a prediction of what is visible tonight; see the reference list for the method and limits.

The app needs no build step to run. To update the reviewed atlas data, use Node.js 18+:

```sh
node scripts/prepare-atlas-iau.cjs --boundaries
node scripts/download-atlas-charts.cjs
node scripts/build-atlas.cjs
```

Review any changed source information before publishing. The build script bundles the JSON sources, checks the charts, and updates the atlas entries in the service-worker file list. If Node reports an untrusted certificate on a managed Windows machine, recent Node versions support `--use-system-ca` to use the trusted operating-system certificate store. Do not disable certificate verification.

## Put the app on GitHub

1. Create a new public repository on GitHub (for example, `star-dial`).
2. Choose **uploading an existing file** on the empty repository page, or **Add file > Upload files** in an existing repository.
3. Upload the contents of this folder, keeping `index.html` at the repository root. Extract a ZIP before uploading. Use two batches: first everything except `assets/`, then the entire `assets/` folder, preserving its subfolders. Do not upload the enclosing folder or a ZIP in place of the files. Include the dotfiles (`.gitignore`, `.gitattributes`, and `.nojekyll`). See [GITHUB_UPLOAD.md](GITHUB_UPLOAD.md) for details.
4. Commit the files to `main`.

## Publish a live app with GitHub Pages

1. In the repository, open **Settings > Pages**.
2. Under **Build and deployment**, choose **Deploy from a branch**.
3. Select **main** and **/ (root)**, then **Save**.
4. Wait for GitHub's Pages deployment to complete. Settings > Pages will show the live URL, normally `https://YOUR-USERNAME.github.io/YOUR-REPOSITORY/`.

All app assets use relative paths, so repository subfolders are supported. `.nojekyll` marks this as a plain static website.

Official instructions: https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site

## Run locally

Serve this folder with a static HTTP server. For example, with Python installed:

```sh
python -m http.server 8000
```

Open `http://localhost:8000`. Opening `index.html` directly may display the app, but service workers require HTTPS or localhost. The 3D view requires browser WebGL support.

## Offline use and updates

Open the live HTTPS website online and wait for **Ready for offline use** beneath the introduction. This confirms all required files have been cached. The app includes its own graphics and Three.js library; no CDN or internet API is needed for the lessons, dial, atlas, 3D sky, or local student work.

### Install on Android

1. Open the published GitHub Pages URL in Chrome.
2. Tap **Install Star Dial** if displayed, or Chrome's menu > **Install app / Add to Home screen** (wording varies).
3. Launch Star Dial from the home screen while online and wait for **Ready for offline use**.
4. Enable airplane mode, close the app, and launch it again to confirm offline operation.

### Install on iPhone or iPad

1. Open the published GitHub Pages URL in Safari.
2. Tap **Share > Add to Home Screen**. If shown, turn on **Open as Web App**, then tap **Add**.
3. Launch Star Dial from the home screen while online and wait for **Ready for offline use**.
4. Enable airplane mode, close the app, and launch it again to confirm offline operation.

This is an installable Progressive Web App (PWA), distributed through your website. It does not include an APK, an IPA, or an App Store / Play Store listing. Downloading the GitHub ZIP alone does not install the app on a phone.

The first download and future updates require internet. After setup, normal app use works offline while cached data remains on the device. Clearing website data, removing the app, private browsing, or browser storage eviction can remove offline files and saved work. Export important student reports. Keep the published URL stable; moving domains or repository paths does not transfer saved progress.

The service worker serves cached app files immediately. When changing any app asset, increment `CACHE_VERSION` in `sw.js`. Open online to download updates, then close all app windows and tabs and reopen to activate the new version. Each hosted app path has its own cache namespace.

Installation references: [Apple's iPhone guide](https://support.apple.com/guide/iphone/open-as-web-app-iphea86e5236/ios) and [MDN's PWA installation guide](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Guides/Making_PWAs_installable).

## Verification

Run `node --test tests/*.cjs` with Node.js 18 or newer. These dependency-free checks simulate offline requests at root and repository paths, verify required assets and cache isolation, check inline JavaScript syntax, and exercise view navigation, form preservation, history, mobile menu focus, independent assessment selections, the shared local sky calculations, and CER submission and report compatibility. They do not replace installation testing on actual phones.

Before sharing the link, test the dial, atlas, 3D view, activities, saved reflection, and report export in airplane mode on Android Chrome and iPhone Safari/home-screen mode. The 3D view requires device WebGL support.

## Files

- `index.html`: app interface, logic, and bundled Three.js
- `observatory.css`: visual styling
- `navigation.js`: section routing and responsive sidebar behavior
- `observer.js`: shared Bataan coordinates, selected observing month and sky-orientation calculations
- `BATAAN_REFERENCE.md`: location choice, presentation explanation and sources
- `sources/deped-school-coordinates-2021.pdf`: saved official coordinate source, see PDF page 3
- `manifest.json`: installable web app metadata
- `sw.js`: offline caching
- `install.js`: installation prompt and verified offline readiness
- `icon-192.png`, `icon-512.png`: app icons
- `atlas.js`, `atlas.css`: atlas interface, search and entry reader
- `atlas-data.js`: generated, offline atlas data
- `atlas-iau.json`, `atlas-boundaries.json`, `atlas-learning.json`: reviewed source data
- `assets/atlas/`: 89 openly licensed constellation charts
- `ATLAS_REFERENCES.md`: citations, chart credits and calculation notes
- `scripts/`: optional tools for refreshing and bundling atlas data
- `THIRD_PARTY_NOTICES.md`: bundled library and chart licenses

## Student data

Activity progress and reflections are stored in the current browser's local storage. They do not sync between devices. The teacher dashboard reads report files selected by the user. Clearing browser data can remove saved progress. Keep downloaded student reports outside this source folder and do not upload them to GitHub.

## Licensing

Three.js is distributed under the MIT license. The IAU / Sky & Telescope charts are CC BY 4.0; see `THIRD_PARTY_NOTICES.md` for attribution. No license for the original app code or artwork has been selected in this preparation. The owner can add a `LICENSE` file if they wish to grant reuse rights.
