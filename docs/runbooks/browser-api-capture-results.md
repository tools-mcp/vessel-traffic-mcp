# Browser API capture results

Purpose: record the browser-captured API shapes needed to resolve a vessel by
name, IMO, or MMSI and then fetch vessel identity and position data. This is a
sanitized operator note. Raw HAR files stay in `/Users/aktn/project/api-capture`
and must not be copied into this repository.

## Capture runs

All captures used the sibling `/Users/aktn/project/api-capture` browser
workflow with public, no-login pages only.

- Broad recon sessions:
  - `/Users/aktn/project/api-capture/sessions/recon_20260517T151815_84dac6`
    BoatNerd AIS
  - `/Users/aktn/project/api-capture/sessions/recon_20260517T151827_106cc4`
    MyShipTracking
  - `/Users/aktn/project/api-capture/sessions/recon_20260517T151858_8d7511`
    ShipFinder
  - `/Users/aktn/project/api-capture/sessions/recon_20260517T151921_8ebe21`
    ShipXplorer
  - `/Users/aktn/project/api-capture/sessions/recon_20260517T151949_797f2c`
    MarineVesselTraffic / AIS Friends
  - `/Users/aktn/project/api-capture/sessions/recon_20260517T152223_7b62ad`
    VesselFinder
  - `/Users/aktn/project/api-capture/sessions/recon_20260517T152304_847658`
    MarineTraffic
  - `/Users/aktn/project/api-capture/sessions/recon_20260517T152314_82c9a0`
    FleetMon
- Search-input probe:
  - `/Users/aktn/project/api-capture/sessions/vessel_search_probe_20260517T152608Z`
- Targeted selector probe:
  - `/Users/aktn/project/api-capture/sessions/vessel_targeted_search_probe_20260517T153219Z`
- Multi-site browser API capture:
  - `/Users/aktn/project/api-capture/sessions/vessel_targeted_api_capture_20260518T003128Z`
    ShipFinder, MyShipTracking, BoatNerd AIS, VesselFinder, ShipXplorer,
    SeaRates, VesselTracker, MarineVesselTraffic, MarineTraffic
- SeaRates deep input/selection probes:
  - `/Users/aktn/project/api-capture/sessions/searates_deep_select_20260518T0040Z`
  - `/Users/aktn/project/api-capture/sessions/searates_select_submit2_20260518T0052Z`

Probe queries:

- Vessel name: `EVER GIVEN`
- IMO: `9811000`
- MMSI: `353136000`

## Usable public candidates

### ShipFinder

Best current public candidate for the full chain.

Adapter status: `src/providers/shipfinder.ts` implements the captured
autocomplete and `GetShip` shapes behind an explicit `shipfinder` provider.
The default MCP registry remains fixture-only; register/select
`provider: "shipfinder"` deliberately when testing this public endpoint.

Search / autocomplete:

```text
GET https://searchv3.shipfinder.com/shipdata/search3.ashx?f=auto&kw=<query>
GET https://searchv3.shipfinder.com/shipdata/search3.ashx?f=srch&kw=<query>
```

Observed response shape:

```json
{
  "status": 0,
  "ship": [
    {
      "m": 353136000,
      "n": "EVER GIVEN",
      "i": 9811000,
      "c": "H3RC",
      "t": 100,
      "QTY": "srf",
      "dt": 0
    }
  ],
  "port": []
}
```

Vessel detail / latest position:

```text
POST https://www.shipfinder.com/ship/GetShip
Content-Type: application/x-www-form-urlencoded

mmsi=<mmsi>
```

Observed response fields:

- Identity: `mmsi`, `shipid`, `imo`, `name`, `callsign`, `type`
- Dimensions: `length`, `width`, `draught`
- Voyage/status: `dest`, `eta`, `navistatus`, `laststa`, `lastdyn`
- Position: `lon`, `lat`, `sog`, `cog`, `hdg`, `rot`

Observed `EVER GIVEN` sample used `mmsi=353136000` and returned
`imo=9811000`, `name=EVER GIVEN`, `callsign=H3RC`. The captured `lat`,
`lon`, `cog`, and `hdg` values were validated in the adapter tests as scaled
fields: latitude/longitude divide by `1_000_000`, and course/heading divide by
`100` when outside normal degree ranges.

Current live check note (2026-05-18 Asia/Seoul): the normal browser context
returned full `GetShip` detail for `mmsi=353136000`, including
`lat=43413845`, `lon=4841788`, `sog=0`, `cog=21020`, `hdg=31100`,
`dest=MARSEILLE,FR`, and `navistatus=5`. Direct non-browser POSTs from curl
still returned `status=2` with an abnormal-access/browser-refresh message.
The adapter treats those responses as `provider_unavailable` rather than
attempting to bypass the browser verification flow.

Related endpoint:

```text
POST https://www.shipfinder.com/ship/GetIHSData
```

This returned a login redirect in the no-login probe. Do not use it in the
public adapter.

### BoatNerd AIS

Strong regional candidate for Great Lakes coverage.

Search:

```text
GET https://ais.boatnerd.com/api/v1/vessels/search?q=<name|imo|mmsi>
```

