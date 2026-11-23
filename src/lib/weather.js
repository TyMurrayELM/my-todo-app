// Current weather where a person lives (People screen). Both services are
// Open-Meteo: free, no key, callable from the browser. Only the place name
// typed in "Currently lives" and its coordinates are sent, nothing else.

const GEOCODE_URL = 'https://geocoding-api.open-meteo.com/v1/search';
const FORECAST_URL = 'https://api.open-meteo.com/v1/forecast';

const US_STATES = {
  AL: 'Alabama', AK: 'Alaska', AZ: 'Arizona', AR: 'Arkansas', CA: 'California',
  CO: 'Colorado', CT: 'Connecticut', DE: 'Delaware', FL: 'Florida', GA: 'Georgia',
  HI: 'Hawaii', ID: 'Idaho', IL: 'Illinois', IN: 'Indiana', IA: 'Iowa', KS: 'Kansas',
  KY: 'Kentucky', LA: 'Louisiana', ME: 'Maine', MD: 'Maryland', MA: 'Massachusetts',
  MI: 'Michigan', MN: 'Minnesota', MS: 'Mississippi', MO: 'Missouri', MT: 'Montana',
  NE: 'Nebraska', NV: 'Nevada', NH: 'New Hampshire', NJ: 'New Jersey', NM: 'New Mexico',
  NY: 'New York', NC: 'North Carolina', ND: 'North Dakota', OH: 'Ohio', OK: 'Oklahoma',
  OR: 'Oregon', PA: 'Pennsylvania', RI: 'Rhode Island', SC: 'South Carolina',
  SD: 'South Dakota', TN: 'Tennessee', TX: 'Texas', UT: 'Utah', VT: 'Vermont',
  VA: 'Virginia', WA: 'Washington', WV: 'West Virginia', WI: 'Wisconsin', WY: 'Wyoming',
  DC: 'District of Columbia',
}; // prettier-ignore

const SKY_LABEL = {
  clear: 'Clear',
  partly: 'Partly cloudy',
  cloudy: 'Cloudy',
  fog: 'Fog',
  rain: 'Rain',
  snow: 'Snow',
  storm: 'Thunderstorm',
};

// WMO weather code -> one of the skies the icon can draw
export const skyFromCode = (code) => {
  if (code === 0 || code === 1) return 'clear';
  if (code === 2) return 'partly';
  if (code === 3) return 'cloudy';
  if (code === 45 || code === 48) return 'fog';
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) return 'snow';
  if (code >= 95) return 'storm';
  if (code >= 51 && code <= 82) return 'rain';
  return 'cloudy';
};

export const skyLabel = (sky, night) =>
  sky === 'clear' ? (night ? 'Clear' : 'Sunny') : SKY_LABEL[sky] || '';

// "Denver, CO" -> { name: 'Denver', hints: ['colorado', 'co'] }. The search
// takes a bare place name; whatever follows a comma picks among the matches.
export const parsePlace = (text) => {
  const parts = String(text || '')
    .split(',')
    .map((x) => x.trim())
    .filter(Boolean);
  const hints = [];
  parts.slice(1).forEach((part) => {
    hints.push(part.toLowerCase());
    const state = US_STATES[part.toUpperCase()];
    if (state) hints.push(state.toLowerCase());
  });
  return { name: parts[0] || '', hints };
};

// Choose among geocoder results: the first whose state, country or country
// code matches every hint; with no hints (or no match) the first result,
// which the geocoder ranks by size.
export const pickPlace = (results, hints) => {
  if (!results || results.length === 0) return null;
  if (hints.length === 0) return results[0];
  const fields = (r) =>
    [r.admin1, r.admin2, r.country, r.country_code].filter(Boolean).map((x) => x.toLowerCase());
  const score = (r) => hints.filter((h) => fields(r).includes(h)).length;
  let best = results[0];
  results.forEach((r) => {
    if (score(r) > score(best)) best = r;
  });
  return best;
};

export const placeLabel = (r) =>
  [r.name, r.admin1, r.country_code === 'US' ? null : r.country].filter(Boolean).join(', ');

// Look a typed place up. Resolves { lat, lon, label } or null when not found.
export async function geocodePlace(text) {
  const { name, hints } = parsePlace(text);
  if (!name) return null;
  const res = await fetch(
    `${GEOCODE_URL}?name=${encodeURIComponent(name)}&count=10&language=en&format=json`
  );
  if (!res.ok) throw new Error(`Place lookup failed (${res.status})`);
  const json = await res.json();
  const hit = pickPlace(json.results, hints);
  return hit ? { lat: hit.latitude, lon: hit.longitude, label: placeLabel(hit) } : null;
}

