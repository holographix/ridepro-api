# FIT Files - Detailed Data Contents Analysis

## Quick Answer to Your Questions

### ✅ **YES - There is GPS data for mapping!**
- Outdoor rides (TrainingPeaks from Garmin) have full GPS coordinates
- Zwift rides have "virtual GPS" (tracks position on virtual courses)
- Can plot routes on maps using Leaflet/Mapbox

### ✅ **YES - There are multiple vitals & time-series data for charts!**
Available data streams:
- **Power** (Zwift only) - second-by-second watts
- **Heart Rate** (all activities) - BPM every second
- **Cadence** (Zwift only) - RPM
- **Speed** (all) - m/s or km/h
- **Altitude/Elevation** (all) - meters above sea level
- **Temperature** (outdoor only) - degrees Celsius
- **Distance** (all) - cumulative meters

### ✅ **YES - Can calculate FTP and advanced metrics!**
From power data (Zwift files):
- Normalized Power (NP)
- Intensity Factor (IF)
- Training Stress Score (TSS)
- Power zones distribution
- Average/max power
- FTP estimation (from 20min or 5min efforts)

---

## File-by-File Data Breakdown

### 📱 OUTDOOR RIDES (TrainingPeaks/Garmin)

#### tp-5307876.2025-11-27 (65.9km road ride)
**17,582 data points** (1 per second for 4h 51min)

**🌍 GPS & Location Data:**
```
✅ Latitude/Longitude (semicircles format)
✅ Route mapping possible
✅ Can show where athlete rode
```

**❤️ Vital Signs:**
```
✅ Heart Rate: 131 avg, 175 max (every second)
✅ Temperature: 5°C (outdoor conditions)
```

**📏 Elevation Data:**
```
✅ Altitude: Enhanced precision altitude
✅ Can calculate: Total ascent/descent
✅ Can chart: Elevation profile over distance
```

**🚴 Speed & Distance:**
```
✅ Speed: enhanced_speed (m/s) every second
✅ Distance: Cumulative meters
✅ Can calculate: Avg speed, max speed, pace
```

**❌ Missing Data:**
```
- NO Power (no power meter on outdoor bike)
- NO Cadence (no cadence sensor)
- NO Advanced metrics (pedal smoothness, balance)
```

**Chart Possibilities:**
1. 🗺️ **Interactive Map** - Full GPS route overlay
2. ⛰️ **Elevation Profile** - Distance vs altitude chart
3. ❤️ **Heart Rate Chart** - Time vs BPM with zones
4. 🏃 **Speed Chart** - Time vs km/h
5. 📊 **HR Zones Distribution** - Time in each zone
6. 📈 **Multi-axis Chart** - Speed + HR + Elevation combined

---

### 🎮 INDOOR RIDES (Zwift)

#### zwift-activity-2016248599700062240 (45.6km, 72min)
**4,363 data points** (1 per second)

**🌍 Virtual GPS:**
```
✅ Latitude/Longitude (Zwift virtual world coordinates)
✅ Can map virtual route (Watopia, London, etc.)
✅ Virtual elevation data
```

**⚡ POWER DATA - FULL TELEMETRY:**
```
✅ Power: Real-time watts (every second)
   - Actual: 183W avg, 289W max
   - Target: 90W (structured workout target)
✅ Can calculate:
   - Normalized Power (NP)
   - Intensity Factor (IF)
   - Training Stress Score (TSS)
   - Power zones distribution (Z1-Z6)
   - FTP estimation from efforts
   - Variability Index (VI)
```

**❤️ Vital Signs:**
```
✅ Heart Rate: 129 avg, 168 max (every second)
✅ Can analyze:
   - HR zones distribution
   - Cardiac drift
   - Decoupling (HR vs Power relationship)
```

**🚴 Cycling Metrics:**
```
✅ Cadence: 80 avg RPM (every second)
✅ Speed: 10.46 m/s avg, 13.29 max
✅ Distance: Cumulative meters
✅ Target Power: Structured workout targets
```

**📏 Elevation (Virtual):**
```
✅ Altitude: Virtual elevation on Zwift courses
✅ Enhanced altitude precision
✅ Can show: Climbs, descents, elevation profile
```

