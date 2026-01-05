# Help System Documentation

## Overview

A comprehensive contextual help system has been added to the pilot app to guide users through the interface and explain key features.

## Implementation

### HelpButton Component

**Location:** `src/components/HelpButton.tsx`

A reusable help button component that displays contextual help information in a centered modal popup.

**Features:**
- Configurable size (sm, md, lg)
- Centered modal overlay (simpler and more robust than positioned popups)
- **React Portal rendering** - modal renders directly to document.body, bypassing parent container constraints
- Click-outside-to-close behavior
- Escape key to close
- Smooth animation on open/close
- Scrollable content for longer help text
- Modal backdrop prevents interaction with underlying content
- Supports both text and JSX content
- Not affected by parent overflow, transform, or stacking context properties

**Usage:**
```tsx
import { HelpButton } from './HelpButton';

<HelpButton
  title="Feature Name"
  size="sm"
  content={
    <div className="space-y-2">
      <p>Description of the feature...</p>
      <p><strong>Key point:</strong> Important information</p>
    </div>
  }
/>
```

## Help Locations

### 1. Main Dashboard Header
**Location:** Next to airport selector in top header  
**Purpose:** Explains the overall app purpose and DEMO disclaimer  
**Content:**
- Pre-flight planning tool overview
- Key features list (traffic, weather, ground tracks, PIREPs, what-if scenarios)
- Demo-only warning with disclaimer to use official aviation authorities

### 2. ETA Selector
**Location:** Next to time display in selector  
**Purpose:** Explains arrival time selection and weather scenarios  
**Content:**
- How to select arrival time
- NOW vs. Future time differences
- TAF forecasts from weather data
- What-if weather scenarios (VFR/MVFR/IFR/LIFR)
- Interactive time selection via slider or graph clicks

### 3. Arrival Forecast Section
**Location:** Section header above traffic graphs  
**Purpose:** Overview of arrival forecast features  
**Content:**
- Traffic volume predictions
- Duration timeline overview
- Interactive time selection by clicking graphs

### 4. Traffic Forecast Graph
**Location:** Top-right of graph card  
**Purpose:** Explains the traffic forecast visualization  
**Content:**
- Blue line: historical day-of-week average
- Green line: seasonal average across all days
- Orange line: FAA arrival forecast (when available)
- White dot: selected arrival time
- Sample sizes shown in tooltips
- Click-to-select time functionality

### 5. Arrival Duration Timeline
**Location:** Next to "Arrival Duration Timeline" title  
**Purpose:** Explains the scatter plot and arrival metrics  
**Content:**
- Vertical axis: duration from 50nm to touchdown
- Horizontal axis: landing time (hours from now)
- Colored dots: aircraft categories (light, regional, narrowbody, widebody, etc.)
- White dashed line: seasonal median duration
- Gray shaded areas: risk zones (P10-P90 range)
- Blue points: historical arrivals from similar weather days
- Click dots to view ground tracks on map

### 6. Conditions Overview
**Location:** In the "Conditions" section header  
**Purpose:** Explains status indicators and condition types  
**Content:**
- Green (normal), Yellow (caution), Red (warning) status meanings
- Weather: visibility, ceiling, wind, precipitation
- Traffic: arrival volume and congestion
- Approach: delays and procedures
- Special: NOTAMs, TFRs, closures
- Click conditions for detailed information

### 7. Map Layers Control
**Location:** Inside expanded layers menu  
**Purpose:** Explains available map layers  
**Content:**
- DME rings: distance circles (10, 25, 50nm)
- Waypoints: navigational fixes
- Extended centerlines: runway approach paths
- PIREPs (ATC): AI-extracted from communications
- PIREPs (Weather): official weather reports
- Ground tracks: arrival paths from 50nm for the last 30 minutes
- Weather radar: live precipitation data
- Airport features: runways, taxiways, structures
- Auto-saved preferences

### 8. Pilot Reports (PIREPs)
**Location:** In PIREP panel header  
**Purpose:** Explains PIREP priorities and sources  
**Content:**
- Urgent (red): critical conditions (severe turbulence/icing)
- High (yellow): significant conditions (moderate turbulence/icing)
- Normal (blue): standard reports (smooth, light chop)
- AI extraction from ATC audio disclaimer
- Not official FAA PIREPs warning
- Map display with approximate locations

### 9. FAA NAS Status
**Location:** In FAA Status section header  
**Purpose:** Explains FAA status indicators  
**Content:**
- Ground stops: all departures stopped
- Ground delays: pre-departure delays
- Arrival/departure delays: expected delays
- Airport configuration: runway config and rates
- Airport closures: full or partial
- De-icing: active de-icing operations
- 5-minute update frequency
- Official FAA advisory data

