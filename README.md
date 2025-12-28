# World Timezone Explorer 🌍⏱️

An interactive world map that:
- shows **country names** on the map (via labeled map tiles),
- displays the **approximate timezone** under your mouse (15° longitude per hour),
- shows the **current local time** for that cursor position,
- lets you **click** to reverse-geocode and display a country/city name,
- includes a **search box** ([Nominatim](https://nominatim.org/)) to jump to a place.

> ⚠️ Timezones here are **approximate** (longitude bands). Real-world timezones follow borders and daylight saving rules.

## 🗂️ Files

- `index.html` – UI layout
- `style.css` – styling
- `app.js` – Leaflet map + timezone math + reverse geocoding
- `tools/generate_bands.py` – optional helper script (not required)

## 📝 Notes

- Country names are visible because the basemap includes labels.
- This demo uses OpenStreetMap Nominatim public endpoints:
```
- https://nominatim.openstreetmap.org/reverse
- https://nominatim.openstreetmap.org/search
```

> ⚠️ For heavier traffic, host your own geocoder and replace the URLs in `app.js`.


## Attribution

Map tiles:
- © OpenStreetMap contributors
- © CARTO

Leaflet:
- https://leafletjs.com/
