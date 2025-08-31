// Demo Service for Pilot App
// =========================
// Provides mock data for demonstration purposes when Denver is selected

import {
    DENVER_STORM_SUMMARY,
    DENVER_STORM_OVERVIEW,
    DENVER_STORM_PIREPS,
    DENVER_STORM_TRACKS,
    DENVER_DEMO_CONFIG
} from '@/constants/demoData';
import {
    AirportOverview,
    PiRep,
    SituationSummary,
    SummaryResponse,
    PirepsResponse,
    GroundTrack,
    TracksResponse
} from '@/types';

class DemoService {
    private isDemoMode = false;
    private demoAirportCode = DENVER_DEMO_CONFIG.airportCode;
    private lastUpdateTime = Date.now();

    /**
     * Check if demo mode should be active for the given airport
     */
    shouldUseDemo(airportCode: string): boolean {
        return airportCode === this.demoAirportCode;
    }

    /**
     * Enable demo mode
     */
    enableDemo(): void {
        this.isDemoMode = true;
        this.lastUpdateTime = Date.now();
        console.log('[DemoService] Demo mode enabled for Denver storm simulation');
    }

    /**
     * Disable demo mode
     */
    disableDemo(): void {
        this.isDemoMode = false;
        console.log('[DemoService] Demo mode disabled');
    }

    /**
     * Get demo airport overview
     */
    getDemoAirportOverview(): AirportOverview {
        // Update timestamp to simulate real-time data
        const now = new Date();
        return {
            ...DENVER_STORM_OVERVIEW,
            timestamp: now.toISOString(),
            weather: {
                ...DENVER_STORM_OVERVIEW.weather,
                timestamp: now.toISOString()
            },
            operational: {
                ...DENVER_STORM_OVERVIEW.operational,
                lastUpdate: now.toISOString()
            }
        };
    }

    /**
     * Get demo situation summary
     */
    getDemoSituationSummary(): SituationSummary {
        // Update timestamp to simulate real-time data
        return {
            ...DENVER_STORM_SUMMARY,
            timestamp: Date.now()
        };
    }

    /**
     * Get demo PIREPs with updated timestamps
     */
    getDemoPireps(): PiRep[] {
        const now = Date.now();

        return DENVER_STORM_PIREPS.map((pirep, index) => {
            // Rotate PIREP ages to simulate real-time updates
            const ageMinutes = (index + 1) * 3 + Math.floor((now - this.lastUpdateTime) / 60000) % 5;
            const timestamp = new Date(now - ageMinutes * 60 * 1000);

            return {
                ...pirep,
                timestamp: timestamp.toISOString(),
                ageMinutes: ageMinutes
            };
        });
    }

    /**
     * Get demo ground tracks with updated timestamps
     */
    getDemoGroundTracks(): GroundTrack[] {
        const now = Date.now();

        return DENVER_STORM_TRACKS.map((track, index) => {
            // Update timestamps to simulate real-time movement
            const timeOffset = (index + 1) * 60 * 1000; // 1 minute apart
            const updatedCoordinates = track.coordinates.map((coord, coordIndex) => {
                const coordTimeOffset = coordIndex * 60 * 1000; // 1 minute between coordinates
                return {
                    ...coord,
                    timestamp: new Date(now - timeOffset - coordTimeOffset).toISOString()
                };
            });

            return {
                ...track,
                coordinates: updatedCoordinates,
                startTime: new Date(now - timeOffset - (track.coordinates.length - 1) * 60 * 1000).toISOString()
            };
        });
    }

    /**
     * Get demo summary response
     */
    getDemoSummaryResponse(): SummaryResponse {
        return {
            airportId: this.demoAirportCode,
            summary: this.getDemoSituationSummary(),
            timestamp: new Date().toISOString(),
            cacheMaxAge: 30000,
            source: 'demo',
            generated: true,
            active: true
        };
    }

    /**
     * Get demo PIREPs response
     */
    getDemoPirepsResponse(): PirepsResponse {
        return {
            airportId: this.demoAirportCode,
            pireps: this.getDemoPireps(),
            count: DENVER_STORM_PIREPS.length,
            timestamp: new Date().toISOString(),
            cacheMaxAge: 30000,
            source: 'demo',
            active: true,
            message: 'Demo storm conditions - windshear and turbulence reports'
        };
    }

    /**
     * Get demo ground tracks response
     */
    getDemoTracksResponse(): TracksResponse {
        return {
            airportId: this.demoAirportCode,
            tracks: this.getDemoGroundTracks(),
            count: DENVER_STORM_TRACKS.length,
            timestamp: new Date().toISOString(),
            cacheMaxAge: 30000,
            source: 'demo',
            active: true,
            message: 'Demo storm conditions - 5 active approach tracks to runway 35L'
        };
    }

    /**
     * Get demo airport overview response
     */
    getDemoAirportOverviewResponse(): AirportOverview {
        return this.getDemoAirportOverview();
    }

    /**
     * Simulate real-time updates by rotating data
     */
    updateDemoData(): void {
        this.lastUpdateTime = Date.now();
    }

    /**
     * Get demo configuration
     */
    getDemoConfig() {
        return DENVER_DEMO_CONFIG;
    }

    /**
     * Check if currently in demo mode
     */
    isInDemoMode(): boolean {
        return this.isDemoMode;
    }
}

export const demoService = new DemoService();
