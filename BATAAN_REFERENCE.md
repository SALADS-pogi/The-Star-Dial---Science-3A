# Why Star Dial and Free Roam use a reference point in Bataan

Coordinate source verified on 16 October 2026; shared observing model documented on 17 October 2026.

## The chosen point

| Detail | Value |
| --- | --- |
| Reference site | Bataan National High School |
| Barangay | Bagong Silang |
| City and province | Balanga City, Bataan, Philippines |
| DepEd school ID | 300702 |
| Latitude | 14.6753° N |
| Longitude | 120.5201° E |
| Shared observing date and time | Day 2 of the selected month in 2026, 9:00 PM Philippine Time (UTC+08:00) |
| Same instant in UTC | Day 2 of the selected month in 2026, 13:00 UTC |
| Initial month | September; subsequent month choices are remembered on this device |

The location and coordinates are listed on **PDF page 3** of the Department of Education's **Annex D: List of Recipient Schools**, in the row for school **300702**. The table identifies the province as Bataan and the municipality as City of Balanga. We read the row and checked it against the rendered page. [Official DepEd PDF, page 3](https://www.deped.gov.ph/wp-content/uploads/2021/10/SBB1_Annex-D_List-of-Recipient-Schools_2021c-CB-027.pdf#page=3). A [saved copy](sources/deped-school-coordinates-2021.pdf#page=3) is bundled with the app.

## Why this point is suitable

Bataan is an area, so a sky simulation needs one specific observing point within it. We chose this school because an official, publicly available source identifies both its location in Bataan and its coordinates. It gives the class a documented, repeatable starting position.

These are the source's published school coordinates, not a new survey, the province's geographic center, or a claim that this is the best stargazing site. Actual observing conditions vary across Bataan. The app uses this fixed reference instead of requesting the student's GPS location. Both Star Dial and Free Roam use the same selected month, day and time, so students can compare the same modeled sky in either section.

## An explanation for your presentation

“We used Bataan National High School in Balanga City as our reference point within Bataan. DepEd publishes its coordinates as 14.6753 degrees north and 120.5201 degrees east. Our app uses the latitude to set the local horizon, then the longitude and the selected date and time to orient the sky. Star Dial and Free Roam share these settings. Each month is compared on day 2 at 9 PM, giving the class a consistent Bataan-based view.”

## How the coordinates are used

The shared configuration and calculations are in `observer.js`. Star Dial, the 3D sky, Earth marker, location labels and atlas latitude notes all use that configuration. Changing the dial month also updates Free Roam's horizon view.

1. Use day 2 of the selected month in 2026. Convert the fixed Philippine time to UTC: 21:00 minus eight hours gives 13:00 on the same date.
2. Calculate Greenwich mean sidereal time (GMST) from the date and UTC time. Sidereal time describes Earth's orientation relative to the stars. Add east longitude divided by 15 and wrap to 0–24 hours to obtain local mean sidereal time (LMST). [US Naval Observatory: Computing Approximate Sidereal Time](https://aa.usno.navy.mil/faq/GAST).
3. Combine LMST, latitude, and each object's right ascension and declination to place it relative to the horizon. [US Naval Observatory: Computing Altitude and Azimuth](https://aa.usno.navy.mil/faq/alt_az).

For the initial September example, **2 September 2026 at 21:00 PHT**, the calculation gives approximately **GMST = 11.779513 hours** and **LMST = 19.814186 hours**, or **19h 48m 51s**. Other selected months produce different values. Sidereal hours describe sky orientation; they are not the local clock time.

The implementation uses the USNO approximation:

```text
JD = Unix milliseconds / 86,400,000 + 2440587.5
JD0 = floor(JD − 0.5) + 0.5
D0 = JD0 − 2451545.0
H = (JD − JD0) × 24
T = (JD − 2451545.0) / 36525
GMST = mod(6.697375 + 0.065709824279 × D0
           + 1.0027379 × H + 0.0000258 × T², 24)
LMST = mod(GMST + 120.5201 / 15, 24)
```

## What this model can show

Star Dial selects four patterns from its catalog whose plotted main stars are all above the geometric horizon at the shared observing time. It ranks qualifying patterns by their plotted stars' mean altitude. Southern constellations can appear when they rise above Bataan's horizon; their celestial hemisphere does not by itself decide local visibility. A card's direction and altitude refer to its brightest plotted star. The small pattern sketches show recognition shapes, not scaled positions in the local sky.

Free Roam applies the same horizon calculation to its star coordinates for the selected month. Its background stars are decorative. The Sun and planet positions retained in the Flat map are a separate mid-August 2026 reference snapshot; these objects are omitted from the shared 3D horizon because their positions have not been calculated for each selected date.

Both sections are approximate teaching models. They use UTC as an approximation to UT1, assume TT approximately equals UT1 in the sidereal formula, and use mean rather than apparent sidereal time. Star coordinates retain their catalog epoch (J2000); precession, atmospheric refraction, local terrain and observer elevation are not modeled. A star above the geometric horizon is not necessarily observable through haze, clouds or light pollution, especially near the horizon.

Star Atlas notes describe whether parts of a constellation can geometrically rise from latitude 14.6753° N at some time. They are not a forecast for tonight. The Flat map is an equatorial overview, while the 3D sky applies the Bataan horizon. The assessment's seasonal illustration remains a separate schematic exercise; its data have not been converted into the shared Bataan sky model.

The references document the coordinate source and calculation method; they do not imply endorsement of the app by DepEd or the US Naval Observatory.
