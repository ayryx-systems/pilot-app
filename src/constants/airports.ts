// Airport Data for Pilot App
// =========================
// Simplified airport data focusing on essential pilot information
// Auto-synced from main dashboard - DO NOT EDIT MANUALLY
// Run 'npm run sync-airports' to update

/**
 * AIRPORT DATA SYNCHRONIZATION
 * ===========================
 * 
 * This file is the MAIN SOURCE for all airport data across the Ayryx project.
 * 
 * SYNC TARGETS:
 * - Backend Server: atc-backend/src/config/airportData.js (run: cd atc-backend && npm run sync-airports)
 * - Pilot App: pilot-app/src/constants/airports.ts (run: cd pilot-app && npm run sync-airports)
 * 
 * IMPORTANT: Never edit the synced files directly - they will be overwritten!
 * Always make changes here and then run both sync commands.
 * 
 * COORDINATE SOURCES:
 * When fixing runway overlay misalignments, always use official FAA coordinates from:
 * 1. FAA ADIP (Airport Data and Information Portal) - https://adip.faa.gov/agis/public/#/airportData/
 * 2. Download the HTML file for the specific airport (e.g., "KLGA - Airport Data and Information Portal.html")
 * 3. Search for "runway" and "latitude"/"longitude" to find official surveyed coordinates
 * 4. Convert DMS (degrees, minutes, seconds) to decimal degrees for the code
 * 5. NEVER calculate coordinates from headings/lengths - use actual surveyed data
 * 6. Example: 40° 46' 8.9853" N = 40.769162, 73° 53' 2.8285" W = -73.884119
 * 
 * RECENT CHANGES:
 * - Updated approach waypoints to use official FAA coordinates instead of distances from threshold
 * - All waypoints now have explicit position: [lat, lon] instead of distanceFromThreshold: number
 * - This eliminates the need for complex distance/bearing calculations and improves accuracy
 */

/**
 * Convert FAA DMS coordinate format to decimal degrees
 * Format: N33542830W118292809 (N33°54'28.30"W118°29'28.09")
 * @param coordString - FAA coordinate string
 * @returns [lat, lon] in decimal degrees
 */
function parseFAACoordinate(coordString: string): [number, number] {
  // Example: N33542830W118292809
  // N33°54'28.30"W118°29'28.09"

  const latMatch = coordString.match(/N(\d{2})(\d{2})(\d{2})(\d{2})/);
  const lonMatch = coordString.match(/W(\d{3})(\d{2})(\d{2})(\d{2})/);

  if (!latMatch || !lonMatch) {
    throw new Error(`Invalid FAA coordinate format: ${coordString}`);
  }

  const latDegrees = parseInt(latMatch[1]);
  const latMinutes = parseInt(latMatch[2]);
  const latSeconds = parseInt(latMatch[3]) + parseInt(latMatch[4]) / 100; // Combine seconds and hundredths

  const lonDegrees = parseInt(lonMatch[1]);
  const lonMinutes = parseInt(lonMatch[2]);
  const lonSeconds = parseInt(lonMatch[3]) + parseInt(lonMatch[4]) / 100; // Combine seconds and hundredths

  const lat = latDegrees + (latMinutes / 60) + (latSeconds / 3600);
  const lon = -(lonDegrees + (lonMinutes / 60) + (lonSeconds / 3600)); // Negative for West

  return [lat, lon];
}

/**
 * Airport Data Interface
 * =====================
 * 
 * This interface defines the structure for all airport data across the project.
 * 
 * SYNC NOTE: This interface is used by both the backend (converted to JS) and pilot app.
 * Any changes here will affect all synced applications.
 */