// A forecast phrase ("Mostly Sunny", "Chance Light Rain") -> a sky
export const skyFromText = (text) => {
  const t = String(text || '').toLowerCase();
  if (/thunder|t-storm/.test(t)) return 'storm';
  if (/snow|flurr|sleet|ice|wintry|blizzard|freezing/.test(t)) return 'snow';
  if (/rain|shower|drizzle/.test(t)) return 'rain';
  if (/fog|haze|mist|smoke/.test(t)) return 'fog';
  if (/partly|mostly cloudy/.test(t)) return /mostly cloudy/.test(t) ? 'cloudy' : 'partly';
  if (/cloud|overcast/.test(t)) return 'cloudy';
  return 'clear';
};

// How long Open-Meteo gets before the National Weather Service is tried
const OPEN_METEO_TIMEOUT_MS = 8000;

async function openMeteoWeather(points) {
  const res = await fetch(
    `${FORECAST_URL}?latitude=${points.map((x) => x.lat).join(',')}&longitude=${points
      .map((x) => x.lon)
      .join(',')}&current=temperature_2m,weather_code,is_day&temperature_unit=fahrenheit`,
    { signal: AbortSignal.timeout(OPEN_METEO_TIMEOUT_MS) }
  );
  if (!res.ok) throw new Error(`Weather lookup failed (${res.status})`);
  const json = await res.json();
  const list = Array.isArray(json) ? json : [json]; // one place comes back bare
  return points.map((_, i) => {
    const cur = list[i]?.current;
    if (!cur || typeof cur.temperature_2m !== 'number') return null;
    const sky = skyFromCode(cur.weather_code);
    const night = cur.is_day === 0;
    return { tempF: Math.round(cur.temperature_2m), sky, night, label: skyLabel(sky, night) };
  });
}

// The US National Weather Service (free, no key, US places only): this
// hour's forecast for one point, or null.
async function nwsWeather(point) {
  try {
    const where = await fetch(
      `https://api.weather.gov/points/${Number(point.lat).toFixed(4)},${Number(point.lon).toFixed(4)}`
    );
    if (!where.ok) return null;
    const hourlyUrl = (await where.json())?.properties?.forecastHourly;
    if (!hourlyUrl) return null;
    const res = await fetch(hourlyUrl);
    if (!res.ok) return null;
    const now = (await res.json())?.properties?.periods?.[0];
    if (!now || typeof now.temperature !== 'number') return null;
    const tempF = now.temperatureUnit === 'C' ? now.temperature * 1.8 + 32 : now.temperature;
    const sky = skyFromText(now.shortForecast);
    const night = now.isDaytime === false;
    return {
      tempF: Math.round(tempF),
      sky,
      night,
      label: now.shortForecast || skyLabel(sky, night),
    };
  } catch {
    return null;
  }
}

// Current conditions for a list of { lat, lon }, in the same order:
// { tempF, sky, night, label } each (null where nothing could be had).
// Open-Meteo answers for everywhere in one request; when it cannot be reached
// the National Weather Service fills in the US places one by one.
export async function fetchCurrentWeather(points) {
  if (points.length === 0) return [];
  try {
    return await openMeteoWeather(points);
  } catch {
    return Promise.all(points.map(nwsWeather));
  }
}

// A reading older than this is dropped rather than shown
export const WEATHER_MAX_AGE_MS = 3 * 60 * 60 * 1000;

// Fold a refresh into the weather already shown. `places` are the people who
// have a place now and `list` what came back for each (null where the lookup
// failed). A failed lookup keeps that person's last reading while it is under
// WEATHER_MAX_AGE_MS old, so a bad refresh never blanks the list; people with
// no place any more are dropped. Every reading carries `at` (ms).
export const mergeWeather = (prev, places, list, now = Date.now()) => {
  const next = {};
  places.forEach((place, i) => {
    if (list[i]) next[place.id] = { ...list[i], at: now };
    else if (prev[place.id] && now - (prev[place.id].at ?? 0) < WEATHER_MAX_AGE_MS)
      next[place.id] = prev[place.id];
  });
  return next;
};

// Readings still young enough to show (for the copy kept between visits)
export const freshWeather = (saved, now = Date.now()) =>
  Object.fromEntries(
    Object.entries(saved || {}).filter(
      ([, w]) => w && typeof w.tempF === 'number' && now - (w.at ?? 0) < WEATHER_MAX_AGE_MS
    )
  );