Observed response shape from an earlier browser flow:

```json
{
  "statusCode": 200,
  "data": {
    "rows": [],
    "count": 0
  }
}
```

The later targeted direct fetch returned `401` with `Invalid or missing API
key`, while the map endpoint below remained public. Treat `vessels/search` as
unsettled and use it only if a normal browser UI flow proves it is accessible
without private credentials.

Map / position by area:

```text
GET https://ais.boatnerd.com/api/v1/vessels?bbox=<lon lat polygon>
```

Observed row fields:

- Identity: `mmsi`, `name`
- Position: `lat`, `lon`, `heading`, `mtime`
- Context: `vesselType`, `vesselSize`, `navigation.speed`,
  `navigation.destination`, `navigation.minutesDiff`

Adapter path: use `vessels/search` for regional name/MMSI lookup and
`vessels?bbox=...` for latest area positions.

### MyShipTracking

Public search and public map feed were captured. The map feed uses a custom
tab-delimited text format and needs a decoder.

Search / autocomplete:

```text
GET https://www.myshiptracking.com/requests/autocomplete.php?req=<query>&res=all
```

Observed XML shape:

```xml
<RESULTS>
  <RES>
    <ID>353136000</ID>
    <NAME>EVER GIVEN</NAME>
    <D>Cargo A</D>
    <TYPE>7</TYPE>
    <FLAG>PA</FLAG>
    <LAT>0.00000</LAT>
    <LNG>0.00000</LNG>
  </RES>
</RESULTS>
```

For `EVER GIVEN`, `9811000`, and `353136000`, the autocomplete endpoint
returned `ID=353136000`. The returned `LAT/LNG` were zero in this capture, so
do not treat autocomplete as a position source.

Map / position feed:

```text
GET https://www.myshiptracking.com/requests/vesselsonmaptempTTT.php
```

Observed query parameters:

- `type=json`
- `minlat`, `maxlat`, `minlon`, `maxlon`
- `zoom`
- `selid`, `seltype`
- `timecode`
- `filters` JSON string

Observed selected-vessel request:

```text
GET /requests/vesselsonmaptempTTT.php?type=json&minlat=-90&maxlat=90&minlon=-180&maxlon=180&zoom=3&selid=353136000&seltype=0&timecode=0&filters={}
```

Observed `EVER GIVEN` row prefix:

```text
1779064312 0 7 0 353136000 EVER GIVEN 43.41386 4.84177 0.1 311 4 1779054585
```

This confirms the map feed can return a selected MMSI position. The apparent
column order is server timestamp, unknown flags/type/status, MMSI, name,
latitude, longitude, speed, course or heading, status/source fields, and last
report timestamp. The row schema still needs a dedicated decoder before adapter
work.

### VesselFinder

Public browser flow works, but some APIs are binary/encoded. The HTML detail
page is currently the easiest no-login position source.

Search:

```text
GET https://www.vesselfinder.com/api/pub/ms?name=<query>&1
```

Observed content type: `application/octet-stream` with HAR base64 encoding.
The frontend decodes this into the visible suggestion that navigates to:

```text
GET https://www.vesselfinder.com/vessels/details/<imo>
```

The detail HTML contains identity fields and an embedded JSON block:

```html
<div id="djson" data-json='{ "...", "mmsi": 353136000,
  "ship_lat": 43, "ship_lon": 5, "ship_cog": 236.4,
  "ship_sog": 0.0, "ship_type": 71 }'></div>
```

Observed detail fields:

- Meta/table identity: vessel name, IMO, MMSI, callsign, AIS type, flag,
  dimensions
- Position block: `ship_lat`, `ship_lon`, `ship_cog`, `ship_sog`, `lrpd`
  recency text

Latest browser detail page for `9811000` loaded successfully without login.

Related JSON endpoints:

```text
GET https://www.vesselfinder.com/api/pub/pcext/v4/<mmsi>?d
GET https://www.vesselfinder.com/api/pub/ship/vu/<imo>/<year>
```

The first returned recent port-call style rows. The second returned voyage
usage/stat summary. The map endpoint below is also captured but requires a
binary decoder:

```text
GET https://www.vesselfinder.com/api/pub/mp2?bbox=...&zoom=...&mmsi=...&mcbe=1
```

### MarineVesselTraffic / AIS Friends

The public page embeds AIS Friends map data.

Area positions:

```text
GET https://www.aisfriends.com/vessels/bounding-box
```

Observed query parameters:

- `lon_min`, `lat_min`, `lon_max`, `lat_max`
- `zoom`

Observed row fields:

- Identity: `id`, `vessel_id`, `imo`, `mmsi`, `name`, `name_ais`, `flag`
- Position: `latitude`, `longitude`, `timestamp_of_position`,
  `course_over_ground`, `speed_over_ground`, `true_heading`
- Vessel details: `class`, `ship_type_id`, `detailed_type_id`, `length`,
  `beam`, `draught`, `navigational_status_id`

Search endpoint attempted:

