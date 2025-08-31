// Demo Data for Denver International Airport (KDEN)
// ===============================================
// This file contains mock data to simulate a storm situation for demonstration purposes

import { SituationSummary, AirportOverview, PiRep, GroundTrack } from '@/types';

// Mock METAR for storm conditions
export const DENVER_STORM_METAR = {
    metar: "KDEN 151753Z 28025G40KT 2SM R35L/2000FT +TSRA BR BKN008 OVC015CB 12/10 A2992 RMK AO2 PK WND 28045/1745 WSHFT 1740 FZRANO",
    metarFriendly: "Heavy thunderstorms with rain, 2 mile visibility, wind 280° at 25 knots gusting to 40 knots, broken clouds at 800ft, overcast at 1500ft with cumulonimbus",
    conditions: "Heavy thunderstorms with reduced visibility",
    temperature: "12°C",
    wind: {
        direction: 280,
        speed: 25,
        gust: 40
    },
    visibility: "2 miles",
    timestamp: new Date().toISOString()
};

// Mock ground tracks for storm conditions
export const DENVER_STORM_TRACKS: GroundTrack[] = [
    {
        id: "track-001",
        callsign: "UAL1234",
        aircraft: "B737",
        coordinates: [
            // { lat: 39.95, lon: -104.75, altitude: 3000, timestamp: new Date(Date.now() - 8 * 60 * 1000).toISOString() },
            // { lat: 39.92, lon: -104.72, altitude: 2500, timestamp: new Date(Date.now() - 7 * 60 * 1000).toISOString() },
            // { lat: 39.89, lon: -104.70, altitude: 2000, timestamp: new Date(Date.now() - 6 * 60 * 1000).toISOString() },
            // { lat: 39.86, lon: -104.69, altitude: 1500, timestamp: new Date(Date.now() - 5 * 60 * 1000).toISOString() },
            // { lat: 39.83, lon: -104.68, altitude: 1000, timestamp: new Date(Date.now() - 4 * 60 * 1000).toISOString() },
            // { lat: 39.80, lon: -104.67, altitude: 500, timestamp: new Date(Date.now() - 3 * 60 * 1000).toISOString() },
            // { lat: 39.828257, lon: -104.660560, altitude: 0, timestamp: new Date(Date.now() - 2 * 60 * 1000).toISOString() }
        ],
        runway: "35L",
        status: "ACTIVE",
        startTime: new Date(Date.now() - 8 * 60 * 1000).toISOString(),
        endTime: undefined
    },
    {
        id: "track-002",
        callsign: "SWA5678",
        aircraft: "B737",
        coordinates: [
            // { lat: 39.94, lon: -104.76, altitude: 3000, timestamp: new Date(Date.now() - 7 * 60 * 1000).toISOString() },
            // { lat: 39.91, lon: -104.73, altitude: 2500, timestamp: new Date(Date.now() - 6 * 60 * 1000).toISOString() },
            // { lat: 39.88, lon: -104.71, altitude: 2000, timestamp: new Date(Date.now() - 5 * 60 * 1000).toISOString() },
            // { lat: 39.85, lon: -104.70, altitude: 1500, timestamp: new Date(Date.now() - 4 * 60 * 1000).toISOString() },
            // { lat: 39.82, lon: -104.69, altitude: 1000, timestamp: new Date(Date.now() - 3 * 60 * 1000).toISOString() },
            // { lat: 39.79, lon: -104.68, altitude: 500, timestamp: new Date(Date.now() - 2 * 60 * 1000).toISOString() },
            // { lat: 39.828257, lon: -104.660560, altitude: 0, timestamp: new Date(Date.now() - 1 * 60 * 1000).toISOString() }
        ],
        runway: "35L",
        status: "ACTIVE",
        startTime: new Date(Date.now() - 7 * 60 * 1000).toISOString(),
        endTime: undefined
    }
];

