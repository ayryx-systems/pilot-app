// Airport Data for Pilot App
// =========================
// Simplified airport data focusing on essential pilot information

export interface AirportData {
  name: string;
  code: string;
  position: [number, number];
  runways: Array<{
    name: string;
    heading: number;
    oppositeHeading: number;
    length: number;
    threshold: {
      lat: number;
      lon: number;
    };
    oppositeEnd: {
      name: string;
      lat: number;
      lon: number;
    };
    rightHandPattern: boolean;
    approaches?: Array<{
      name: string;
      waypoints: Array<{
        name: string;
        distanceFromThreshold: number;
        position?: [number, number];
      }>;
    }>;
  }>;
  dmeRings: number[];
  cardinalDirections: Array<{
    dir: string;
    bearing: number;
    distance: number;
  }>;
  waypoints?: Array<{
    name: string;
    lat: number;
    lon: number;
    description?: string;
  }>;
}

export const AIRPORTS: Record<string, AirportData> = {
  KLAX: {
    name: "Los Angeles International Airport",
    code: "KLAX",
    position: [33.9425, -118.4081],
    runways: [
      { 
        name: "24R",
        heading: 263,
        oppositeHeading: 83,
        length: 10285,
        threshold: {
          lat: 33.95210,
          lon: -118.40195
        },
        oppositeEnd: {
          name: "06L",
          lat: 33.94911,
          lon: -118.43116
        },
        rightHandPattern: true,
        approaches: [
          {
            name: "ILS",
            waypoints: [
              { name: "ARBIE", distanceFromThreshold: 3.7 },  
              { name: "KOBEE", distanceFromThreshold: 8.3 },
              { name: "MERCE", distanceFromThreshold: 16.2 },
              { name: "BROUK", distanceFromThreshold: 19.4 },
              { name: "LIVVN", distanceFromThreshold: 22.6 },
              { name: "PALAC", distanceFromThreshold: 26.5 }
            ]
          }
        ]
      },
      { 
        name: "24L", 
        heading: 263,
        oppositeHeading: 83,
        length: 10885,
        threshold: {
          lat: 33.95046,
          lon: -118.39905
        },
        oppositeEnd: {
          name: "06R",
          lat: 33.94681,
          lon: -118.43467
        },
        rightHandPattern: true,
        approaches: [
          {
            name: "ILS",
            waypoints: [
              { name: "CORTY", distanceFromThreshold: 3.7 },
              { name: "SUTIE", distanceFromThreshold: 8.3 },
              { name: "BOUBY", distanceFromThreshold: 13.9 },
              { name: "JULLI", distanceFromThreshold: 16.2 },
              { name: "FAYZE", distanceFromThreshold: 19.4 }
            ]
          }
        ]
      },
      { 
        name: "25R", 
        heading: 263,
        oppositeHeading: 83,
        length: 12091,
        threshold: {
          lat: 33.93988,
          lon: -118.37978
        },
        oppositeEnd: {
          name: "07L",
          lat: 33.93555,
          lon: -118.42207
        },
        rightHandPattern: false,
        approaches: [
          {
            name: "ILS",
            waypoints: [
              { name: "GRIMY", distanceFromThreshold: 3.9 },
              { name: "FOGLA", distanceFromThreshold: 7.5 },
              { name: "SHELL", distanceFromThreshold: 13.5 },
              { name: "FALLT", distanceFromThreshold: 17.8 },
              { name: "MUSUK", distanceFromThreshold: 26.5 }
            ]
          }
        ]
      },
      { 
        name: "25L", 
        heading: 263,
        oppositeHeading: 83,
        length: 11095,
        threshold: {
          lat: 33.93737,
          lon: -118.38271
        },
        oppositeEnd: {
          name: "07R",
          lat: 33.93365,
          lon: -118.41902
        },
        rightHandPattern: false,
        approaches: [
          {
            name: "ILS",
            waypoints: [
              { name: "LADLE", distanceFromThreshold: 3.7 },
              { name: "GIGII", distanceFromThreshold: 7.5 },
              { name: "HUNDA", distanceFromThreshold: 13.1 },
              { name: "GAATE", distanceFromThreshold: 17.5 },
              { name: "FUELR", distanceFromThreshold: 26.4 }
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

  KSBA: {
    name: "Santa Barbara Municipal Airport",
    code: "KSBA",
    position: [34.4262, -119.8404],
    runways: [
      { 
        name: "07",
        heading: 89,
        oppositeHeading: 269,
        length: 6052,
        threshold: {
          lat: 34.427499,
          lon: -119.854642
        },
        oppositeEnd: {
          name: "25",
          lat: 34.427918,
          lon: -119.834579
        },
        rightHandPattern: true,
        approaches: [
          {
            name: "ILS",
            waypoints: [
              { name: "I-SBA", distanceFromThreshold: 0 }
            ]
          }
        ]
      },
      { 
        name: "15L",
        heading: 166,
        oppositeHeading: 346,
        length: 4180,
        threshold: {
          lat: 34.430781,
          lon: -119.840369
        },
        oppositeEnd: {
          name: "33R",
          lat: 34.419653,
          lon: -119.836939
        },
        rightHandPattern: false,
        approaches: []
      },
      { 
        name: "15R",
        heading: 166,
        oppositeHeading: 346,
        length: 4184,
        threshold: {
          lat: 34.430540,
          lon: -119.841537
        },
        oppositeEnd: {
          name: "33L",
          lat: 34.419402,
          lon: -119.838101
        },
        rightHandPattern: false,
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

  KSMO: {
    name: "Santa Monica Municipal Airport",
    code: "KSMO",
    position: [34.0158, -118.4513],
    runways: [
      { 
        name: "03",
        heading: 44,
        oppositeHeading: 224,
        length: 3500,
        threshold: {
          lat: 34.012396,
          lon: -118.455358
        },
        oppositeEnd: {
          name: "21",
          lat: 34.019247,
          lon: -118.447253
        },
        rightHandPattern: true,
        approaches: [
          {
            name: "Visual",
            waypoints: [
              { name: "SMO", distanceFromThreshold: 0 }
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

  KDEN: {
    name: "Denver International Airport",
    code: "KDEN",
    position: [39.861667, -104.673056],
    runways: [
      {
        name: "07",
        heading: 91,
        oppositeHeading: 271,
        length: 12000,
        threshold: {
          lat: 39.840945,
          lon: -104.726656
        },
        oppositeEnd: {
          name: "25",
          lat: 39.840657,
          lon: -104.683936
        },
        rightHandPattern: false,
        approaches: []
      },
      {
        name: "08",
        heading: 91,
        oppositeHeading: 271,
        length: 12000,
        threshold: {
          lat: 39.877556,
          lon: -104.662229
        },
        oppositeEnd: {
          name: "26",
          lat: 39.877244,
          lon: -104.619486
        },
        rightHandPattern: false,
        approaches: []
      },
      {
        name: "16L",
        heading: 181,
        oppositeHeading: 1,
        length: 12000,
        threshold: {
          lat: 39.896481,
          lon: -104.686944
        },
        oppositeEnd: {
          name: "34R",
          lat: 39.864372,
          lon: -104.687161
        },
        rightHandPattern: false,
        approaches: []
      },
      {
        name: "16R",
        heading: 181,
        oppositeHeading: 1,
        length: 16000,
        threshold: {
          lat: 39.895802,
          lon: -104.696389
        },
        oppositeEnd: {
          name: "34L",
          lat: 39.851889,
          lon: -104.696588
        },
        rightHandPattern: false,
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
  }
};

export const DEFAULT_AIRPORT = AIRPORTS.KLAX;
