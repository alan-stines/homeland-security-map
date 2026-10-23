# Data sources and attribution

Runtime feeds (all served through the local backend; no API keys required):

- National Weather Service alerts: https://www.weather.gov/documentation/services-web-api — actual active alerts, two-minute cache. Expiration follows the CAP message's `expires` field. If original geometry is absent, complete affected-zone geometries are used when available. At most 80 new zone lookups per refresh, four in parallel, with a 24-hour successful lookup cache. Alerts without complete geometry remain unlocated. No artificial incident lifetime or alert severity is assigned.
- USGS earthquake summary: https://earthquake.usgs.gov/earthquakes/feed/v1.0/geojson.php — past-day GeoJSON, one-minute cache. Restricted to the documented viewing envelopes in regions.js, which intentionally include adjacent border/offshore areas. Magnitude-based display classes (6+ Severe, 4.5+ Moderate, otherwise Minor) are dashboard classifications, not USGS impact ratings. The source's revision timestamp is retained. Display expiry is 24 hours after origin time.
- OpenFEMA Disaster Declarations Summaries v2: https://www.fema.gov/openfema-data-page/disaster-declarations-summaries-v2 — past 90 days, hourly cache, paginated before replacement, deduplicated by disaster number. Administrative context only; not mapped to invented point coordinates. FEMA refresh/record metadata does not establish the incident remains active.

Basemap:

- Existing world country geometry retained from the original MGA simulator.
- `assets/us-states.js`: US Census Bureau cartographic boundaries distributed by **us-atlas 3.0.1**, converted from `states-10m.json` to GeoJSON using topojson-client 3.1.0. Includes the 50 states, DC, Puerto Rico, USVI, Guam, Northern Marianas, and American Samoa. Source: https://github.com/topojson/us-atlas . Projection is regional equirectangular with a latitude correction, not a survey or jurisdictional boundary product.

us-atlas license (ISC):

Copyright 2013-2019 Michael Bostock

Permission to use, copy, modify, and/or distribute this software for any purpose with or without fee is hereby granted, provided that the above copyright notice and this permission notice appear in all copies.

THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES WITH REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR ANY SPECIAL, DIRECT, INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES WHATSOEVER RESULTING FROM LOSS OF USE, DATA OR PROFITS, WHETHER IN AN ACTION OF CONTRACT, NEGLIGENCE OR OTHER TORTIOUS ACTION, ARISING OUT OF OR IN CONNECTION WITH THE USE OR PERFORMANCE OF THIS SOFTWARE.
