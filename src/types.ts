/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Represents a standard guitar string with its metadata.
 * Used for precise standard tuning calculations.
 */
export interface GuitarString {
  number: number;      // String index (1 for High E, 6 for Low E)
  note: string;        // Base pitch letter/symbol (e.g., "E", "H", "G", "D", "A", "E")
  pitch: string;       // Scientific pitch notation (e.g., "E4", "H3", "G3", "D3", "A2", "E2")
  frequency: number;   // Expected target fundamental frequency in Hz (standard tuning)
}

/**
 * Standard standard-tuning strings for classic six-string guitars.
 * Uses German/Central-European B-natural naming convention ("H" instead of "B").
 */
export const STANDARD_GUITAR_STRINGS: GuitarString[] = [
  { number: 1, note: "E", pitch: "E4", frequency: 329.63 },
  { number: 2, note: "H", pitch: "H3", frequency: 246.94 },
  { number: 3, note: "G", pitch: "G3", frequency: 196.00 },
  { number: 4, note: "D", pitch: "D3", frequency: 146.83 },
  { number: 5, note: "A", pitch: "A2", frequency: 110.00 },
  { number: 6, note: "E", pitch: "E2", frequency: 82.41 },
];

/**
 * Core tuning state representing the instantaneous pitch detection metrics,
 * frequency analysis, and precision alignment pointers.
 */
export interface TunerState {
  isListening: boolean;              // Whether the microphone is active and processing buffer streams
  permissionGranted: boolean | null; // Track user action regarding web browser media device requests
  detectedFrequency: number;          // Root fundamental frequency identified by AMDF/YIN (in Hz)
  closestString: GuitarString | null;// Calculated standard string reference closest to detected pitch
  centsDifference: number;           // Calculated offset deviance ranging from -50 (flat) to +50 (sharp)
  peakAmplitude: number;             // Audio power value (RMS amplitude metric)
  inTune: boolean;                   // Boolean validation for perfect pitch within sensitivity bounds
}
