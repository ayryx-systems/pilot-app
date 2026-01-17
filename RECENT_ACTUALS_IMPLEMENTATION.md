# Recent Actuals Feature - Implementation Summary

## What It Does

Shows **actual ADSB-detected arrival counts** as **purple dots** on the Traffic Pattern graph, overlaid on the FAA forecast line (orange) to validate prediction accuracy in real-time.

**Purple dots = What actually happened (ADSB)**  
**Orange line = What FAA predicted (flight plans)**

This allows pilots and controllers to see at a glance whether the forecast is accurate or if actual traffic is higher/lower than predicted.

## How It Works

### Backend Part 1: Completion Status (`core/src/services/faAadcService.js`)

The FAA forecast parser calculates which time slots are completed:

```javascript
// In parseArrivalForecast()
const currentLocalTime = nowLocal.getTime();
const isCompleted = filteredSlots.map(slot => {
  // Add 15 minutes so current slot completes after it ends
  return slot.localTime < (currentLocalTime + 15 * 60 * 1000);
});

return {
  timeSlots: [...],
  arrivalCounts: [...],  // FAA forecast
  isCompleted: [...],    // Slot completion status
  ...
};
```

### Backend Part 2: Actual Arrival Aggregation (`core/src/api/pilot-api.js`)

The pilot API aggregates actual ADSB-detected arrivals by time slot:

```javascript
// In /api/pilot/:airportId/arrival-forecast endpoint
const recentArrivals = processor.arrivalTimeService.getRecentArrivals() || [];

// Group by 15-minute time slots in airport local time
const actualCountsBySlot = new Map();
recentArrivals.forEach(arrival => {
  const landingTime = new Date(arrival.timestampLanding);
  
  // Convert to airport local time
  const offsetHours = getAirportUTCOffset(airportId, landingTime, baseline);
  const localTime = new Date(landingTime.getTime() + offsetHours * 60 * 60 * 1000);
  
  // Round to 15-minute slot
  const localHours = localTime.getUTCHours();
  const localMinutes = Math.floor(localTime.getUTCMinutes() / 15) * 15;
  const timeSlot = `${localHours}:${localMinutes}`;
  
  actualCountsBySlot.set(timeSlot, (actualCountsBySlot.get(timeSlot) || 0) + 1);
});

// Align with forecast time slots
forecast.actualCounts = forecast.timeSlots.map(slot => 
  actualCountsBySlot.get(slot) || null
);
```

**Key Points:**
- ✓ Uses `ArrivalTimeService.getRecentArrivals()` - real ADSB landings from last 2 hours
- ✓ Groups arrivals by 15-minute time slots (same as FAA forecast)
- ✓ All timezone conversions in backend (airport local time)
- ✓ Returns `actualCounts[]` aligned with forecast `timeSlots[]`

### Frontend (`pilot-app/src/components/TimeBasedGraphs.tsx`)

The frontend displays actual arrival counts as purple dots:

```typescript
if (arrivalForecast.actualCounts) {
  const recentActualsData = alignment.alignedTimeSlots.map((slot, idx) => {
    const forecastSlotIdx = arrivalForecast.timeSlots.indexOf(slot);
    if (forecastSlotIdx === -1) return null;
    
    // Use ACTUAL arrival count (from ADSB), not forecast
    const actualCount = arrivalForecast.actualCounts[forecastSlotIdx];
    if (!actualCount) return null;
    
    // Only show if slot is completed (in the past)
    if (arrivalForecast.isCompleted?.[forecastSlotIdx]) {
      return actualCount;  // ← Real ADSB count, not forecast!
    }
    
    return null;
  });
  
  // Display as purple dots
  datasets.push({
    label: 'Recent Actuals',
    data: recentActualsData,
    showLine: false,
    pointRadius: 4,
    pointBackgroundColor: '#a855f7',
    pointBorderColor: '#ffffff',
    order: 0  // On top
  });
}
```

