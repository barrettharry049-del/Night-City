# Rainline City Wallpaper

A local web wallpaper for Lively Wallpaper: your Cyberpunk MP4 as the full-screen background, with one live-data billboard.

## Run it

Open `index.html` in Lively Wallpaper as a local web wallpaper.

The MP4 background is bundled next to the wallpaper as `Cyberpunk_2077_1080.mp4`.

## Banner placement

Edit the banner controls at the top of `style.css`:

- `--banner-left`
- `--banner-top`
- `--banner-width`
- `--banner-height`
- `--banner-opacity`
- `--banner-rotate-y`
- `--banner-rotate-x`
- `--banner-rotate-z`
- `--banner-skew-y`
- `--paid-ad-left`
- `--paid-ad-top`
- `--paid-ad-width`
- `--paid-ad-height`

The paid-ad variables move and resize the left-building sponsor flash slot.

Most billboard slides rotate every 10 seconds. The Transpower fuel-generation slide stays up for 20 seconds. RNZ appears every other slide, with live data screens in between, so the sign does not spend the whole cycle on articles.

- Random glitch-flash ad transitions play between slides, using short cyberpunk ad copy.
- Random fake paid sponsor flashes appear on the left building ad slot. They use local SVG brand-style marks so the ads do not depend on remote logo files; the BP sponsor uses NZ's `bp charge` branding.
- Paid-ad board extras include Galaxy Optic Samsung, nostalgia Coca-Cola, Midnight Bucket KFC, Apple, Netflix memory stream, and a public safety curfew notice.
- Rare one-slide Easter eggs can appear in a rotation, such as `NICE CATCH`, `SIGN CALIBRATION PASSED`, and `CITY AI OBSERVING`.
- If the live data misses its expected refresh window, or several/core feeds fail together, the billboard goes straight to a red `CITY ISSUE` / `NO FRESH DATA` warning instead of rotating stale data as if it were current.
- In signal-loss mode, the lower-right footer shows a larger `NEXT RELINK ATTEMPT` countdown. The updater retries every 30 seconds after a core/multi-feed failure.
- Each slide has a tiny animated city heartbeat meter, two-line rotating fake corporate sponsor line, and bottom ticker.
- Footer wording uses `SIGNAL AGE` and `NEXT SYNC` rather than plain update labels.
- Transpower renewable generation and fuel utilisation.
- Transpower live load by operational zone.
- One RNZ article headline and a short summary. The updater keeps 6 prioritised RNZ stories, biased toward breaking news, technology, politics/government accountability, and health.
- GeoNet summary covering recent felt quakes, volcano alert levels, and CAP quake alerts when present.
- Waka Kotahi road events and Manawatu-Wanganui traffic counts. Traffic counts are shown as daily vehicle movements through selected telemetry sites, including returned directions and lanes.
- Night cycle slide with approximate lower North Island sunrise, sunset, and moon illumination. This is calculated locally in `wallpaper.js` from a NOAA-style sunrise/sunset formula and a simple lunar-cycle approximation, not fetched from an official live API.
- Deep City System slide with fake luminance/skybridge/district signal telemetry.
- City Link branded data-ad slides include Toyota hybrid drive, Spotify city music feed, Google city indexing, Tesla Energy charge window, and Microsoft Azure city cloud.
- NEMA emergency alerts only when the alert feed contains a real current item.

On GitHub Pages, `.github/workflows/update-live-data.yml` refreshes all live feeds every 10 minutes and commits a fresh `live-data.js`. The lower-right text on the billboard counts down to the next refresh.

## Live feeds

- Transpower NZ: tries to fetch the live generation summary and calculates renewable percentage from Hydro, Geothermal, Wind, and Solar generation.
- Transpower live load: reads operational-zone demand, Mvar, and power factor where available.
- Generation utilisation: compares live Transpower MW with the supplied capacity table: Battery 235 MW, Co-Gen 168 MW, Coal 750 MW, Gas 1280 MW, Geothermal 1342 MW, Hydro 5415 MW, Diesel/Oil 156 MW, Solar 470 MW, Wind 1393 MW.
- RNZ: tries to fetch the latest national RSS headline and summary.
- GeoNet: reads recent felt quakes, volcano alert levels, and quake CAP feed entries.
- Waka Kotahi: reads current road events and Manawatu-Wanganui traffic counts.
- NEMA: reads public emergency alert feed items, but stays hidden if there are no alerts.

## Live data updater

The public GitHub Pages version uses the GitHub Actions workflow `Update live data`. It can also be run manually from the repository's Actions tab with `Run workflow`.

If a feed cannot be reached, the billboard stays alive and shows an offline message instead of failing. Core/multi-feed failures trigger 30-second retry attempts until a cleaner update is written.