// Mock situation summary for storm conditions
export const DENVER_STORM_SUMMARY: SituationSummary = {
    situation_overview: "Denver International: Active storm system with heavy thunderstorms, reduced visibility, and windshear reports. Runway 35L remains operational with 5 recent landings.",
    conditions: {
        weather: {
            description: "Heavy thunderstorms with 2 mile visibility, wind 280° at 25kt gusting 40kt",
            short_summary: "Heavy storms, 2mi vis",
            long_summary: "Active thunderstorm system with heavy rain, 2 mile visibility, wind 280° at 25 knots gusting to 40 knots. Ceiling 800ft with cumulonimbus clouds. Conditions deteriorating with embedded thunderstorms.",
            status: "warning"
        },
        traffic: {
            description: "Moderate traffic with 5 aircraft landed in last 20 minutes despite storm conditions",
            short_summary: "Moderate traffic, 5 landings",
            long_summary: "Traffic continues despite storm conditions. 5 aircraft successfully landed on runway 35L in the last 20 minutes. Pilots reporting challenging conditions but operations continuing.",
            status: "caution"
        },
        approach: {
            description: "Multiple windshear reports on approach, runway visibility acceptable at 2000ft",
            short_summary: "Windshear reports, 5 aircraft in queue",
            long_summary: "Pilots reporting moderate to severe windshear on final approach. Runway 35L visibility reduced to 2000ft but remains above minimums. 5 aircraft in queue for approach. Approach operations continuing with increased pilot awareness.",
            status: "warning"
        },
        runway: {
            description: "Runway 35L active with 5 recent landings, operations continuing despite storm",
            short_summary: "35L active, 5 landings",
            long_summary: "Runway 35L remains operational with 5 successful landings in the last 20 minutes. Runway visibility at 2000ft, above minimums. Operations continuing. Braking reported good.",
            status: "caution"
        },
        ground: {
            description: "Ground operations normal, no significant delays reported",
            short_summary: "Ground ops normal",
            long_summary: "Ground operations proceeding normally despite storm conditions. No significant taxi delays reported. Aircraft positioning and ground movement continuing as scheduled.",
            status: "normal"
        },
        special: {
            description: "Windshear alerts active, thunderstorm warnings in effect",
            short_summary: "Windshear alerts active",
            long_summary: "Multiple windshear reports from pilots on approach. Thunderstorm warnings in effect for Denver area. Pilots advised to exercise extreme caution and report any windshear encounters.",
            status: "warning"
        }
    }
};

// Mock PIREPs for storm conditions
export const DENVER_STORM_PIREPS: PiRep[] = [
    {
        id: "pirep-001",
        aircraft: "UAL1234",
        message: "Moderate windshear encountered at 1500ft on final approach to runway 35L. Sudden 15kt airspeed loss, recovered with power application.",
        location: {
            lat: 39.85,
            lon: -104.69
        },
        altitude: 1500,
        timestamp: new Date(Date.now() - 5 * 60 * 1000).toISOString(), // 5 minutes ago
        ageMinutes: 5,
        priority: "high",
        conditions: [
            {
                type: "WINDSHEAR",
                severity: "MODERATE",
                description: "15kt airspeed loss on final approach"
            }
        ],
        remarks: "Pilot reported windshear at 1500ft, runway 35L approach"
    },
    {
        id: "pirep-002",
        aircraft: "SWA5678",
        message: "Light to moderate turbulence below 3000ft in approach area. Intermittent moderate turbulence in cloud layers.",
        location: {
            lat: 39.87,
            lon: -104.68
        },
        altitude: 3000,
        timestamp: new Date(Date.now() - 8 * 60 * 1000).toISOString(), // 8 minutes ago
        ageMinutes: 8,
        priority: "normal",
        conditions: [
            {
                type: "TURBULENCE",
                severity: "MODERATE",
                description: "Below 3000ft in approach area"
            }
        ],
        remarks: "Turbulence reported in approach area"
    },
    {
        id: "pirep-003",
        aircraft: "AAL9012",
        message: "Heavy rain and reduced visibility on final approach. Runway lights visible at 2000ft, approach lighting system functioning normally.",
        location: {
            lat: 39.84,
            lon: -104.70
        },
        altitude: 2000,
        timestamp: new Date(Date.now() - 12 * 60 * 1000).toISOString(), // 12 minutes ago
        ageMinutes: 12,
        priority: "normal",
        conditions: [
            {
                type: "HEAVY_RAIN",
                severity: "MODERATE",
                description: "Heavy rain reducing visibility"
            }
        ],
        remarks: "Heavy rain affecting visibility on approach"
    }
];

// Mock airport overview for storm conditions
export const DENVER_STORM_OVERVIEW: AirportOverview = {
    airport: {
        id: "KDEN",
        name: "Denver International Airport",
        code: "KDEN",
        position: {
            lat: 39.861667,
            lon: -104.673056
        },
        active: true,
        lastUpdate: new Date().toISOString()
    },
    weather: DENVER_STORM_METAR,
    runways: [
        {
            name: "35L",
            heading: 181,
            oppositeHeading: 1,
            length: 12000,
            threshold: {
                lat: 39.828257,
                lon: -104.660560
            },
            oppositeEnd: {
                name: "17R",
                lat: 39.861245,
                lon: -104.660154
            },
            rightHandPattern: false,
            approaches: []
        }
    ],
    operational: {
        active: true,
        lastUpdate: new Date().toISOString()
    },
    timestamp: new Date().toISOString(),
    cacheMaxAge: 30000
};

// Demo data configuration
export const DENVER_DEMO_CONFIG = {
    airportCode: "KDEN",
    isDemo: true,
    demoName: "Storm Demo",
    refreshInterval: 30000, // 30 seconds
    autoRotatePireps: true,
    simulateRealTimeUpdates: true
};
