# Timestamp Discrepancy Explained

## What You're Seeing

- **Bottom of page**: `2025-08-27 19:04:16 UTC` 
- **Weather modal**: `Last updated: 8/27/2025, 2:57:16 PM`

## Why They're Different

These are **two completely different timestamps** from **different sources**:

### 1. Bottom Timestamp (UTC)
- **Source**: Airport overview API response generation time
- **When**: When the pilot API server generated the response  
- **Timezone**: UTC (server time)
- **Location in code**: `timestamp: new Date().toISOString()` (line 212 in pilot-api.js)

### 2. Weather Modal Timestamp (Local Time)  
- **Source**: Weather observation time from weather service
- **When**: When the weather was actually observed/reported
- **Timezone**: Converted to your local timezone by browser
- **Location in code**: `weather.metar?.observation_time` (line 200 in pilot-api.js)

## The Time Difference Breakdown

**UTC**: 19:04:16 (7:04 PM)  
**Local**: 2:57:16 PM  

This suggests:
- **7-minute difference**: Weather was observed 7 minutes before the API response was generated
- **Timezone difference**: The modal shows local time (appears to be PST/PDT based on 4+ hour difference from UTC)

## This is Normal!

Weather observations don't happen exactly when you request the API. The weather service:
1. Observes conditions at 2:57 PM local time
2. You request airport data at 7:04 PM UTC (3:04 PM local) 
3. Server returns the 2:57 PM weather observation

## Now You Can See Both

The weather modal now shows:
- **Local time**: `Last updated: 8/27/2025, 2:57:16 PM`
- **UTC debug timestamp**: `🕐 2025-08-27 14:57:16 UTC` (weather observation)
- **Bottom debug timestamp**: `🕐 2025-08-27 19:04:16 UTC` (API response generation)

This is working correctly - you're seeing real weather observation times vs API response generation times!
