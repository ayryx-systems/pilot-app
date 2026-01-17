# Traffic Pattern Baseline Fallback Implementation

## Summary

Fixed the Traffic Pattern display in the pilot app to properly handle time ranges beyond FAA arrival forecast coverage by falling back to historical baseline day-of-week averages in the summary text. The graph keeps FAA and baseline data cleanly separated on different lines.

## Problems Fixed

### 1. Zero Arrivals Beyond Forecast Range
**Issue**: When pushing the ETA beyond FAA forecast coverage (typically beyond a few hours), the traffic summary showed "Light: 0 arrivals expected following hour" instead of using historical baseline data.

**Root Cause**: The traffic summary calculation only summed FAA forecast slots and returned 0 when no forecast data was available for the selected time range.

**Solution**: 
- Detect when no FAA forecast data is available for the next hour
- Fall back to baseline day-of-week average for the same time slots
- Sum up the baseline averages for all 15-minute slots in the next hour
- Add clear data source labels: "(flight plans)" for FAA data, "(baseline avg)" for historical data

### 2. Tomorrow Showing Today's Data
**Issue**: When selecting a time >24 hours in the future (tomorrow), the traffic forecast would sometimes show non-zero values that appeared to be today's FAA predictions incorrectly applied to tomorrow.

**Root Cause**: The FAA forecast includes slots from both today and tomorrow (with `slotDates` field), but the traffic summary wasn't filtering by date when matching time slots.

**Solution**:
- Use the `slotDates` field from the FAA forecast to filter slots by date
- Only include slots that match the selected date string
- Properly handle date boundaries when calculating next hour ranges

## Changes Made

### `pilot-app/src/components/PilotDashboard.tsx`

Enhanced the `trafficSummary` calculation (lines 756-785) to:

1. **Add Date Filtering**:
   - Generate selected date string (`YYYY-MM-DD` format)
   - Check `arrivalForecast.slotDates[idx]` to ensure slot matches selected date
   - Fall back to legacy behavior if `slotDates` not available

2. **Add Baseline Fallback Logic**:
   - Track `hasForecastData` flag to detect when no FAA data is available
   - When no forecast data found, calculate baseline average:
     - Determine airport local date/time considering DST
     - Get day-of-week (e.g., "monday", "tuesday")
     - Get season (summer/winter)
     - Access baseline day-of-week time slot data
     - Sum all 15-minute baseline averages in the next hour
   - Add data source suffix to summary:
     - "(flight plans)" when using actual FAA forecast data
     - "(baseline avg)" when using historical baseline data

3. **Utility Functions Added**:
   - `getDateString(date)`: Format date as YYYY-MM-DD
   - `getAirportLocalDateString(date)`: Get airport local date string
   - `getDayOfWeek(dateStr)`: Convert date string to day name
   - `getSeason(date)`: Determine season based on month
   - `getUTCOffsetHours(airportCode, date, baseline)`: Calculate timezone offset with DST support

### `pilot-app/src/components/TimeBasedGraphs.tsx`

Enhanced to display Recent Actuals using backend-provided completion status:

1. **FAA Forecast Display**:
   - Orange line shows only actual FAA forecast data
   - Line naturally stops when FAA data ends
   - No backfilling with baseline data (baseline already shown as blue line)
   - Maintains clean separation between data sources

2. **Recent Actuals Overlay**:
   - Displays purple dots for completed time slots
   - Uses `arrivalForecast.isCompleted[]` array from backend
   - No timezone arithmetic in frontend
   - Backend determines completion status in airport local time
   - 4px dots with white borders, rendered on top (order: 0)

3. **Date Filtering**:
   - Uses `slotDates` field to filter forecast slots by selected date
   - Prevents tomorrow from showing today's forecast data

### `core/src/services/faAadcService.js`

Added completion status calculation to FAA forecast parsing:

1. **isCompleted Array**:
   - Calculates which slots are completed (in the past) vs future
   - Compares slot time to current time in airport local time
   - Adds 15-minute grace period so current slot completes after it ends
   - Returns boolean array alongside forecast data
   - All timezone logic handled in backend using existing utilities

### `core/src/api/pilot-api.js` - Arrival Forecast Endpoint

Added actual arrival aggregation to forecast response:

1. **Actual Arrival Aggregation**:
   - Fetches recent arrivals from `ArrivalTimeService` (last 2 hours of ADSB landings)
   - Groups arrivals by 15-minute time slots in airport local time
   - Creates `actualCounts[]` array aligned with forecast `timeSlots[]`
   - Returns both `arrivalCounts` (FAA forecast) and `actualCounts` (ADSB reality)
   - Graceful degradation if processor/service unavailable (all nulls)

2. **Data Flow**:
   - `ArrivalTimeService.getRecentArrivals()` → Real ADSB landing times
   - Convert each landing to airport local time (DST-aware)
   - Round down to 15-minute slot (e.g., 13:37 → 13:30)
   - Count arrivals per slot
   - Align with forecast time slots
   - Return as `actualCounts[]` alongside forecast

### `pilot-app/src/types/index.ts`

Updated ArrivalForecast interface to include completion status:

1. **isCompleted Field**:
   - Optional boolean array indicating which slots are completed
   - Provided by backend (no frontend calculation needed)
   - Used to display Recent Actuals purple dots

## Data Flow

### FAA Forecast Structure
The FAA forecast service returns:
```typescript
{
  timeSlots: string[];        // ["08:00", "08:15", "08:30", ...]
  arrivalCounts: number[];    // [12, 15, 18, ...] ← FAA FORECAST (predicted)
  actualCounts: number[];     // [13, 14, null, null, ...] ← ADSB ACTUAL (reality)
  slotDates: string[];        // ["2026-01-16", "2026-01-16", "2026-01-17", ...]
  isCompleted: boolean[];     // [true, true, false, false, ...]
  ...
}
```