**Chart Possibilities:**
1. 🗺️ **Virtual Map** - Zwift route on virtual world map
2. ⚡ **Power Chart** - Time vs watts with zones
3. ❤️ **Power + HR Dual Chart** - Overlay both metrics
4. 📊 **Power Distribution** - Watts histogram
5. 🎯 **Power Zones** - Time in Z1-Z6
6. ❤️ **HR Zones Distribution** - Time in HR zones
7. 🚴 **Cadence Chart** - Time vs RPM
8. 🏃 **Speed Chart** - Time vs km/h
9. ⛰️ **Elevation Profile** - Virtual climb profile
10. 📈 **Multi-Chart Dashboard** - All metrics combined
11. 🎯 **Target vs Actual** - Planned power vs actual power
12. 📊 **Lap Analysis** - 18 laps/segments breakdown

---

## GPS Data Format

### Coordinate System
```
position_lat: 527684015 semicircles
position_long: 97797437 semicircles
```

**Conversion to Decimal Degrees:**
```javascript
decimal_degrees = semicircles * (180 / 2^31)

// Example:
lat = 527684015 * (180 / 2147483648) = 44.256° N
lon = 97797437 * (180 / 2147483648) = 8.199° E
```

This is standard Garmin/FIT format.

---

## Power Metrics Explained

From Zwift data, you can calculate:

### 1. **Normalized Power (NP)**
```
Formula: Fourth root of (30-second moving average of power^4)
Use: Better representation of physiological cost than avg power
```

### 2. **Intensity Factor (IF)**
```
Formula: NP / FTP
Range: 0.50 (easy) to 1.05+ (very hard)
Use: Measures workout intensity relative to threshold
```

### 3. **Training Stress Score (TSS)**
```
Formula: (duration_hours × NP × IF × 100) / FTP
Range: 20-50 (easy), 50-100 (moderate), 100-200 (hard), 200+ (very hard)
Use: Quantifies training load for planning and recovery
```

### 4. **Variability Index (VI)**
```
Formula: NP / Average Power
Range: 1.0 (perfectly steady) to 1.5+ (very variable)
Use: Measures how steady the power output was
```

### 5. **FTP Estimation**
From the data, you can estimate FTP using:
- **20-minute test**: Max 20min avg power × 0.95
- **5-minute test**: Max 5min avg power × 0.93
- **Ramp test**: Max 1min avg power × 0.75

---

## Time-Series Data Available

### Every Record (1-second resolution):

| Metric | Outdoor (Garmin) | Indoor (Zwift) | Unit | Use |
|--------|-----------------|----------------|------|-----|
| **Timestamp** | ✅ | ✅ | datetime | X-axis for all charts |
| **GPS Lat/Long** | ✅ | ✅ (virtual) | semicircles | Map plotting |
| **Altitude** | ✅ | ✅ (virtual) | meters | Elevation profile |
| **Heart Rate** | ✅ | ✅ | BPM | HR zones, effort analysis |
| **Power** | ❌ | ✅ | watts | Power zones, NP, IF, TSS |
| **Cadence** | ❌ | ✅ | RPM | Pedaling efficiency |
| **Speed** | ✅ | ✅ | m/s | Pace analysis |
| **Distance** | ✅ | ✅ | meters | Route length |
| **Temperature** | ✅ | ❌ | °C | Weather conditions |
| **Target Power** | ❌ | ✅ | watts | Structured workout compliance |

---

## Visualization Recommendations

### Priority 1: Activity Viewer (like Strava/TrainingPeaks)

**Map Component:**
```typescript
// Use Leaflet or Mapbox
- Plot GPS route as polyline
- Color-code by power/HR zones
- Show start/end markers
- Interactive hover: show data at point
- Zoom to fit route
```