## Design Principles

### Visual Consistency
- Blue circular icon with question mark
- Consistent hover states
- Semi-transparent blue background
- Border highlighting on hover

### Positioning Strategy
- All help popups appear **centered on screen** with a modal overlay
- This approach is simpler and more robust than position-based popups
- Prevents positioning issues on different screen sizes
- Modal backdrop prevents interaction with underlying content
- Scrollable content for longer help text

### Content Guidelines
- Start with a clear one-sentence description
- Use bold text for key terms and values
- Include color coding explanations where relevant
- Provide actionable tips (e.g., "Click to...")
- Keep content concise but complete
- Use aviation terminology appropriately

### Accessibility
- High contrast colors (blue on dark slate)
- Clear close button (X icon)
- Click outside to close
- Keyboard-friendly (can be extended)
- High z-index for visibility

## Technical Details

### Z-Index Management
- Modal overlay: `z-[9999]` (Tailwind max z-index)
- **Portal rendering to document.body** ensures modal is at root level
- Not affected by parent stacking contexts
- Ensures help always appears above all other elements
- Modal backdrop prevents clicks on underlying content

### Animation
- Tailwind's `animate-in fade-in zoom-in` utility classes
- 200ms duration for smooth appearance
- Fade and scale effect for professional feel
- Modal backdrop fades in simultaneously

### Performance
- Minimal re-renders
- Event listeners cleaned up properly
- Click-outside detection via modal backdrop
- Escape key handler for accessibility
- Body scroll lock when modal is open
- Portal mounted/unmounted cleanly with component lifecycle
- No impact on main app performance

## Future Enhancements

Potential improvements to consider:

1. **Keyboard Support** ✅ IMPLEMENTED
   - Escape key to close ✅
   - Tab navigation (can be enhanced)
   - Focus management (can be enhanced)

2. **Tour Mode**
   - Sequential help popups
   - "Next" button to guide through features
   - First-time user onboarding

3. **Search**
   - Global help search
   - Help index
   - Quick access to specific topics

4. **Videos/GIFs**
   - Embedded demonstration videos
   - Animated explanations
   - Interactive tutorials

5. **Contextual Timing**
   - Auto-show help for new users
   - Show help on first visit to features
   - Remember dismissed helps

6. **Responsive Design**
   - Mobile-optimized positioning
   - Full-screen help on small screens
   - Touch-friendly interactions

## Maintenance

### Adding New Help
1. Import HelpButton: `import { HelpButton } from './HelpButton';`
2. Place next to the feature needing explanation
3. Provide clear title and content
4. Choose appropriate size (sm, md, lg)
5. No need to worry about positioning - all popups are centered

### Updating Content
- Edit the content prop in the component usage
- Keep language clear and concise
- Test readability with target users
- Update this documentation

### Testing Checklist
- [ ] Help button appears in correct position
- [ ] Popup opens on click
- [ ] Content is readable and formatted correctly
- [ ] Popup closes on outside click
- [ ] Popup closes on X button click
- [ ] No overlap issues with other UI elements
- [ ] Works on desktop and tablet views
- [ ] Animation is smooth
- [ ] Content is accurate and helpful

## Color Reference

Help system colors (for consistency):

```css
/* Button */
background: rgba(59, 130, 246, 0.2)  /* blue-500/20 */
hover-background: rgba(59, 130, 246, 0.3)  /* blue-500/30 */
text: rgb(96, 165, 250)  /* blue-400 */
border: rgba(59, 130, 246, 0.3)  /* blue-500/30 */

/* Popup */
background: rgb(30, 41, 59)  /* slate-800 */
border: rgba(59, 130, 246, 0.5)  /* blue-500/50 */
title: rgb(147, 197, 253)  /* blue-300 */
text: rgb(209, 213, 219)  /* gray-300 */
```

## Aviation Terminology

Terms used in help content:

- **ETA**: Estimated Time of Arrival
- **PIREP**: Pilot Report
- **METAR**: Aviation weather observation
- **TAF**: Terminal Area Forecast
- **VFR**: Visual Flight Rules
- **MVFR**: Marginal VFR
- **IFR**: Instrument Flight Rules
- **LIFR**: Low IFR
- **NAS**: National Airspace System
- **NOTAM**: Notice to Airmen
- **TFR**: Temporary Flight Restriction
- **DME**: Distance Measuring Equipment
- **50nm**: 50 nautical miles

---

*This help system is designed to make the pilot app more accessible and user-friendly while maintaining the professional aviation context.*