export const AIRPORTS: Record<string, AirportData> = {
  KLAX: {
    name: "Los Angeles International Airport",
    code: "KLAX",
    position: [33.9425, -118.4081], // Airport reference point
    runways: [
      {
        name: "24R",
        heading: 263,
        oppositeHeading: 83,
        length: 10285, // Length in feet
        threshold: {
          lat: 33.95210, // 33° 57' 7.5741" N
          lon: -118.40195 // 118° 24' 7.0161" W
        },
        oppositeEnd: {
          name: "06L",
          lat: 33.94911, // 33° 56' 56.8049" N
          lon: -118.43116 // 118° 25' 52.1755" W
        },
        rightHandPattern: true,
        approaches: [
          {
            name: "ILS",
            waypoints: [
              { name: "ARBIE", position: parseFAACoordinate("N33572016W118220388") },
              { name: "KOBEE", position: parseFAACoordinate("N33575394W118163154") },
              { name: "MERCE", position: parseFAACoordinate("N33585084W118070576") },
              { name: "BROUK", position: parseFAACoordinate("N33591369W118031650") },
              { name: "LIVVN", position: parseFAACoordinate("N33593655W117592723") },
              { name: "PALAC", position: parseFAACoordinate("N34000383W117544920") }
            ]
          }
        ]
      },
      {
        name: "24L",
        heading: 263,
        oppositeHeading: 83,
        length: 10885, // Length in feet
        threshold: {
          lat: 33.95046, // 33° 57' 1.6678" N
          lon: -118.39905 // 118° 23' 56.5656" W
        },
        oppositeEnd: {
          name: "06R",
          lat: 33.94681, // 33° 56' 48.5368" N
          lon: -118.43467 // 118° 26' 4.8042" W
        },
        rightHandPattern: true,
        approaches: [
          {
            name: "ILS",
            waypoints: [
              { name: "CORTY", position: parseFAACoordinate("N33571385W118215713") },
              { name: "SUTIE", position: parseFAACoordinate("N33574709W118163003") },
              { name: "BOUBY", position: parseFAACoordinate("N33582803W118094407") },
              { name: "JULLI", position: parseFAACoordinate("N33584408W118070359") },
              { name: "FAYZE", position: parseFAACoordinate("N33590693W118031434") }
            ]
          }
        ]
      },
      {
        name: "25R",
        heading: 263,
        oppositeHeading: 83,
        length: 12091, // Length in feet
        threshold: {
          lat: 33.93988, // 33° 56' 23.5604" N
          lon: -118.37978 // 118° 22' 47.2005" W
        },
        oppositeEnd: {
          name: "07L",
          lat: 33.93555, // 33° 56' 7.9864" N
          lon: -118.42207 // 118° 25' 19.4335" W
        },
        rightHandPattern: false,
        approaches: [
          {
            name: "ILS",
            waypoints: [
              { name: "GRIMY", position: parseFAACoordinate("N33563593W118204604") },
              { name: "FOGLA", position: parseFAACoordinate("N33570239W118162529") },
              { name: "SHELL", position: parseFAACoordinate("N33574567W118091577") },
              { name: "FALLT", position: parseFAACoordinate("N33581645W118040778") },
              { name: "MUSUK", position: parseFAACoordinate("N33591743W117535089") }
            ]
          }
        ]
      },
      {
        name: "25L",
        heading: 263,
        oppositeHeading: 83,
        length: 11095, // Length in feet
        threshold: {
          lat: 33.93737, // 33° 56' 14.5069" N
          lon: -118.38271 // 118° 22' 57.7701" W
        },
        oppositeEnd: {
          name: "07R",
          lat: 33.93365, // 33° 56' 1.1378" N
          lon: -118.41902 // 118° 25' 8.466" W
        },
        rightHandPattern: false,
        approaches: [
          {
            name: "ILS",
            waypoints: [
              { name: "LADLE", position: parseFAACoordinate("N33562728W118205239") },
              { name: "GIGII", position: parseFAACoordinate("N33565446W118162484") },
              { name: "HUNDA", position: parseFAACoordinate("N33573499W118094364") },
              { name: "GAATE", position: parseFAACoordinate("N33580643W118042843") },
              { name: "FUELR", position: parseFAACoordinate("N33590967W117534879") }
            ]
          }
        ]
      }
    ],
    dmeRings: [5, 10, 15, 20, 30, 40],
    cardinalDirections: [
      { dir: "N", bearing: 0, distance: 0.4 },
      { dir: "NE", bearing: 45, distance: 0.28 },
      { dir: "E", bearing: 90, distance: 0.4 },
      { dir: "SE", bearing: 135, distance: 0.28 },
      { dir: "S", bearing: 180, distance: 0.4 },
      { dir: "SW", bearing: 225, distance: 0.28 },
      { dir: "W", bearing: 270, distance: 0.4 },
      { dir: "NW", bearing: 315, distance: 0.28 },
    ],
  },

  // Updated Santa Barbara Airport (KSBA) data based on FAA ADIP Report (Effective May 15, 2025)
  KSBA: {
    name: "Santa Barbara Municipal Airport",
    code: "KSBA",
    position: [34.4262, -119.8404], // Airport reference point
    runways: [
      {
        name: "07",
        heading: 89, // True heading from FAA data: 89°
        oppositeHeading: 269,
        length: 6052, // Length in feet: 6052 ft. x 150 ft.
        threshold: {
          lat: 34.427499, // 34° 25' 38.9964" N
          lon: -119.854642 // 119° 51' 16.7098" W
        },
        oppositeEnd: {
          name: "25",
          lat: 34.427918, // 34° 25' 40.5035" N  
          lon: -119.834579 // 119° 50' 4.4836" W
        },
        rightHandPattern: true, // From FAA data: "Right Hand Pattern: YES"
        approaches: [
          {
            name: "ILS",
            waypoints: [
              { name: "I-SBA", position: parseFAACoordinate("N34253899W119511670") } // ILS localizer frequency 110.30
            ]
          }
        ]
      },
      {
        name: "15L",
        heading: 166, // True heading from FAA data: 166°
        oppositeHeading: 346,
        length: 4180, // Length in feet: 4180 ft. x 75 ft.
        threshold: {
          lat: 34.430781, // 34° 25' 50.8102" N
          lon: -119.840369 // 119° 50' 25.3281" W
        },
        oppositeEnd: {
          name: "33R",
          lat: 34.419653, // 34° 25' 10.7491" N
          lon: -119.836939 // 119° 50' 12.9814" W
        },
        rightHandPattern: false, // From FAA data: "Right Hand Pattern: NO"
        approaches: []
      },
      {
        name: "15R",
        heading: 166, // True heading from FAA data: 166°
        oppositeHeading: 346,
        length: 4184, // Length in feet: 4184 ft. x 100 ft.
        threshold: {
          lat: 34.430540, // 34° 25' 49.9454" N
          lon: -119.841537 // 119° 50' 29.533" W
        },
        oppositeEnd: {
          name: "33L",
          lat: 34.419402, // 34° 25' 9.846" N
          lon: -119.838101 // 119° 50' 17.1654" W
        },
        rightHandPattern: false, // From FAA data: "Right Hand Pattern: NO"
        approaches: []
      }
    ],
    dmeRings: [3, 5, 10, 15, 20, 25],
    cardinalDirections: [
      { dir: "N", bearing: 0, distance: 0.3 },
      { dir: "NE", bearing: 45, distance: 0.2 },
      { dir: "E", bearing: 90, distance: 0.3 },
      { dir: "SE", bearing: 135, distance: 0.2 },
      { dir: "S", bearing: 180, distance: 0.3 },
      { dir: "SW", bearing: 225, distance: 0.2 },
      { dir: "W", bearing: 270, distance: 0.3 },
      { dir: "NW", bearing: 315, distance: 0.2 },
    ]
  },

  // Santa Monica Airport (KSMO) data based on FAA ADIP Report
  KSMO: {
    name: "Santa Monica Municipal Airport",
    code: "KSMO",
    position: [34.0158, -118.4513], // Airport reference point
    runways: [
      {
        name: "03",
        heading: 44, // True heading from FAA data: 44°
        oppositeHeading: 224,
        length: 3500, // Length in feet: 3500 ft. x 150 ft.
        threshold: {
          lat: 34.012396, // 34° 0' 44.6269" N
          lon: -118.455358 // 118° 27' 19.291" W
        },
        oppositeEnd: {
          name: "21",
          lat: 34.019247, // 34° 1' 9.2906" N
          lon: -118.447253 // 118° 26' 50.1122" W
        },
        rightHandPattern: true, // Right traffic pattern for runway 03
        approaches: [
          {
            name: "Visual",
            waypoints: [
              { name: "SMO", position: parseFAACoordinate("N34012396W118455358") } // Santa Monica VOR
            ]
          }
        ]
      }
    ],
    dmeRings: [3, 5, 10, 15, 20],
    cardinalDirections: [
      { dir: "N", bearing: 0, distance: 0.2 },
      { dir: "NE", bearing: 45, distance: 0.15 },
      { dir: "E", bearing: 90, distance: 0.2 },
      { dir: "SE", bearing: 135, distance: 0.15 },
      { dir: "S", bearing: 180, distance: 0.2 },
      { dir: "SW", bearing: 225, distance: 0.15 },
      { dir: "W", bearing: 270, distance: 0.2 },
      { dir: "NW", bearing: 315, distance: 0.15 },
    ]
  },
  // Denver International Airport (KDEN) data based on FAA ADIP Report
  KDEN: {
    name: "Denver International Airport",
    code: "KDEN",
    position: [39.861667, -104.673056], // Airport reference point (39° 51' 42" N, 104° 40' 23.4" W)
    runways: [
      {
        name: "07",
        heading: 91, // True heading from FAA data: 91°
        oppositeHeading: 271,
        length: 12000, // Length in feet: 12000 ft. x 150 ft.
        threshold: {
          lat: 39.840945, // 39° 50' 27.4022" N
          lon: -104.726656 // 104° 43' 35.963" W
        },
        oppositeEnd: {
          name: "25",
          lat: 39.840657, // 39° 50' 26.3667" N
          lon: -104.683936 // 104° 41' 2.1712" W
        },
        rightHandPattern: false, // Standard traffic pattern
        approaches: []
      },
      {
        name: "08",
        heading: 91, // True heading from FAA data: 91°
        oppositeHeading: 271,
        length: 12000, // Length in feet: 12000 ft. x 150 ft.
        threshold: {
          lat: 39.877556, // 39° 52' 39.2009" N
          lon: -104.662229 // 104° 39' 44.0267" W
        },
        oppositeEnd: {
          name: "26",
          lat: 39.877244, // 39° 52' 38.0769" N
          lon: -104.619486 // 104° 37' 10.1479" W
        },
        rightHandPattern: false, // Standard traffic pattern
        approaches: []
      },
      {
        name: "16L",
        heading: 181, // True heading from FAA data: 181°
        oppositeHeading: 1,
        length: 12000, // Length in feet: 12000 ft. x 150 ft.
        threshold: {
          lat: 39.896481, // 39° 53' 49.3301" N
          lon: -104.686944 // 104° 41' 12.4998" W
        },
        oppositeEnd: {
          name: "34R",
          lat: 39.864372, // 39° 51' 50.7743" N
          lon: -104.687161 // 104° 41' 13.8782" W
        },
        rightHandPattern: false, // Standard traffic pattern
        approaches: []
      },
      {
        name: "16R",
        heading: 181, // True heading from FAA data: 181°
        oppositeHeading: 1,
        length: 16000, // Length in feet: 16000 ft. x 200 ft.
        threshold: {
          lat: 39.895802, // 39° 53' 44.869" N
          lon: -104.696389 // 104° 41' 45.9006" W
        },
        oppositeEnd: {
          name: "34L",
          lat: 39.851889, // 39° 51' 6.7926" N
          lon: -104.696588 // 104° 41' 47.7166" W
        },
        rightHandPattern: false, // Standard traffic pattern
        approaches: []
      },
      {
        name: "17L",
        heading: 181, // True heading from FAA data: 181°
        oppositeHeading: 1,
        length: 12000, // Length in feet: 12000 ft. x 150 ft.
        threshold: {
          lat: 39.864952, // 39° 51' 53.8287" N
          lon: -104.641304 // 104° 38' 28.6959" W
        },
        oppositeEnd: {
          name: "35R",
          lat: 39.831964, // 39° 49' 55.2707" N
          lon: -104.641710 // 104° 38' 30.1554" W
        },
        rightHandPattern: false, // Standard traffic pattern
        approaches: []
      },
      {
        name: "17R",
        heading: 181, // True heading from FAA data: 181°
        oppositeHeading: 1,
        length: 12000, // Length in feet: 12000 ft. x 150 ft.
        threshold: {
          lat: 39.861245, // 39° 51' 40.4821" N
          lon: -104.660154 // 104° 39' 36.5561" W
        },
        oppositeEnd: {
          name: "35L",
          lat: 39.828257, // 39° 49' 41.9262" N
          lon: -104.660560 // 104° 39' 37.9841" W
        },
        rightHandPattern: false, // Standard traffic pattern
        approaches: []
      }
    ],
    dmeRings: [5, 10, 15, 20, 25, 30],
    cardinalDirections: [
      { dir: "N", bearing: 0, distance: 0.5 },
      { dir: "NE", bearing: 45, distance: 0.4 },
      { dir: "E", bearing: 90, distance: 0.5 },
      { dir: "SE", bearing: 135, distance: 0.4 },
      { dir: "S", bearing: 180, distance: 0.5 },
      { dir: "SW", bearing: 225, distance: 0.4 },
      { dir: "W", bearing: 270, distance: 0.5 },
      { dir: "NW", bearing: 315, distance: 0.4 },
    ]
  },
  // Newark Liberty International Airport (KEWR) data based on FAA ADIP Report
  KEWR: {
    name: "Newark Liberty International Airport",
    code: "KEWR",
    position: [40.6895, -74.1745], // Airport reference point (40° 41' 22.2" N, 74° 10' 28.2" W)
    runways: [
      {
        name: "04L",
        heading: 26, // True heading from FAA data: 26°
        oppositeHeading: 206,
        length: 11000, // Length in feet: 11000 ft. x 150 ft.
        threshold: {
          lat: 40.675381, // 40° 40' 31.3731" N
          lon: -74.179449 // 74° 10' 46.0156" W
        },
        oppositeEnd: {
          name: "22R",
          lat: 40.702560, // 40° 42' 9.2158" N
          lon: -74.162172 // 74° 9' 43.8183" W
        },
        rightHandPattern: false, // Standard traffic pattern
        approaches: []
      },
      {
        name: "04R",
        heading: 26, // True heading from FAA data: 26°
        oppositeHeading: 206,
        length: 9999, // Length in feet: 9999 ft. x 150 ft.
        threshold: {
          lat: 40.677583, // 40° 40' 39.3027" N
          lon: -74.174245 // 74° 10' 27.2825" W
        },
        oppositeEnd: {
          name: "22L",
          lat: 40.702289, // 40° 42' 8.2401" N
          lon: -74.158538 // 74° 9' 30.7356" W
        },
        rightHandPattern: false, // Standard traffic pattern
        approaches: []
      },
      {
        name: "11",
        heading: 95, // True heading from FAA data: 95°
        oppositeHeading: 275,
        length: 6725, // Length in feet: 6725 ft. x 150 ft.
        threshold: {
          lat: 40.702804, // 40° 42' 10.0957" N
          lon: -74.180707 // 74° 10' 50.5467" W
        },
        oppositeEnd: {
          name: "29",
          lat: 40.701199, // 40° 42' 4.3179" N
          lon: -74.156543 // 74° 9' 23.5566" W
        },
        rightHandPattern: false, // Standard traffic pattern
        approaches: []
      }
    ],
    dmeRings: [5, 10, 15, 20, 25],
    cardinalDirections: [
      { dir: "N", bearing: 0, distance: 0.3 },
      { dir: "NE", bearing: 45, distance: 0.25 },
      { dir: "E", bearing: 90, distance: 0.3 },
      { dir: "SE", bearing: 135, distance: 0.25 },
      { dir: "S", bearing: 180, distance: 0.3 },
      { dir: "SW", bearing: 225, distance: 0.25 },
      { dir: "W", bearing: 270, distance: 0.3 },
      { dir: "NW", bearing: 315, distance: 0.25 },
    ]
  },
  // John F. Kennedy International Airport (KJFK) data based on FAA ADIP Report
  KJFK: {
    name: "John F. Kennedy International Airport",
    code: "KJFK",
    position: [40.639872, -73.778692], // Airport reference point (40° 38' 23.741" N, 73° 46' 43.292" W)
    runways: [
      {
        name: "04L",
        heading: 31, // True heading from FAA data: 31°
        oppositeHeading: 211,
        length: 12079, // Length in feet: 12079 ft. x 200 ft.
        threshold: {
          lat: 40.622021, // 40° 37' 19.2754" N
          lon: -73.785584 // 73° 47' 8.1029" W
        },
        oppositeEnd: {
          name: "22",
          lat: 40.7835, // Corrected to align with actual runway position
          lon: -73.8750, // Corrected to align with actual runway position
        },
        rightHandPattern: false, // Standard traffic pattern
        approaches: []
      },
      {
        name: "04R",
        heading: 31, // True heading from FAA data: 31°
        oppositeHeading: 211,
        length: 8400, // Length in feet: 8400 ft. x 200 ft.
        threshold: {
          lat: 40.625428, // 40° 37' 31.5418" N
          lon: -73.770345 // 73° 46' 13.2441" W
        },
        oppositeEnd: {
          name: "22L",
          lat: 40.645237, // 40° 38' 42.8531" N
          lon: -73.754861 // 73° 45' 17.5027" W
        },
        rightHandPattern: false, // Standard traffic pattern
        approaches: []
      },
      {
        name: "13L",
        heading: 121, // True heading from FAA data: 121°
        oppositeHeading: 301,
        length: 10000, // Length in feet: 10000 ft. x 200 ft.
        threshold: {
          lat: 40.657764, // 40° 39' 27.952" N
          lon: -73.790239 // 73° 47' 24.8606" W
        },
        oppositeEnd: {
          name: "31R",
          lat: 40.643724, // 40° 38' 37.4085" N
          lon: -73.759272 // 73° 45' 33.3818" W
        },
        rightHandPattern: true, // Right hand pattern from FAA data
        approaches: []
      },
      {
        name: "13R",
        heading: 121, // True heading from FAA data: 121°
        oppositeHeading: 301,
        length: 14511, // Length in feet: 14511 ft. x 200 ft.
        threshold: {
          lat: 40.648361, // 40° 38' 54.1008" N
          lon: -73.816715 // 73° 49' 0.173" W
        },
        oppositeEnd: {
          name: "31L",
          lat: 40.628005, // 40° 37' 40.7799" N
          lon: -73.771781 // 73° 46' 18.4107" W
        },
        rightHandPattern: true, // Right hand pattern from FAA data
        approaches: []
      }
    ],
    dmeRings: [5, 10, 15, 20, 25],
    cardinalDirections: [
      { dir: "N", bearing: 0, distance: 0.3 },
      { dir: "NE", bearing: 45, distance: 0.25 },
      { dir: "E", bearing: 90, distance: 0.3 },
      { dir: "SE", bearing: 135, distance: 0.25 },
      { dir: "S", bearing: 180, distance: 0.3 },
      { dir: "SW", bearing: 225, distance: 0.25 },
      { dir: "W", bearing: 270, distance: 0.3 },
      { dir: "NW", bearing: 315, distance: 0.25 },
    ]
  },
  // LaGuardia Airport (KLGA) data based on FAA ADIP Report
  KLGA: {
    name: "LaGuardia Airport",
    code: "KLGA",
    position: [40.777242, -73.872606], // Airport reference point (40° 46' 38.072" N, 73° 52' 21.38" W)
    runways: [
      {
        name: "04",
        heading: 32, // True heading from FAA data: 32°
        oppositeHeading: 212,
        length: 7002, // Length in feet: 7002 ft. x 150 ft.
        threshold: {
          lat: 40.769162, // 40° 46' 8.9853" N - Runway 04 threshold (FAA data)
          lon: -73.884119 // 73° 53' 2.8285" W - Runway 04 threshold (FAA data)
        },
        oppositeEnd: {
          name: "22",
          lat: 40.785436, // 40° 47' 7.572" N - Runway 22 threshold (FAA data)
          lon: -73.870673, // 73° 52' 14.4241" W - Runway 22 threshold (FAA data)
        },
        rightHandPattern: false, // Standard traffic pattern
        approaches: []
      },
      {
        name: "13",
        heading: 122, // True heading from FAA data: 122°
        oppositeHeading: 302,
        length: 7002, // Length in feet: 7002 ft. x 150 ft.
        threshold: {
          lat: 40.782296, // 40° 46' 56.2651" N - Runway 13 threshold
          lon: -73.878519 // 73° 52' 42.669" W - Runway 13 threshold
        },
        oppositeEnd: {
          name: "31",
          lat: 40.771493, // 40° 46' 19.4572" N - Runway 31 threshold
          lon: -73.856889 // 73° 51' 25.6017" W - Runway 31 threshold
        },
        rightHandPattern: false, // Standard traffic pattern
        approaches: []
      }
    ],
    dmeRings: [3, 5, 10, 15, 20],
    cardinalDirections: [
      { dir: "N", bearing: 0, distance: 0.2 },
      { dir: "NE", bearing: 45, distance: 0.15 },
      { dir: "E", bearing: 90, distance: 0.2 },
      { dir: "SE", bearing: 135, distance: 0.15 },
      { dir: "S", bearing: 180, distance: 0.2 },
      { dir: "SW", bearing: 225, distance: 0.15 },
      { dir: "W", bearing: 270, distance: 0.2 },
      { dir: "NW", bearing: 315, distance: 0.15 },
    ]
  },
};