**Multi-Chart Dashboard:**
```typescript
// Use visx, Chart.js, or Recharts

Chart 1: Power over Time
- Line chart: Time (x) vs Watts (y)
- Color zones: Z1 (gray), Z2 (blue), Z3 (green), Z4 (yellow), Z5 (orange), Z6 (red)
- Show avg, NP lines

Chart 2: Heart Rate over Time
- Line chart: Time (x) vs BPM (y)
- Color HR zones
- Show avg, max lines

Chart 3: Elevation Profile
- Area chart: Distance (x) vs Altitude (y)
- Fill color: gradient
- Show total ascent/descent

Chart 4: Cadence over Time (if available)
- Line chart: Time (x) vs RPM (y)
- Show avg line

Chart 5: Speed over Time
- Line chart: Time (x) vs km/h (y)
- Show avg, max lines
```

**Summary Stats Panel:**
```typescript
{
  duration: "1h 27min",
  distance: "45.6 km",
  avgPower: "183W",
  normalizedPower: "195W",
  intensityFactor: "0.78",
  tss: "87",
  avgHR: "129 bpm",
  avgCadence: "80 rpm",
  avgSpeed: "31.3 km/h",
  elevation: "+245m / -238m",
  temperature: "5°C",
  calories: "765"
}
```

**Zones Distribution:**
```typescript
// Donut or bar charts
Power Zones:
- Z1: 12% (5min)
- Z2: 45% (32min)
- Z3: 28% (20min)
- Z4: 10% (7min)
- Z5: 5% (4min)
- Z6: 0%

HR Zones:
- Z1: 15%
- Z2: 50%
- Z3: 25%
- Z4: 8%
- Z5: 2%
```

### Priority 2: Comparison View

**Planned vs Actual:**
```typescript
// For structured workouts (Zwift)
- Overlay target power (from FIT) vs actual power
- Show compliance %
- Highlight where athlete went off-target
```

**Lap-by-Lap Analysis:**
```typescript
// Zwift has 18 laps - analyze each
Lap 1: 3:45, 195W avg, 140 bpm avg
Lap 2: 3:52, 188W avg, 145 bpm avg
...
```

---

## Example Code Snippet - GPS Conversion

```typescript
// Convert FIT semicircles to decimal degrees
function semicirclesToDegrees(semicircles: number): number {
  return semicircles * (180 / Math.pow(2, 31));
}

// Parse FIT records for mapping
interface GpsPoint {
  lat: number;
  lng: number;
  altitude: number;
  power?: number;
  hr?: number;
  time: Date;
}

function parseGpsPoints(records: FitRecord[]): GpsPoint[] {
  return records
    .filter(r => r.position_lat && r.position_long)
    .map(r => ({
      lat: semicirclesToDegrees(r.position_lat),
      lng: semicirclesToDegrees(r.position_long),
      altitude: r.enhanced_altitude || r.altitude || 0,
      power: r.power,
      hr: r.heart_rate,
      time: new Date(r.timestamp),
    }));
}
```

---

## Next Steps for Import Feature

### Phase 1: Activity Upload & Parsing
```
POST /api/activities/upload
- Accept .fit or .fit.gz files
- Parse using fitparse or fit-file-parser (npm)
- Extract all telemetry data
- Store raw data in database
```

### Phase 2: Activity Viewer UI
```
- Map component (Leaflet)
- Multi-chart dashboard (visx)
- Summary stats panel
- Zones distribution
- Export to other formats (GPX, TCX)
```

### Phase 3: Training Analysis
```
- Calculate NP, IF, TSS
- Compare planned vs actual
- Track training load over time
- Fatigue/Fitness/Form (TSB) tracking
- FTP estimation from power curves
```

---

## Summary

**YES to all your questions:**

1. ✅ **GPS data for mapping** - Full GPS tracks available (outdoor + virtual)
2. ✅ **Power time-series** - Second-by-second watts (Zwift files)
3. ✅ **Heart rate time-series** - Every second (all files)
4. ✅ **Cadence, speed, altitude** - Full telemetry (varies by file)
5. ✅ **FTP & advanced metrics** - Can calculate from power data
6. ✅ **Multiple chart types** - 10+ visualization options
7. ✅ **Structured workout data** - Target power vs actual (Zwift)

The data is **RICH** and suitable for building a comprehensive activity analysis feature similar to Strava, TrainingPeaks, or GarminConnect!