**Key Points:**
- ✓ Displays `actualCounts[]` (real ADSB data), not `arrivalCounts[]` (forecast)
- ✓ No timezone arithmetic in frontend
- ✓ Only shows for completed slots (`isCompleted === true`)
- ✓ Works correctly regardless of user's timezone
- ✓ 4px purple dots with white borders
- ✓ Rendered on top of all other lines (order: 0)

**Comparison:**
- Orange line shows `arrivalCounts` = FAA forecast (predicted)
- Purple dots show `actualCounts` = ADSB reality (what happened)

## Visual Design

**Graph Layers** (bottom to top):
1. 🟢 Green dashed line: Seasonal average (order: 3)
2. 🔵 Blue line: Day-of-week baseline (order: 2)
3. 🟠 Orange dashed line: FAA forecast (order: 1)
4. 🟣 Purple dots: Recent actuals (order: 0) **← Always visible on top**

**Purple Dot Styling:**
- Size: 4px radius
- Color: #a855f7 (purple)
- Border: 2px white
- Only appears for completed slots

## Use Cases

1. **Forecast Validation**: See if FAA predictions match reality
2. **Traffic Monitoring**: Track actual arrival rates vs expected
3. **Situational Awareness**: Understand recent traffic patterns
4. **Accuracy Assessment**: Evaluate forecast reliability

## Examples

### Example 1: Forecast Matches Actuals ✓
```
Time:    13:00  13:15  13:30  13:45  14:00  14:15
Orange:    12     15     14     16     18     20   ← FAA forecast (predicted)
Purple:    12     15     14     16     --     --   ← ADSB actuals (reality)
Status:  ✓done  ✓done  ✓done  ✓done  future future
```
**Analysis:** Purple dots align with orange line → forecast is accurate! ✓  
**Meaning:** FAA predictions matched reality perfectly. Flight plan counts are reliable.

### Example 2: Forecast Over-Predicted ⚠️
```
Time:    13:00  13:15  13:30  13:45  14:00  14:15
Orange:    20     22     25     28     30     32   ← FAA forecast (predicted)
Purple:    12     15     14     16     --     --   ← ADSB actuals (reality - lower!)
Status:  ✓done  ✓done  ✓done  ✓done  future future
```
**Analysis:** Purple dots below orange line → forecast over-predicted by ~40% ⚠️  
**Meaning:** Many filed flight plans didn't actually arrive. Possible causes:
- Flight cancellations
- Diversions to other airports
- Delays pushing arrivals to later time slots

### Example 3: Forecast Under-Predicted ⚠️
```
Time:    13:00  13:15  13:30  13:45  14:00  14:15
Orange:    10     12     11     13     15     16   ← FAA forecast (predicted)
Purple:    18     20     22     24     --     --   ← ADSB actuals (reality - higher!)
Status:  ✓done  ✓done  ✓done  ✓done  future future
```
**Analysis:** Purple dots above orange line → forecast under-predicted by ~80% ⚠️  
**Meaning:** More traffic than expected. Possible causes:
- Aircraft without flight plans (GA traffic)
- Late flight plan filings
- Pop-up IFR traffic
- Military or special operations

### Example 4: Mixed Performance
```
Time:    13:00  13:15  13:30  13:45  14:00  14:15
Orange:    15     18     20     22     25     28   ← FAA forecast
Purple:    15     20     16     22     --     --   ← ADSB actuals (mixed)
Status:  ✓done  ✓done  ✓done  ✓done  future future
```
**Analysis:** Some slots match, some don't → variable accuracy  
**Meaning:** Forecast is generally reliable but with occasional variance. Normal operational pattern.

## Data Sources Explained

### Orange Line (FAA Forecast)
**Source:** FAA AADC (Aircraft Arrival Demand Chart) API  
**Data:** Filed IFR flight plans arriving at the airport  
**Nature:** Predictive - shows what's planned/expected  
**Update:** Every 5 minutes via FAA TFMS (Traffic Flow Management System)  
**Limitations:**
- Only includes aircraft with filed flight plans
- Doesn't account for cancellations or diversions
- May miss late filings or pop-up IFR traffic
- Flight plans can change after filing

