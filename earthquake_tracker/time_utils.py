import datetime
from datetime import timezone

try:
    from timezonefinder import TimezoneFinder
    import zoneinfo
    tf = TimezoneFinder()
except Exception:
    tf = None

def get_earthquake_times(epoch_ms, lat, lon):
    """
    Computes precise Local Time at the earthquake epicenter and UTC Universal Time.
    """
    dt_utc = datetime.datetime.fromtimestamp(epoch_ms / 1000.0, tz=timezone.utc)
    utc_time_short = dt_utc.strftime("%I:%M %p UTC")
    utc_date_str = dt_utc.strftime("%B %d, %Y at %I:%M %p UTC")
    
    tz_name = "UTC"
    if tf:
        try:
            tz_found = tf.timezone_at(lng=lon, lat=lat)
            if tz_found:
                tz_name = tz_found
        except Exception:
            pass

    try:
        dt_local = dt_utc.astimezone(zoneinfo.ZoneInfo(tz_name))
        local_time_short = dt_local.strftime("%I:%M %p local")
        local_time_full = dt_local.strftime("%B %d, %Y at %I:%M %p (%z)")
        local_voice_time = dt_local.strftime("%I:%M %p")
    except Exception:
        # Fallback based on longitude offset
        hours_offset = round(lon / 15.0)
        offset_delta = datetime.timedelta(hours=hours_offset)
        dt_local = dt_utc + offset_delta
        local_time_short = dt_local.strftime("%I:%M %p local")
        local_time_full = dt_local.strftime("%B %d, %Y at %I:%M %p local")
        local_voice_time = dt_local.strftime("%I:%M %p")

    return {
        "utc_short": utc_time_short,
        "utc_full": utc_date_str,
        "local_short": local_time_short,
        "local_full": local_time_full,
        "local_voice": local_voice_time,
        "tz_name": tz_name
    }