```text
POST https://www.marinevesseltraffic.com/search-main-autocomplete/vessels
Content-Type: application/json

{"term":"<query>"}
```

The normal browser session received `403` with a Cloudflare challenge page.
Do not bypass it. Keep AIS Friends bounding-box data as the usable path.

Direct AIS Friends check around the Marseille/Fos area returned public JSON
rows, for example `MSC SORAYA` with `latitude`, `longitude`,
`speed_over_ground`, `course_over_ground`, and `timestamp_of_position`. The
same viewport did not include `EVER GIVEN`, so AIS Friends is best treated as
an area feed rather than a name/IMO resolver.

### ShipXplorer

Public map feeds were captured, but the no-login browser did not expose a
usable vessel search box. Visible inputs during the probe were login/signup
fields.

Map / live feed:

```text
GET https://data.shipxplorer.com/live
```

Observed query parameters include `bounds`, `zoom`, `lastReport`,
`trackLength`, `types[]`, `status[]`, `ais`, `sate`, `vessel`, and
`vesselid`.

Related feed:

```text
GET https://data.shipxplorer.com/feed?feed=mostTracked&owner=
```

Adapter path: treat as a map-feed candidate only until a public search/detail
flow is captured or official/API terms are confirmed.

The no-login detail page
`https://www.shipxplorer.com/data/vessels/EVER-GIVEN-IMO-9811000-MMSI-353136000`
returned public HTML, but no detail JSON endpoint was captured. A global
`/live` request with `lastReport=0` returned an empty aggregate, while normal
viewport requests returned AIS rows.

### SeaRates

Public search is now captured, and the selected result reveals the route/detail
endpoint shape. The free browser quota limited the detail response before
position rows were returned.

Search / identity:

```text
GET https://www.searates.com/tracking-system/vessel?search=<name|imo|mmsi>&images=true&partial_match=true&endpoint=
```

Observed `EVER GIVEN` response:

```json
{
  "success": true,
  "vessels": [
    {
      "imo": 9811000,
      "name": "EVER GIVEN",
      "mmsi": 353136000,
      "call_sign": "H3RC",
      "flag": "PA",
      "year_built": 2018,
      "type": "Container Ship",
      "length": 399.94,
      "width": 59
    }
  ]
}
```

Selected vessel data / route candidate:

```text
GET https://www.searates.com/tracking-system/vessel?filters={"imo":9811000,"mmsi":353136000,"vessel_name":"EVER GIVEN"}&ais=true&images=true&route=true&endpoint=get-vessel-data
```

Observed no-login response after the free daily quota was consumed:

```json
{
  "success": false,
  "message": "API_KEY_LIMIT_REACHED",
  "metadata": {
    "daily": {
      "unique_shipments": {
        "used": 1,
        "total": 1,
        "remaining": 0
      }
    },
    "is_free": true
  },
  "data": {}
}
```

Adapter path: search can be used as an identity resolver only after terms and
quota behavior are reviewed. The selected-vessel detail endpoint should not be
used in default routing because the public no-login quota is extremely small.

## Blocked or incomplete

### MarineTraffic

The normal browser probe reached a persistent Cloudflare block page. Use the
official BYOK API path; do not build a public-page capture adapter.

### FleetMon

No useful no-login API endpoints were captured. Treat as BYOK/contract-only.

### VesselTracker

The public detail page
`https://www.vesseltracker.com/en/Ships/Ever-Given-9811000.html` loads without
login and contains identity plus coarse course/position fields:

- Identity: `IMO 9811000`, `MMSI 353136000`, `Callsign H3RC`, `Flag Panama`
- Course/status: `Navigational status: Moored`, `Course`, `Heading`,
  `Location: Fos-sur-Mer`, `Area: France`, `Last seen`, `Source: T-AIS`

Exact coordinates and several master-data fields are locked behind login or
Cockpit links. No usable no-login JSON API was captured, so do not implement a
coordinate adapter from VesselTracker public pages.

## Implementation order

1. MyShipTracking adapter spike: decode selected `vesselsonmaptempTTT.php`
   rows for MMSI-based positions.
2. ShipFinder adapter hardening: keep search enabled, but only use `GetShip`
   where a normal browser/session flow is explicitly available.
3. VesselFinder adapter supplement: parse detail HTML `#djson` for no-login
   position; keep official BYOK adapter as primary for production use.
4. AIS Friends area adapter: use `vessels/bounding-box` behind conservative
   pacing and terms review.
5. BoatNerd adapter: use `bbox` area positions; keep `vessels/search` on hold
   until the missing-key behavior is resolved.
6. SeaRates identity-only resolver spike; hold detail/route calls because the
   no-login quota returned `API_KEY_LIMIT_REACHED`.
7. ShipXplorer map-feed spike only after search/detail flow is captured.

## Guardrails

- Do not commit raw HAR files, browser cookies, Cloudflare challenge payloads,
  or private captures.
- Do not solve CAPTCHA or bypass bot-defense. A normal browser JS challenge may
  settle naturally; if it persists, mark the provider blocked.
- Do not log or replay account/session endpoints.
- Default tests must use sanitized fixtures and never call these live public
  endpoints.
