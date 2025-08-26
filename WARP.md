# WARP.md

This file provides guidance to WARP (warp.dev) when working with code in this repository.

## Overview

This is a Next.js 15 React application that provides pilot situational awareness through real-time airport data visualization. The application connects to an ATC backend system to display airport information, weather conditions, PIREPs (Pilot Reports), ground tracks, and situation summaries on an interactive map interface.

## Development Commands

### Core Development
```bash
# Start development server with Turbopack
npm run dev

# Build for production with Turbopack
npm run build

# Start production server
npm start

# Run linting
npm run lint
```

### Package Management
```bash
# Install dependencies
npm install

# Add a new dependency
npm install <package-name>

# Add a dev dependency
npm install -D <package-name>
```

## Architecture Overview

### Application Structure
- **Next.js App Router**: Uses the new App Router architecture (`src/app/`)
- **Component-Based UI**: React components organized in `src/components/`
- **Real-time Data**: Socket.io client integration for live updates
- **Type Safety**: Full TypeScript implementation with comprehensive type definitions

### Key Architecture Patterns

#### Data Flow
1. **Central Data Management**: `usePilotData` hook manages all application state
2. **API Service Layer**: `src/services/api.ts` handles all backend communication
3. **Real-time Updates**: Socket.io maintains live connection status and data refresh
4. **Error Handling**: Comprehensive error boundaries and API error handling

#### Component Hierarchy
- `PilotDashboard` (main container)
  - `AirportSelector` (airport selection dropdown)
  - `ConnectionStatus` (real-time connection monitoring)
  - `PilotMap` (interactive Leaflet map with overlays)
  - `SituationOverview` (weather and conditions summary)
  - `PirepsList` (pilot reports list)
  - `MapControls` (map display toggles)

#### Backend Integration
The application expects an ATC backend running on `localhost:3001` (configurable via `NEXT_PUBLIC_API_BASE_URL`) with these endpoints:
- `/api/pilot/airports` - Available airports list
- `/api/pilot/{airportId}/overview` - Airport details, weather, runways
- `/api/pilot/{airportId}/pireps` - Pilot reports for airport
- `/api/pilot/{airportId}/tracks` - Ground movement tracks
- `/api/pilot/{airportId}/summary` - AI-generated situation summary
- `/api/pilot/health` - Backend health check

### Data Models

#### Core Types (`src/types/index.ts`)
- **Airport**: Basic airport information with position and status
- **AirportOverview**: Complete airport data including weather, runways, approaches
- **PiRep**: Pilot reports with position, priority, and message
- **GroundTrack**: Aircraft movement data with runway information
- **SituationSummary**: AI-generated conditions overview with status levels
- **ConnectionStatus**: Real-time connection monitoring

#### State Management
- Centralized in `usePilotData` hook using React useState
- Auto-refresh every 30 seconds when connected
- Connection testing every 10 seconds
- Parallel data loading with Promise.allSettled for resilience

### Map Integration

#### Leaflet Configuration
- Uses react-leaflet for interactive mapping
- Displays runways, DME rings, waypoints, approach routes
- Real-time PIREP and ground track overlays
- Configurable display options via `MapDisplayOptions`

#### Static Data
- Airport configurations in `src/constants/airports.ts`
- Includes runway data, approach waypoints, DME rings
- Currently supports KLAX, KSBA, KSMO, KDEN

### Styling and UI
- **Tailwind CSS 4**: Utility-first styling with dark theme
- **Radix UI**: Accessible component primitives for dialogs, selects
- **Lucide Icons**: Consistent iconography
- **Responsive Design**: Single-page dashboard layout optimized for desktop

### Error Handling Strategy
- **API Errors**: Custom `ApiError` class with status codes
- **Connection Resilience**: Graceful degradation when backend unavailable
- **Partial Failures**: Individual data loading failures don't crash the app
- **User Feedback**: Clear error messages and connection status indicators

## Environment Variables

```bash
# Backend API base URL (defaults to http://localhost:3001)
NEXT_PUBLIC_API_BASE_URL=http://localhost:3001
```

## Development Notes

### Real-time Features
- Connection status monitoring with latency display
- Auto-refresh of data when connected
- Visual indicators for offline/degraded states
- PIREP dismissal functionality (logged to console)

### Performance Considerations
- Data fetching uses Promise.allSettled to avoid blocking on single failures
- Efficient re-rendering with proper React hooks dependencies
- Map overlays are conditionally rendered based on display options

### Backend Dependencies
This frontend application is designed to work with the separate ATC backend service that provides:
- Airport operational data
- Weather information (METAR parsing)
- PIREP collection and processing
- Ground track monitoring
- AI-powered situation summaries

## Progressive Web App (PWA) Features

### Service Worker Implementation
- **Intelligent Caching**: Different caching strategies for static assets vs. API data
- **Network-First**: API calls try network first, fallback to cache when offline
- **Cache-First**: Static assets served from cache for optimal performance
- **Background Sync**: Automatic data updates when connectivity is restored

### Offline Support
- **Cached Data**: Essential airport data available offline
- **Graceful Degradation**: Clear indicators when operating from cached data
- **Offline Page**: Custom offline fallback with cached airport list
- **Connection Recovery**: Automatic background sync when reconnected

### Installation & PWA Manifest
- **Installable**: Can be installed as native-like app on supported devices
- **App Shortcuts**: Quick access to common functions via PWA manifest
- **Theme Integration**: Properly configured for iOS/Android home screen
- **Standalone Mode**: Runs in app-like experience without browser chrome

### Caching Strategy Details
```javascript
// Static Assets: Long-term cache
- Application shell (HTML, CSS, JS)
- Icons and manifest
- Offline fallback page

// API Data: Intelligent cache with TTL
- Airports list: 1 hour cache
- Airport overviews: 1 hour cache  
- PIREPs: 2 minute cache (real-time data)
- Ground tracks: 2 minute cache (real-time data)
- Health checks: No cache (always fresh)
```

### PWA Development Commands
```bash
# Test PWA features in development
npm run dev

# Build optimized PWA for production
npm run build

# Serve PWA build locally to test service worker
npx serve out
```

### PWA Testing Checklist
- [ ] Service worker registers successfully
- [ ] Offline mode works with cached data
- [ ] Install prompt appears on supported browsers
- [ ] Background sync triggers when reconnected
- [ ] App works in standalone mode
- [ ] Icons and manifest load correctly