### Purple Dots (Recent Actuals)
**Source:** AYRYX ADSB tracking via `ArrivalTimeService`  
**Data:** Actual aircraft landings detected by ADSB receivers  
**Nature:** Historical - shows what actually happened  
**Update:** Real-time as aircraft land (from ADSB aggregator)  
**Coverage:**
- All aircraft with ADSB transponders (commercial + equipped GA)
- Includes both IFR and VFR traffic
- Captures actual touchdown times
- Tracks all arrivals within monitoring radius

### Why They Differ

**Purple > Orange (More actuals than forecast):**
- VFR traffic without flight plans
- GA aircraft flying IFR but filing late
- Military/special operations
- Pop-up IFR clearances

**Purple < Orange (Fewer actuals than forecast):**
- Flight cancellations
- Weather diversions
- Delays shifting arrivals to later slots
- Aircraft landing at alternate airports

**Purple ≈ Orange (Match):**
- Forecast is accurate
- Most filed flights arrived as planned
- Normal operations

## Update Mechanism

**Efficient Design - No Extra API Calls:**
- `actualCounts` comes bundled with the **arrivals endpoint** (not forecast endpoint)
- No separate polling needed - arrivals already refreshed every 30 seconds
- Purple dots update automatically as the arrivals list refreshes

**Why Bundle with Arrivals?**
- **Same data source**: Both use `ArrivalTimeService.getRecentArrivals()`
- **Zero extra overhead**: Just adds aggregation to existing data
- **Semantic fit**: Individual arrivals + time slot counts = complete picture
- **No duplicate API calls**: Reuses existing polling interval

**Update Flow:**
1. Aircraft lands → Detected by ADSB aggregator
2. `ArrivalTimeService` records landing in `completedArrivals`
3. 30 seconds later → Pilot app polls `/api/pilot/:airportId/arrivals` (already happening)
4. Backend returns:
   - Individual arrivals list (for timeline display)
   - `actualCounts` aggregated by 15-min slots with completion status
   - Only slots that are **15+ minutes in the past** are marked completed
5. Frontend merges completed `actualCounts` into `arrivalForecast` state
6. Purple dot appears on graph **15 minutes after the slot ends**

**15-Minute Completion Rule:**
- Time slots are marked complete only when **current time > slot time + 15 minutes**
- Example: 21:30 slot completes at 21:45, not before
- **Why?** Ensures we've captured all arrivals for that slot before displaying
- **Prevents:** Showing artificially low counts for incomplete slots
- **Result:** Purple dots only appear when the count is truly final

**Efficiency Benefits:**
- ✅ No extra API endpoint needed
- ✅ No separate polling required  
- ✅ Data updates every 30 seconds (same as arrivals)
- ✅ Single aggregation per request (not duplicate in two endpoints)

## Benefits

1. **Real Comparison**: Shows actual ADSB data vs FAA predictions (not forecast vs itself!)
2. **No Frontend Timezone Logic**: Backend handles all time comparisons
3. **Reliable**: Works correctly regardless of user's timezone or DST
4. **Simple**: Frontend just displays, doesn't calculate
5. **Automatic Updates**: Purple dots appear automatically every 30s as aircraft land
6. **Visual**: Immediate feedback on forecast accuracy
7. **Operational Value**: Helps pilots/controllers trust (or adjust) FAA predictions
8. **Low Overhead**: Efficient polling with backend caching

## Architecture Principle

**"No timezone arithmetic in frontend"**

The backend knows:
- Current time in airport local time
- Each slot's time in airport local time
- Whether slot is completed (past) vs future

The frontend just displays the data - no calculations needed.

## Related Files

- `core/src/services/faAadcService.js` - Backend implementation
- `pilot-app/src/components/TimeBasedGraphs.tsx` - Frontend display
- `pilot-app/src/types/index.ts` - TypeScript interface
- `pilot-app/TRAFFIC_PATTERN_BASELINE_FALLBACK.md` - Full feature documentation
