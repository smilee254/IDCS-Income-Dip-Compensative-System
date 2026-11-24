"""
IDCS Weather Oracle Module
Queries Open-Meteo weather API to verify severe weather conditions (e.g. flooding, storms)
for parametric claim triggers across Kenyan counties.
"""
import time
import requests
import logging

log = logging.getLogger("idcs.weather")

# Representative coordinates for Kenyan counties
COUNTY_COORDINATES = {
    "nairobi":   {"lat": -1.286389, "lon": 36.817223},
    "mombasa":   {"lat": -4.043477, "lon": 39.668206},
    "kisumu":    {"lat": -0.091702, "lon": 34.767956},
    "nakuru":    {"lat": -0.303099, "lon": 36.080026},
    "kiambu":    {"lat": -1.171389, "lon": 36.835556},
    "machakos":  {"lat": -1.517684, "lon": 37.263415},
    "kajiado":   {"lat": -1.852380, "lon": 36.776830},
    "uasin gishu":{"lat": 0.514277, "lon": 35.269780},
    "kilifi":    {"lat": -3.630450, "lon": 39.849920},
}

_weather_cache = {}  # {county: (timestamp, is_severe)}
CACHE_TTL = 3600     # 1 hour cache


def check_severe_weather(county: str) -> bool:
    """
    Check if a county is experiencing severe weather (heavy rainfall > 40mm/day or gale wind > 60km/h).
    Returns False on unknown county or API failure.
    """
    if not county:
        return False
        
    normalized = county.strip().lower()
    coords = COUNTY_COORDINATES.get(normalized, COUNTY_COORDINATES["nairobi"])

    now = time.time()
    if normalized in _weather_cache:
        ts, cached_val = _weather_cache[normalized]
        if now - ts < CACHE_TTL:
            return cached_val

    try:
        url = "https://api.open-meteo.com/v1/forecast"
        params = {
            "latitude": coords["lat"],
            "longitude": coords["lon"],
            "daily": ["precipitation_sum", "wind_speed_10m_max"],
            "timezone": "Africa/Nairobi",
            "forecast_days": 1
        }
        res = requests.get(url, params=params, timeout=3.0)
        if res.status_code == 200:
            data = res.json()
            daily = data.get("daily", {})
            precip = daily.get("precipitation_sum", [0.0])[0] or 0.0
            wind = daily.get("wind_speed_10m_max", [0.0])[0] or 0.0

            # Severe threshold: > 40mm rainfall (flash flood risk) or > 60 km/h wind
            is_severe = bool(precip > 40.0 or wind > 60.0)
            _weather_cache[normalized] = (now, is_severe)
            return is_severe
    except Exception as exc:
        log.debug(f"[WeatherOracle] Open-Meteo call failed for {county}: {exc}")

    # Fallback default: false
    _weather_cache[normalized] = (now, False)
    return False