- `timeSlots`: Local time in HH:MM format (15-minute intervals)
- `arrivalCounts`: **FAA forecast** - number of arrivals expected per filed flight plans
- `actualCounts`: **ADSB reality** - actual arrivals detected by ADSB tracking (null for future slots)
- `slotDates`: Date string for each slot (YYYY-MM-DD in airport local time)
- `isCompleted`: Boolean for each slot indicating if it's in the past (completed)
- Coverage: Typically last 4 hours + next ~6-18 hours

**Graph Display:**
- 🟠 Orange line = `arrivalCounts` (what FAA predicts)
- 🟣 Purple dots = `actualCounts` (what ADSB detected)
- Comparison shows forecast accuracy

### Baseline Structure
The baseline data contains historical averages:
```typescript
{
  summer: {
    dayOfWeekTimeSlots: {
      monday: {
        "08:00": { averageCount: 12, averageArrivals: 12, ... },
        "08:15": { averageCount: 14, averageArrivals: 14, ... },
        ...
      },
      ...
    }
  },
  winter: { ... }
}
```

- Organized by season (summer/winter)
- Keyed by day of week
- Contains 15-minute time slot averages

## User Experience Improvements

### Before
- **Near-term (within forecast range)**: "Heavy: 45 arrivals expected next hour"
- **Beyond forecast range**: "Light: 0 arrivals expected following hour" ❌
- **Tomorrow**: "Light: 0 arrivals expected following hour" OR incorrect today's values ❌

### After
- **Near-term (within forecast range)**: "Heavy: 45 arrivals expected next hour (flight plans)" ✓
- **Beyond forecast range**: "Moderate: 23 arrivals expected following hour (baseline avg)" ✓
- **Tomorrow**: "Moderate: 25 arrivals expected following hour (baseline avg)" ✓
- **Graph**: Orange forecast line shows only FAA data (stops when data ends), blue baseline shows historical patterns ✓

### Data Source Indicators
- **(flight plans)**: Real FAA arrival forecast data from filed flight plans
- **(baseline avg)**: Historical day-of-week average when FAA data not available

## Testing Recommendations

1. **Test Near-Term Forecast**:
   - Select current time ("Now" mode)
   - Verify FAA forecast data is displayed
   - Summary should show "(flight plans)" suffix
   - Traffic level should reflect actual filed flight plans

2. **Test Beyond Forecast Range**:
   - Move time slider 12+ hours into the future
   - Verify baseline data is used
   - Summary should show "(baseline avg)" suffix
   - Traffic level should be reasonable (not "0 arrivals")

3. **Test Tomorrow**:
   - Move time slider 24+ hours into the future
   - Verify correct day-of-week baseline is used
   - Graph should show blue baseline line (orange FAA line will not appear as no forecast data available)

4. **Test Date Boundaries**:
   - Test times near midnight (23:00-01:00)
   - Verify date filtering works correctly across day boundaries
   - Verify timezone/DST handling is correct

5. **Test Different Airports**:
   - Test airports in different timezones (KLAX, KJFK, KORD)
   - Verify timezone offsets are calculated correctly
   - Verify DST transitions are handled properly

## Notes

- The baseline fallback provides reasonable estimates based on historical patterns
- Data source indicators clearly show what type of data is being displayed:
  - "(flight plans)" = Real FAA forecast from filed flight plans
  - "(baseline avg)" = Historical day-of-week average
- **Simple graph design with clear color coding**:
  - 🔵 Blue line = Day-of-week baseline
  - 🟢 Green dashed line = Seasonal average
  - 🟠 Orange dashed line = FAA Arrival Forecast
  - 🟣 Purple dots = Recent Actuals (completed slots only)
  - No mixing of data sources on a single line
  - Clear visual separation and layering (purple dots on top)
  - Orange line naturally stops when FAA data ends
- **Recent Actuals feature** (ADSB vs FAA comparison):
  - Shows **actual ADSB-detected arrival counts** as purple dots (5px)
  - Compares reality (ADSB) vs prediction (FAA flight plans)
  - **Bundled with arrivals endpoint** - no extra API calls needed
  - Backend aggregates actual landings by 15-minute time slots
  - **15-minute completion rule**: Dots only appear for slots that are 15+ minutes in the past
  - This ensures complete data (not artificially low counts for incomplete slots)
  - Backend determines which slots are completed (in airport local time)
  - Backend provides `actualCounts` in arrivals response, merged into forecast
  - Frontend displays purple dots for `actualCounts`, orange line for forecast
  - **Auto-updates every 30 seconds** via arrivals polling (already happening)
  - No timezone arithmetic in frontend - all time/aggregation done by backend
  - Purple dots with white borders for visibility, displayed on top of graph
  - Legend shows "Recent Actuals (ADSB)" with proper purple indicator (appears when dots exist)
  - Validates forecast accuracy in real-time
  - **Key insight**: Dots above line = more traffic than forecast, below = less
- Date filtering ensures tomorrow's predictions don't incorrectly use today's FAA data
- Timezone handling accounts for DST transitions using baseline metadata
- Both data sources are valuable: flight plans show actual near-term traffic, baseline provides long-term planning context

## Related Files

- `core/src/services/faAadcService.js`: FAA forecast fetching and parsing
- `core/src/api/pilot-api.js`: Backend API endpoints
- `pilot-app/src/types/index.ts`: TypeScript interface definitions
