# MGA US Situation Map

A United States situational awareness dashboard using authoritative public feeds. The fictional exercise version is maintained separately in `alan-stines/homeland-security-map-simulator`.

## Run

Requires **Node.js 24 or later**. There are no npm runtime dependencies and no build step.

```sh
npm start
```

The Node server serves the dashboard and `/api/events` on port 8080. Set `PORT` to select another port. Open the server in a browser outside onboarding; the dashboard needs this backend, so opening index.html directly or using GitHub Pages alone no longer supports live data.

```sh
npm test
```

Tests use deterministic source fixtures and real local HTTP requests. They cover alert expiry, test/cancel exclusion, source normalization, US viewing regions, geometry lookup failures, declaration pagination/deduplication, request coalescing, polling schedules, source outages, stale-cache preservation, and static-file access restrictions. Fixtures are never served in production.

## Sources and behavior

- **NWS:** actual active weather alerts; polls every two minutes. Forecast-zone boundaries are resolved where necessary. Alerts without complete geometry remain in the nationwide unmapped list.
- **USGS:** past-day earthquakes within US regional viewing envelopes; polls every minute. Offshore and neighboring border events can appear. Earthquakes leave the display after 24 hours, not after a simulation timer.
- **NIFC:** reported current wildfire incident points, acreage and containment where supplied; polls every five minutes. Locations are not fire perimeters or evacuation boundaries. No severity is inferred from size or containment.
- **NOAA NWPS:** river gauges with observed or forecast minor, moderate, or major flooding; polls every ten minutes using the official NOAA GIS observed and full-forecast river-stage layers. Duplicate gauges are merged. Observations older than 24 hours and forecasts whose valid time has passed are excluded. Source valid times are distinct from fetch times.
- **FEMA:** recent disaster declarations, refreshed hourly. Context in a separate panel, deduplicated across designated counties; not treated as current warnings.

Select contiguous US, Alaska, western Aleutians, Hawaii, Puerto Rico/USVI, Guam/Northern Marianas, or American Samoa. Layers, location/event search, keyboard-selectable map features, and official source links support inspection. NWS severity and magnitude-based earthquake display classes are distinct; there is no inferred national readiness level. All times show an explicit timezone.

The backend shares one cache across browser clients, limits requests, coalesces refreshes, and retains the last successful response on failures. NWS data becomes stale after ten minutes, USGS after five minutes, NIFC after twenty minutes, NOAA river data after thirty minutes, and FEMA after six hours. A failed request marks a previously successful source stale immediately. Expired records are filtered even during outages. Empty successful feeds, unavailable feeds, loading feeds, and stale feeds remain distinct. UI refresh does not bypass upstream polling limits. Caches are in memory and repopulate after restart; this first version is designed for one Node process.

Outbound HTTPS access is required to `api.weather.gov`, `earthquake.usgs.gov`, `www.fema.gov`, `services3.arcgis.com`, and `mapservices.weather.noaa.gov`. Node's native proxy support uses existing environment proxy settings; TLS verification stays enabled. No API credentials are required. Font and basemap assets are local. Feed errors are visible rather than replaced with fictional data. [SOURCES.md](SOURCES.md) documents attribution, classifications, and limits.

## Coverage expansion

These five sources are a foundation, not comprehensive emergency coverage. Additional adapters should preserve official IDs, source timestamps, geometry, expiry, attribution, deduplication, and independent source health:

1. **Wildfire expansion:** NASA FIRMS satellite detections (requires a free MAP_KEY) and NIFC/WFIGS perimeters in addition to the existing incident points. Thermal detections, confirmed fires, and mapped perimeters must remain distinct and linked where possible.
2. **Tropical hazards:** NOAA/NHC advisories and forecast geometry, cross-linked to NWS warnings to avoid presenting duplicate records as separate incidents.
3. **Flooding expansion:** USGS water measurements and additional NOAA forecast detail beyond the existing NWPS gauge summaries. Measurements and forecast thresholds are distinct from issued flood warnings.
4. **Public advisories:** DHS NTAS bulletins, displayed as official nationwide/regional advisories rather than invented incident points.
5. **Infrastructure:** jurisdiction-specific transport, utility, and emergency management sources. There is no uniform authoritative real-time national incident API for these categories.

Choose and verify each source's current API, terms, update cadence, key requirements, and geography before enabling it. Do not infer incident absence from lack of feed coverage or data. The dashboard does not replace official emergency notifications.

## Deployment

Deploy as a Node web service with HTTPS in front of it. A static GitHub Pages deployment cannot run ingestion or caching. For a multi-instance deployment, move caching and rate limiting into shared storage before scaling. No deployment is performed by these changes.
