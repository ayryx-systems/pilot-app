#!/usr/bin/env node

/**
 * Pilot App Airport Data Sync Script
 * ===================================
 * 
 * This script copies airport data from the main dashboard source to the pilot app.
 * 
 * SYNC PROCESS:
 * - Reads from: atc-dashboard/src/components/dashboard/map/constants/airportData.ts
 * - Writes to: pilot-app/src/constants/airports.ts
 * - Preserves TypeScript format
 * - Updates header to indicate auto-sync
 * - Maintains pilot app specific structure
 * 
 * USAGE:
 *   cd pilot-app
 *   npm run sync-airports
 * 
 * IMPORTANT: 
 * - Never edit the generated airports.ts file directly
 * - Always make changes in the main dashboard source file
 * - Run this sync command after updating airport data
 * - Also run the backend sync: cd atc-backend && npm run sync-airports
 * 
 * DEPENDENCIES:
 * - Requires Node.js 18+ with ES modules support
 * - Source file must exist and be readable
 * - Pilot app package.json must have "type": "module"
 */

import fs from "fs";
import path from "path";

const SOURCE_FILE = "../../atc-dashboard/src/components/dashboard/map/constants/airportData.ts";
const TARGET_FILE = "../src/constants/airports.ts";

console.log("🛩️  Syncing airport data to pilot app...");

try {
    // Read source TypeScript file
    const sourcePath = path.resolve(import.meta.dirname, SOURCE_FILE);
    const targetPath = path.resolve(import.meta.dirname, TARGET_FILE);

    const sourceContent = fs.readFileSync(sourcePath, "utf8");

    // Convert to pilot app format
    let pilotContent = sourceContent
        .replace(/export interface.*?\{[\s\S]*?\n\}/g, "") // Remove interfaces
        .replace(
            /export const AIRPORTS: Record<string, AirportData> = /g,
            "export const AIRPORTS: Record<string, AirportData> = "
        )
        .replace(/export const AIRPORTS = /g, "export const AIRPORTS = ") // Fallback
        .replace(/export const DEFAULT_AIRPORT.*$/gm, "") // Remove DEFAULT_AIRPORT export
        .replace(/\n\n+/g, "\n\n"); // Clean up newlines

    // Add pilot app specific header
    const header = `// Airport Data for Pilot App
// =========================
// Simplified airport data focusing on essential pilot information
// Auto-synced from main dashboard - DO NOT EDIT MANUALLY
// Run 'npm run sync-airports' to update

`;

    // Write to pilot app
    fs.writeFileSync(targetPath, header + pilotContent);

    console.log("✅ Pilot app airport data synced successfully!");
    console.log(`   Updated: ${TARGET_FILE}`);
} catch (error) {
    console.error("❌ Sync failed:", error.message);
    process.exit(1);
}
