/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * =========================================================================
 *                   🎸 NO ADS GUITAR TUNER & CHORD DIRECTORY 🎸
 * =========================================================================
 * 
 * This is a highly professional, ad-free guitar companion application engineered
 * to assist guitarists in tuning their instruments with standard as well as
 * chromatic support. It features:
 * 
 * 1. High-precision Web Audio fundamental frequency analysis using AMDF and CMNDF.
 * 2. Visual tuner components (LED strip bar, dynamic needle scale, and scrolling chromatic tone wheel).
 * 3. Comprehensive chord library (including basis, 7th, barre, sus, and dim chords).
 * 4. Alphabetically sorted scale visualizations (Pentatonics and more).
 * 5. Flexible audio input controls & noise threshold tuning options.
 * 
 * Organized clearly for seamless deployment, open-sourcing, and GitHub integration.
 */

import { useEffect, useRef, useState, CSSProperties } from "react";
import { Mic, MicOff, Volume2, Info, Settings, Zap, CheckCircle2, RefreshCw, Target, Radio, Play, Pause, ChevronDown, X, RotateCw, Sun, SunDim, Trees, Timer, BookOpen } from "lucide-react";
import { STANDARD_GUITAR_STRINGS, UKULELE_STRINGS, TWELVE_STRING_GUITAR_STRINGS, GuitarString } from "./types";
import { detectGuitarPitch, findClosestGuitarString, findClosestChromaticNote } from "./utils/audioProcessor";

// Tuning sensitivity presets
interface SmoothingPreset {
  name: string;
  alpha: number;
  description: string;
}

const SMOOTHING_PRESETS: SmoothingPreset[] = [
  { name: "Zackig", alpha: 0.85, description: "Direkte Saiten-Erkennung ohne jede Bremse (etwas zappelig)" },
  { name: "Optimal", alpha: 0.35, description: "Der goldene Mittelweg für glückliche Saitenzupfer" },
  { name: "Träge", alpha: 0.15, description: "Maximale Trägheit gegen zittrige Greifer oder Windböen" },
];

interface TuningPreset {
  id: string;
  name: string;
  notes: string[];
  pitches: string[];
  freqs: number[];
}

const GUITAR_TUNING_PRESETS: TuningPreset[] = [
  { id: "standard", name: "Standard E-A-D-G-H-E", notes: ["E", "H", "G", "D", "A", "E"], pitches: ["E4", "H3", "G3", "D3", "A2", "E2"], freqs: [329.63, 246.94, 196.00, 146.83, 110.00, 82.41] },
  { id: "drop-d", name: "Drop D (D-A-D-G-H-E)", notes: ["E", "H", "G", "D", "A", "D"], pitches: ["E4", "H3", "G3", "D3", "A2", "D2"], freqs: [329.63, 246.94, 196.00, 146.83, 110.00, 73.42] },
  { id: "half-step", name: "Halbton tiefer (Es-As-Des-Ges-B-Es)", notes: ["Eb", "Hb", "Gb", "Db", "Ab", "Eb"], pitches: ["Eb4", "Bb3", "Gb3", "Db3", "Ab2", "Eb2"], freqs: [311.13, 233.08, 185.00, 138.59, 103.83, 77.78] },
  { id: "dadgad", name: "DADGAD", notes: ["D", "A", "G", "D", "A", "D"], pitches: ["D4", "A3", "G3", "D3", "A2", "D2"], freqs: [293.66, 220.00, 196.00, 146.83, 110.00, 73.42] },
  { id: "open-g", name: "Open G (D-G-D-G-H-D)", notes: ["D", "H", "G", "D", "G", "D"], pitches: ["D4", "H3", "G3", "D3", "G2", "D2"], freqs: [293.66, 246.94, 196.00, 146.83, 98.00, 73.42] }
];

const UKULELE_TUNING_PRESETS: TuningPreset[] = [
  { id: "standard", name: "Standard (G-C-E-A)", notes: ["A", "E", "C", "G"], pitches: ["A4", "E4", "C4", "G4"], freqs: [440.00, 329.63, 261.63, 392.00] },
  { id: "low-g", name: "Low-G (G3-C-E-A)", notes: ["A", "E", "C", "G"], pitches: ["A4", "E4", "C4", "G3"], freqs: [440.00, 329.63, 261.63, 196.00] }
];

interface Chord {
  name: string;
  frets: (number | "X")[]; // string 6 down to 1 (E A D G H E)
  fingering?: (string | null)[]; // string 6 down to 1 finger markings
  barre?: { fret: number; fromStringIdx: number; toStringIdx: number };
  tags: ("basis" | "7th" | "barre" | "sus" | "dim" | "pentatonic" | "caged")[];
  multiNotes?: { stringIdx: number; frets: number[]; fingerings?: string[] }[];
  rootStringIdx?: number;
}

const COMMON_CHORDS: Chord[] = [
  { name: "C", frets: ["X", 3, 2, 0, 1, 0], fingering: [null, "3", "2", null, "1", null], tags: ["basis"] },
  { name: "A", frets: ["X", 0, 2, 2, 2, 0], fingering: [null, null, "1", "2", "3", null], tags: ["basis"] },
  { name: "G", frets: [3, 2, 0, 0, 0, 3], fingering: ["3", "2", null, null, null, "4"], tags: ["basis"] },
  { name: "E", frets: [0, 2, 2, 1, 0, 0], fingering: [null, "2", "3", "1", null, null], tags: ["basis"] },
  { name: "D", frets: ["X", "X", 0, 2, 3, 2], fingering: [null, null, null, "1", "3", "2"], tags: ["basis"] },
  { name: "Am", frets: ["X", 0, 2, 2, 1, 0], fingering: [null, null, "2", "3", "1", null], tags: ["basis"] },
  { name: "Dm", frets: ["X", "X", 0, 2, 3, 1], fingering: [null, null, null, "2", "3", "1"], tags: ["basis"] },
  { name: "Em", frets: [0, 2, 2, 0, 0, 0], fingering: [null, "2", "3", null, null, null], tags: ["basis"] },
  // Barré-Griffe: All major/minor barre chords across the neck with root on E2 (E-shape) & A2 (A-shape)
  { name: "F (Dur)", frets: [1, 3, 3, 2, 1, 1], fingering: ["1", "3", "4", "2", "1", "1"], barre: { fret: 1, fromStringIdx: 0, toStringIdx: 5 }, rootStringIdx: 0, tags: ["barre", "basis"] },
  { name: "Fm (Moll)", frets: [1, 3, 3, 1, 1, 1], fingering: ["1", "3", "4", "1", "1", "1"], barre: { fret: 1, fromStringIdx: 0, toStringIdx: 5 }, rootStringIdx: 0, tags: ["barre", "basis"] },
  { name: "F# (Dur)", frets: [2, 4, 4, 3, 2, 2], fingering: ["1", "3", "4", "2", "1", "1"], barre: { fret: 2, fromStringIdx: 0, toStringIdx: 5 }, rootStringIdx: 0, tags: ["barre"] },
  { name: "F#m (Moll)", frets: [2, 4, 4, 2, 2, 2], fingering: ["1", "3", "4", "1", "1", "1"], barre: { fret: 2, fromStringIdx: 0, toStringIdx: 5 }, rootStringIdx: 0, tags: ["barre"] },
  { name: "G (Dur B.)", frets: [3, 5, 5, 4, 3, 3], fingering: ["1", "3", "4", "2", "1", "1"], barre: { fret: 3, fromStringIdx: 0, toStringIdx: 5 }, rootStringIdx: 0, tags: ["barre"] },
  { name: "Gm (Moll)", frets: [3, 5, 5, 3, 3, 3], fingering: ["1", "3", "4", "1", "1", "1"], barre: { fret: 3, fromStringIdx: 0, toStringIdx: 5 }, rootStringIdx: 0, tags: ["barre"] },
  { name: "G# (Dur)", frets: [4, 6, 6, 5, 4, 4], fingering: ["1", "3", "4", "2", "1", "1"], barre: { fret: 4, fromStringIdx: 0, toStringIdx: 5 }, rootStringIdx: 0, tags: ["barre"] },
  { name: "G#m (Moll)", frets: [4, 6, 6, 4, 4, 4], fingering: ["1", "3", "4", "1", "1", "1"], barre: { fret: 4, fromStringIdx: 0, toStringIdx: 5 }, rootStringIdx: 0, tags: ["barre"] },
  { name: "A (Dur B.)", frets: [5, 7, 7, 6, 5, 5], fingering: ["1", "3", "4", "2", "1", "1"], barre: { fret: 5, fromStringIdx: 0, toStringIdx: 5 }, rootStringIdx: 0, tags: ["barre"] },
  { name: "Am (Moll B.)", frets: [5, 7, 7, 5, 5, 5], fingering: ["1", "3", "4", "1", "1", "1"], barre: { fret: 5, fromStringIdx: 0, toStringIdx: 5 }, rootStringIdx: 0, tags: ["barre"] },
  { name: "A# / B (Dur)", frets: [6, 8, 8, 7, 6, 6], fingering: ["1", "3", "4", "2", "1", "1"], barre: { fret: 6, fromStringIdx: 0, toStringIdx: 5 }, rootStringIdx: 0, tags: ["barre"] },
  { name: "A#m (Moll)", frets: [6, 8, 8, 6, 6, 6], fingering: ["1", "3", "4", "1", "1", "1"], barre: { fret: 6, fromStringIdx: 0, toStringIdx: 5 }, rootStringIdx: 0, tags: ["barre"] },
  { name: "H / B (Dur)", frets: [7, 9, 9, 8, 7, 7], fingering: ["1", "3", "4", "2", "1", "1"], barre: { fret: 7, fromStringIdx: 0, toStringIdx: 5 }, rootStringIdx: 0, tags: ["barre"] },
  { name: "Hm (Moll B.)", frets: [7, 9, 9, 7, 7, 7], fingering: ["1", "3", "4", "1", "1", "1"], barre: { fret: 7, fromStringIdx: 0, toStringIdx: 5 }, rootStringIdx: 0, tags: ["barre"] },

  // A-Form Barré-Griffe (Root on A string)
  { name: "B / Bb (Dur)", frets: ["X", 1, 3, 3, 3, 1], fingering: [null, "1", "3", "3", "3", "1"], barre: { fret: 1, fromStringIdx: 1, toStringIdx: 5 }, rootStringIdx: 1, tags: ["barre", "basis"] },
  { name: "Bm / Bbm (Moll)", frets: ["X", 1, 3, 3, 2, 1], fingering: [null, "1", "3", "4", "2", "1"], barre: { fret: 1, fromStringIdx: 1, toStringIdx: 5 }, rootStringIdx: 1, tags: ["barre", "basis"] },
  { name: "H / B-natural (Dur)", frets: ["X", 2, 4, 4, 4, 2], fingering: [null, "1", "3", "3", "3", "1"], barre: { fret: 2, fromStringIdx: 1, toStringIdx: 5 }, rootStringIdx: 1, tags: ["barre", "basis"] },
  { name: "Hm / Bm (Moll)", frets: ["X", 2, 4, 4, 3, 2], fingering: [null, "1", "3", "4", "2", "1"], barre: { fret: 2, fromStringIdx: 1, toStringIdx: 5 }, rootStringIdx: 1, tags: ["barre", "basis"] },
  { name: "C (Dur B. A-Typ)", frets: ["X", 3, 5, 5, 5, 3], fingering: [null, "1", "3", "3", "3", "1"], barre: { fret: 3, fromStringIdx: 1, toStringIdx: 5 }, rootStringIdx: 1, tags: ["barre"] },
  { name: "Cm (Moll B. A-Typ)", frets: ["X", 3, 5, 5, 4, 3], fingering: [null, "1", "3", "4", "2", "1"], barre: { fret: 3, fromStringIdx: 1, toStringIdx: 5 }, rootStringIdx: 1, tags: ["barre"] },
  { name: "C# / Db (Dur B. A-Typ)", frets: ["X", 4, 6, 6, 6, 4], fingering: [null, "1", "3", "3", "3", "1"], barre: { fret: 4, fromStringIdx: 1, toStringIdx: 5 }, rootStringIdx: 1, tags: ["barre"] },
  { name: "C#m / Dbm (Moll B. A-Typ)", frets: ["X", 4, 6, 6, 5, 4], fingering: [null, "1", "3", "4", "2", "1"], barre: { fret: 4, fromStringIdx: 1, toStringIdx: 5 }, rootStringIdx: 1, tags: ["barre"] },
  { name: "D (Dur B. A-Typ)", frets: ["X", 5, 7, 7, 7, 5], fingering: [null, "1", "3", "3", "3", "1"], barre: { fret: 5, fromStringIdx: 1, toStringIdx: 5 }, rootStringIdx: 1, tags: ["barre"] },
  { name: "Dm (Moll B. A-Typ)", frets: ["X", 5, 7, 7, 6, 5], fingering: [null, "1", "3", "4", "2", "1"], barre: { fret: 5, fromStringIdx: 1, toStringIdx: 5 }, rootStringIdx: 1, tags: ["barre"] },
  { name: "D# / Eb (Dur B. A-Typ)", frets: ["X", 6, 8, 8, 8, 6], fingering: [null, "1", "3", "3", "3", "1"], barre: { fret: 6, fromStringIdx: 1, toStringIdx: 5 }, rootStringIdx: 1, tags: ["barre"] },
  { name: "D#m / Ebm (Moll B. A-Typ)", frets: ["X", 6, 8, 8, 7, 6], fingering: [null, "1", "3", "4", "2", "1"], barre: { fret: 6, fromStringIdx: 1, toStringIdx: 5 }, rootStringIdx: 1, tags: ["barre"] },
  { name: "E (Dur B. A-Typ)", frets: ["X", 7, 9, 9, 9, 7], fingering: [null, "1", "3", "3", "3", "1"], barre: { fret: 7, fromStringIdx: 1, toStringIdx: 5 }, rootStringIdx: 1, tags: ["barre"] },
  { name: "Em (Moll B. A-Typ)", frets: ["X", 7, 9, 9, 8, 7], fingering: [null, "1", "3", "4", "2", "1"], barre: { fret: 7, fromStringIdx: 1, toStringIdx: 5 }, rootStringIdx: 1, tags: ["barre"] },

  // 7er Akkorde
  { name: "D7", frets: ["X", "X", 0, 2, 1, 2], fingering: [null, null, null, "2", "1", "3"], tags: ["7th"] },
  { name: "Am7", frets: ["X", 0, 2, 0, 1, 0], fingering: [null, null, "2", null, "1", null], tags: ["7th"] },
  { name: "C7", frets: ["X", 3, 2, 3, 1, 0], fingering: [null, "3", "2", "4", "1", null], tags: ["7th"] },
  { name: "G7", frets: [3, 2, 0, 0, 0, 1], fingering: ["3", "2", null, null, null, "1"], tags: ["7th"] },
  { name: "E7", frets: [0, 2, 0, 1, 0, 0], fingering: [null, "2", null, "1", null, null], tags: ["7th"] },
  { name: "A7", frets: ["X", 0, 2, 0, 2, 0], fingering: [null, null, "1", null, "2", null], tags: ["7th"] },
  { name: "Hm7 (Bm7)", frets: ["X", 2, 4, 2, 3, 2], fingering: [null, "1", "3", "1", "2", "1"], barre: { fret: 2, fromStringIdx: 1, toStringIdx: 5 }, tags: ["7th"] },
  { name: "H7 (B7)", frets: ["X", 2, 1, 2, 0, 2], fingering: [null, "2", "1", "3", null, "4"], tags: ["7th"] },
  { name: "Bm7 (Bbm7)", frets: ["X", 1, 3, 1, 2, 1], fingering: [null, "1", "3", "1", "2", "1"], barre: { fret: 1, fromStringIdx: 1, toStringIdx: 5 }, tags: ["7th"] },
  { name: "B7 (Bb7)", frets: ["X", 1, 3, 1, 3, 1], fingering: [null, "1", "3", "1", "4", "1"], barre: { fret: 1, fromStringIdx: 1, toStringIdx: 5 }, tags: ["7th"] },
  { name: "Dm7", frets: ["X", "X", 0, 2, 1, 1], fingering: [null, null, null, "2", "1", "1"], barre: { fret: 1, fromStringIdx: 4, toStringIdx: 5 }, tags: ["7th"] },
  { name: "Em7", frets: [0, 2, 2, 0, 3, 0], fingering: [null, "1", "2", null, "3", null], tags: ["7th"] },
  { name: "Cm7", frets: ["X", 3, 5, 3, 4, 3], fingering: [null, "1", "3", "1", "2", "1"], barre: { fret: 3, fromStringIdx: 1, toStringIdx: 5 }, tags: ["7th"] },
  { name: "Fm7", frets: [1, 3, 1, 1, 1, 1], fingering: ["1", "3", "1", "1", "1", "1"], barre: { fret: 1, fromStringIdx: 0, toStringIdx: 5 }, tags: ["7th"] },
  { name: "Gm7", frets: [3, 5, 3, 3, 3, 3], fingering: ["1", "3", "1", "1", "1", "1"], barre: { fret: 3, fromStringIdx: 0, toStringIdx: 5 }, tags: ["7th"] },
  { name: "F7", frets: [1, 3, 1, 2, 1, 1], fingering: ["1", "3", "1", "2", "1", "1"], barre: { fret: 1, fromStringIdx: 0, toStringIdx: 5 }, tags: ["7th"] },
  { name: "Cmaj7", frets: ["X", 3, 2, 0, 0, 0], fingering: [null, "3", "2", null, null, null], tags: ["7th"] },
  { name: "Dmaj7", frets: ["X", "X", 0, 2, 2, 2], fingering: [null, null, null, "1", "1", "1"], barre: { fret: 2, fromStringIdx: 3, toStringIdx: 5 }, tags: ["7th"] },
  { name: "Emaj7", frets: [0, 2, 1, 1, 0, 0], fingering: [null, "2", "1", "1", null, null], tags: ["7th"] },
  { name: "Fmaj7", frets: ["X", "X", 3, 2, 1, 0], fingering: [null, null, "3", "2", "1", null], tags: ["7th"] },
  { name: "Gmaj7", frets: [3, 2, 0, 0, 0, 2], fingering: ["2", "1", null, null, null, "3"], tags: ["7th"] },
  { name: "Amaj7", frets: ["X", 0, 2, 1, 2, 0], fingering: [null, null, "2", "1", "3", null], tags: ["7th"] },
  { name: "Hmaj7 (Bmaj7)", frets: ["X", 2, 4, 3, 4, 2], fingering: [null, "1", "3", "2", "4", "1"], barre: { fret: 2, fromStringIdx: 1, toStringIdx: 5 }, tags: ["7th"] },
  { name: "Bmaj7 (Bbmaj7)", frets: ["X", 1, 3, 2, 3, 1], fingering: [null, "1", "3", "2", "4", "1"], barre: { fret: 1, fromStringIdx: 1, toStringIdx: 5 }, tags: ["7th"] },

  // Sus-Akkorde
  { name: "Asus4", frets: ["X", 0, 2, 2, 3, 0], fingering: [null, null, "2", "3", "4", null], tags: ["sus"] },
  { name: "Dsus4", frets: ["X", "X", 0, 2, 3, 3], fingering: [null, null, null, "1", "3", "4"], tags: ["sus"] },
  { name: "Esus4", frets: [0, 2, 2, 2, 0, 0], fingering: [null, "2", "3", "4", null, null], tags: ["sus"] },
  { name: "Csus4", frets: ["X", 3, 3, 0, 1, 1], fingering: [null, "3", "4", null, "1", "1"], barre: { fret: 1, fromStringIdx: 4, toStringIdx: 5 }, tags: ["sus"] },
  { name: "Fsus4", frets: [1, 3, 3, 3, 1, 1], fingering: ["1", "3", "4", "2", "1", "1"], barre: { fret: 1, fromStringIdx: 0, toStringIdx: 5 }, tags: ["sus"] },
  { name: "Gsus4", frets: [3, 3, 0, 0, 1, 3], fingering: ["3", "4", null, null, "1", "2"], tags: ["sus"] },
  { name: "Asus2", frets: ["X", 0, 2, 2, 0, 0], fingering: [null, null, "2", "3", null, null], tags: ["sus"] },
  { name: "Dsus2", frets: ["X", "X", 0, 2, 3, 0], fingering: [null, null, null, "1", "3", null], tags: ["sus"] },
  { name: "Csus2", frets: ["X", 3, 0, 0, 3, 3], fingering: [null, "1", null, null, "3", "4"], tags: ["sus"] },
  { name: "Fsus2", frets: ["X", "X", 3, 0, 1, 1], fingering: [null, null, "3", null, "1", "1"], tags: ["sus"] },
  { name: "Gsus2", frets: [3, 0, 0, 0, 3, 3], fingering: ["2", null, null, null, "3", "4"], tags: ["sus"] },
  { name: "Esus2", frets: [0, 2, 4, 1, 0, 0], fingering: [null, "1", "3", "2", null, null], tags: ["sus"] },
  { name: "Hsus4 (Bsus4)", frets: ["X", 2, 4, 4, 5, 2], fingering: [null, "1", "3", "4", "2", "1"], barre: { fret: 2, fromStringIdx: 1, toStringIdx: 5 }, tags: ["sus"] },
  { name: "Hsus2 (Bsus2)", frets: ["X", 2, 4, 4, 2, 2], fingering: [null, "1", "3", "4", "1", "1"], barre: { fret: 2, fromStringIdx: 1, toStringIdx: 5 }, tags: ["sus"] },
  { name: "Bsus4 (Bbsus4)", frets: ["X", 1, 3, 3, 4, 1], fingering: [null, "1", "3", "4", "2", "1"], barre: { fret: 1, fromStringIdx: 1, toStringIdx: 5 }, tags: ["sus"] },
  { name: "Bsus2 (Bbsus2)", frets: ["X", 1, 3, 3, 1, 1], fingering: [null, "1", "3", "4", "1", "1"], barre: { fret: 1, fromStringIdx: 1, toStringIdx: 5 }, tags: ["sus"] },

  // Dim / Verminderte
  { name: "Adim7", frets: ["X", "X", 1, 2, 1, 2], fingering: [null, null, "1", "3", "2", "4"], tags: ["dim"] },
  { name: "Fdim7", frets: ["X", "X", 0, 1, 0, 1], fingering: [null, null, null, "1", null, "2"], tags: ["dim"] },
  { name: "Edim7", frets: ["X", "X", 2, 3, 2, 3], fingering: [null, null, "1", "3", "2", "4"], tags: ["dim"] },
  { name: "Hdim", frets: ["X", 2, 3, 4, 3, "X"], fingering: [null, "1", "2", "4", "3", null], tags: ["dim"] },
  { name: "Cdim7", frets: ["X", 3, 4, 2, 4, "X"], fingering: [null, "2", "3", "1", "4", null], tags: ["dim"] },
  { name: "Hdim7", frets: ["X", 2, 3, 1, 3, "X"], fingering: [null, "2", "3", "1", "4", null], tags: ["dim"] },
  { name: "Ddim7", frets: ["X", "X", 3, 4, 3, 4], fingering: [null, null, "1", "3", "2", "4"], tags: ["dim"] },
  { name: "Gdim7", frets: [3, "X", 2, 3, 2, "X"], fingering: ["2", null, "1", "3", "4", null], tags: ["dim"] },
  { name: "C#dim7", frets: ["X", 4, 5, 3, 5, "X"], fingering: [null, "2", "4", "1", "3", null], tags: ["dim"] },
  { name: "F#dim7", frets: ["X", "X", 4, 5, 4, 5], fingering: [null, null, "1", "3", "2", "4"], tags: ["dim"] },
  { name: "G#dim7", frets: ["X", "X", 6, 7, 6, 7], fingering: [null, null, "1", "3", "2", "4"], tags: ["dim"] },
  // CAGED System Akkorde (C, A, G, E, D Formen für alle Grundtöne)
  { name: "C (C-Form)", frets: ["X", 3, 2, 0, 1, 0], fingering: [null, "3", "2", null, "1", null], tags: ["basis", "caged"] },
  { name: "C (A-Form)", frets: ["X", 3, 5, 5, 5, 3], fingering: [null, "1", "2", "3", "4", "1"], barre: { fret: 3, fromStringIdx: 1, toStringIdx: 5 }, tags: ["barre", "caged"] },
  { name: "C (G-Form)", frets: [8, 7, 5, 5, 5, 8], fingering: ["4", "3", "1", "1", "1", "4"], barre: { fret: 5, fromStringIdx: 2, toStringIdx: 4 }, tags: ["caged"] },
  { name: "C (E-Form)", frets: [8, 10, 10, 9, 8, 8], fingering: ["1", "3", "4", "2", "1", "1"], barre: { fret: 8, fromStringIdx: 0, toStringIdx: 5 }, tags: ["barre", "caged"] },
  { name: "C (D-Form)", frets: ["X", "X", 10, 12, 13, 12], fingering: [null, null, "1", "3", "4", "2"], tags: ["caged"] },

  { name: "A (C-Form)", frets: ["X", 12, 11, 9, 10, 9], fingering: [null, "4", "3", "1", "2", "1"], barre: { fret: 9, fromStringIdx: 3, toStringIdx: 5 }, tags: ["barre", "caged"] },
  { name: "A (A-Form)", frets: ["X", 0, 2, 2, 2, 0], fingering: [null, null, "1", "2", "3", null], tags: ["basis", "caged"] },
  { name: "A (G-Form)", frets: [5, 4, 2, 2, 2, 5], fingering: ["4", "3", "1", "1", "1", "4"], barre: { fret: 2, fromStringIdx: 2, toStringIdx: 4 }, tags: ["caged"] },
  { name: "A (E-Form)", frets: [5, 7, 7, 6, 5, 5], fingering: ["1", "3", "4", "2", "1", "1"], barre: { fret: 5, fromStringIdx: 0, toStringIdx: 5 }, tags: ["barre", "caged"] },
  { name: "A (D-Form)", frets: ["X", "X", 7, 9, 10, 9], fingering: [null, null, "1", "2", "4", "3"], tags: ["caged"] },

  { name: "G (C-Form)", frets: ["X", 10, 9, 7, 8, 7], fingering: [null, "4", "3", "1", "2", "1"], barre: { fret: 7, fromStringIdx: 3, toStringIdx: 5 }, tags: ["barre", "caged"] },
  { name: "G (A-Form)", frets: ["X", 10, 12, 12, 12, 10], fingering: [null, "1", "2", "3", "4", "1"], barre: { fret: 10, fromStringIdx: 1, toStringIdx: 5 }, tags: ["barre", "caged"] },
  { name: "G (G-Form)", frets: [3, 2, 0, 0, 0, 3], fingering: ["3", "2", null, null, null, "4"], tags: ["basis", "caged"] },
  { name: "G (E-Form)", frets: [3, 5, 5, 4, 3, 3], fingering: ["1", "3", "4", "2", "1", "1"], barre: { fret: 3, fromStringIdx: 0, toStringIdx: 5 }, tags: ["barre", "caged"] },
  { name: "G (D-Form)", frets: ["X", "X", 5, 7, 8, 7], fingering: [null, null, "1", "2", "4", "3"], tags: ["caged"] },

  { name: "E (C-Form)", frets: ["X", 7, 6, 4, 5, 4],  fingering: [null, "4", "3", "1", "2", "1"], barre: { fret: 4, fromStringIdx: 3, toStringIdx: 5 }, tags: ["barre", "caged"] },
  { name: "E (A-Form)", frets: ["X", 7, 9, 9, 9, 7],  fingering: [null, "1", "2", "3", "4", "1"], barre: { fret: 7, fromStringIdx: 1, toStringIdx: 5 }, tags: ["barre", "caged"] },
  { name: "E (G-Form)", frets: [12, 11, 9, 9, 9, 12], fingering: ["4", "3", "1", "1", "1", "4"], barre: { fret: 9, fromStringIdx: 2, toStringIdx: 4 }, tags: ["caged"] },
  { name: "E (E-Form)", frets: [0, 2, 2, 1, 0, 0],  fingering: [null, "2", "3", "1", null, null], tags: ["basis", "caged"] },
  { name: "E (D-Form)", frets: ["X", "X", 2, 4, 5, 4],  fingering: [null, null, "1", "2", "4", "3"], tags: ["caged"] },

  { name: "D (C-Form)", frets: ["X", 5, 4, 2, 3, 2],  fingering: [null, "4", "3", "1", "2", "1"], barre: { fret: 2, fromStringIdx: 3, toStringIdx: 5 }, tags: ["barre", "caged"] },
  { name: "D (A-Form)", frets: ["X", 5, 7, 7, 7, 5],  fingering: [null, "1", "2", "3", "4", "1"], barre: { fret: 5, fromStringIdx: 1, toStringIdx: 5 }, tags: ["barre", "caged"] },
  { name: "D (G-Form)", frets: [10, 9, 7, 7, 10, 10], fingering: ["4", "3", "1", "1", "4", "4"], tags: ["caged"] },
  { name: "D (E-Form)", frets: [10, 12, 12, 11, 10, 10], fingering: ["1", "3", "4", "2", "1", "1"], barre: { fret: 10, fromStringIdx: 0, toStringIdx: 5 }, tags: ["barre", "caged"] },
  { name: "D (D-Form)", frets: ["X", "X", 0, 2, 3, 2],  fingering: [null, null, null, "1", "3", "2"], tags: ["basis", "caged"] },
  // Pentatonik-Griffe
  { 
    name: "Am Pent.", 
    frets: [5, 5, 5, 5, 5, 5], 
    tags: ["pentatonic"],
    multiNotes: [
      { stringIdx: 0, frets: [5, 8], fingerings: ["1", "4"] },
      { stringIdx: 1, frets: [5, 7], fingerings: ["1", "3"] },
      { stringIdx: 2, frets: [5, 7], fingerings: ["1", "3"] },
      { stringIdx: 3, frets: [5, 7], fingerings: ["1", "3"] },
      { stringIdx: 4, frets: [5, 8], fingerings: ["1", "4"] },
      { stringIdx: 5, frets: [5, 8], fingerings: ["1", "4"] },
    ]
  },
  { 
    name: "C Pent.", 
    frets: [8, 8, 8, 8, 8, 8], 
    tags: ["pentatonic"],
    multiNotes: [
      { stringIdx: 0, frets: [8, 10], fingerings: ["1", "3"] },
      { stringIdx: 1, frets: [7, 10], fingerings: ["1", "4"] },
      { stringIdx: 2, frets: [7, 10], fingerings: ["1", "4"] },
      { stringIdx: 3, frets: [7, 9], fingerings: ["1", "3"] },
      { stringIdx: 4, frets: [8, 10], fingerings: ["1", "3"] },
      { stringIdx: 5, frets: [8, 10], fingerings: ["1", "3"] },
    ]
  },
  { 
    name: "G Pent.", 
    frets: [3, 3, 3, 3, 3, 3], 
    tags: ["pentatonic"],
    multiNotes: [
      { stringIdx: 0, frets: [3, 5], fingerings: ["1", "3"] },
      { stringIdx: 1, frets: [2, 5], fingerings: ["1", "4"] },
      { stringIdx: 2, frets: [2, 5], fingerings: ["1", "4"] },
      { stringIdx: 3, frets: [2, 4], fingerings: ["1", "3"] },
      { stringIdx: 4, frets: [3, 5], fingerings: ["1", "3"] },
      { stringIdx: 5, frets: [3, 5], fingerings: ["1", "3"] },
    ]
  },
];

const KEY_SEMITONES: Record<string, number> = {
  E: 0,
  F: 1,
  G: 3,
  A: 5,
  H: 7,
  C: 8,
  D: 10
};

function getPentatonicStartFret(rootSemitone: number, type: "minor" | "major", shape: string): number {
  const intervals = type === "minor" ? [0, 3, 5, 7, 10] : [0, 2, 4, 7, 9];
  const shapeIdx = parseInt(shape) - 1;
  const intervalOffset = intervals[shapeIdx];
  let start = (rootSemitone + intervalOffset) % 12;
  return start;
}

function generatePentatonicChord(keyName: string, type: "minor" | "major", shape: string): Chord {
  const rootSemitone = KEY_SEMITONES[keyName] ?? 5;
  const scaleIntervals = type === "minor" ? [0, 3, 5, 7, 10] : [0, 2, 4, 7, 9];
  
  if (shape === "extended") {
    // Extended neck: all frets from 0 to 17
    const multiNotes: Chord["multiNotes"] = [];
    const openStrings = [0, 5, 10, 15, 19, 24]; // string 6 down to 1
    
    for (let stringIdx = 0; stringIdx < 6; stringIdx++) {
      const openPitch = openStrings[stringIdx];
      const matchFrets: number[] = [];
      const matchFingerings: string[] = [];
      
      for (let fret = 0; fret <= 17; fret++) {
        const pitch = openPitch + fret;
        const offset = ((pitch - rootSemitone) % 12 + 12) % 12;
        if (scaleIntervals.includes(offset)) {
          matchFrets.push(fret);
          if (offset === 0) {
            matchFingerings.push("R");
          } else {
            matchFingerings.push("");
          }
        }
      }
      multiNotes.push({ stringIdx, frets: matchFrets, fingerings: matchFingerings });
    }
    
    return {
      name: `${keyName}-${type === "minor" ? "Moll" : "Dur"} Pent. (Ganzes Griffbrett)`,
      frets: [0, 0, 0, 0, 0, 0],
      tags: ["pentatonic"],
      multiNotes
    };
  } else {
    // Box shape
    const shapeNum = parseInt(shape);
    const startFretLocal = getPentatonicStartFret(rootSemitone, type, shape);
    
    let minF = startFretLocal;
    let maxF = startFretLocal + 3;
    if (shapeNum !== 1 && shapeNum !== 4) {
      minF = startFretLocal - 1;
      maxF = startFretLocal + 2;
    }
    
    if (minF < 0) {
      minF += 12;
      maxF += 12;
    }
    
    const multiNotes: Chord["multiNotes"] = [];
    const openStrings = [0, 5, 10, 15, 19, 24];
    
    for (let stringIdx = 0; stringIdx < 6; stringIdx++) {
      const openPitch = openStrings[stringIdx];
      const matchFrets: number[] = [];
      const matchFingerings: string[] = [];
      
      for (let fret = minF; fret <= maxF; fret++) {
        const pitch = openPitch + fret;
        const offset = ((pitch - rootSemitone) % 12 + 12) % 12;
        if (scaleIntervals.includes(offset)) {
          matchFrets.push(fret);
          if (offset === 0) {
            matchFingerings.push("R");
          } else {
            const degree = scaleIntervals.indexOf(offset) + 1;
            matchFingerings.push(degree.toString());
          }
        }
      }
      multiNotes.push({ stringIdx, frets: matchFrets, fingerings: matchFingerings });
    }
    
    return {
      name: `${keyName}-${type === "minor" ? "Moll" : "Dur"} Pent. Shape ${shape}`,
      frets: [minF, minF, minF, minF, minF, minF],
      tags: ["pentatonic"],
      multiNotes
    };
  }
}

export default function App() {
  // Audio state references
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  // States
  const [permissionState, setPermissionState] = useState<"not-requested" | "granted" | "denied">("not-requested");
  const [isListening, setIsListening] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string>("");
  const [bypassPermissionOverlay, setBypassPermissionOverlay] = useState<boolean>(false);

  // COMMIT: Refactored background theme options to support Dark Mode, Sunshine Mode (warm gold/yellowish), and Park Mode (soothing green).
  // Added horizontal scrolling to main toolbar header on mobile and compacted element sizing to fit screens elegantly.
  const [themeMode, setThemeMode] = useState<"dark" | "sunshine" | "park">(() => {
    return (localStorage.getItem("appThemeMode") as "dark" | "sunshine" | "park") || "sunshine";
  });

  useEffect(() => {
    localStorage.setItem("appThemeMode", themeMode);
  }, [themeMode]);

  // Live tuning state (throttled/smoothed)
  const [tuningData, setTuningData] = useState<{
    frequency: number;
    closestString: GuitarString | null;
    centsDiff: number;
    hasSignal: boolean;
    rmsValue: number;
  }>({
    frequency: 0,
    closestString: null,
    centsDiff: 0,
    hasSignal: false,
    rmsValue: 0,
  });

  // Settings states
  const [selectedPreset, setSelectedPreset] = useState<SmoothingPreset>(SMOOTHING_PRESETS[1]); // Standard
  const [targetStringLock, setTargetStringLock] = useState<number | null>(null); // null = auto detect
  const targetStringLockRef = useRef<number | null>(null);
  useEffect(() => {
    targetStringLockRef.current = targetStringLock;
  }, [targetStringLock]);

  const [referenceA4, setReferenceA4] = useState<number>(440);
  const referenceA4Ref = useRef<number>(440);
  useEffect(() => {
    referenceA4Ref.current = referenceA4;
  }, [referenceA4]);

  const [selectedInstrumentId, setSelectedInstrumentId] = useState<"guitar" | "ukulele" | "guitar12">("guitar");
  const selectedInstrumentIdRef = useRef<"guitar" | "ukulele" | "guitar12">("guitar");
  const [selectedTuningId, setSelectedTuningId] = useState<string>("standard");

  useEffect(() => {
    selectedInstrumentIdRef.current = selectedInstrumentId;
    setTargetStringLock(null);
    setSelectedTuningId("standard"); // Reset tuning when changing instrument
  }, [selectedInstrumentId]);

  const currentStrings = (() => {
    if (selectedInstrumentId === "ukulele") {
      const preset = UKULELE_TUNING_PRESETS.find(p => p.id === selectedTuningId) || UKULELE_TUNING_PRESETS[0];
      return preset.freqs.map((freq, idx) => ({
        number: idx + 1,
        note: preset.notes[idx],
        pitch: preset.pitches[idx],
        frequency: freq
      }));
    } else if (selectedInstrumentId === "guitar12") {
      // 12-string guitar standard
      return TWELVE_STRING_GUITAR_STRINGS;
    } else {
      // 6-string guitar
      const preset = GUITAR_TUNING_PRESETS.find(p => p.id === selectedTuningId) || GUITAR_TUNING_PRESETS[0];
      return preset.freqs.map((freq, idx) => ({
        number: idx + 1,
        note: preset.notes[idx],
        pitch: preset.pitches[idx],
        frequency: freq
      }));
    }
  })();

  const tunedGuitarStrings = currentStrings.map(str => ({
    ...str,
    frequency: str.frequency * (referenceA4 / 440.0)
  }));

  const tunedGuitarStringsRef = useRef<GuitarString[]>([]);
  useEffect(() => {
    tunedGuitarStringsRef.current = tunedGuitarStrings;
  }, [tunedGuitarStrings]);

  const [isModusDropdownOpen, setIsModusDropdownOpen] = useState<boolean>(false);
  const [activeFooterTab, setActiveFooterTab] = useState<"chord" | "fretboard" | "practice" | null>(null);
  const [displayMode, setDisplayMode] = useState<"soundhole" | "led-bar">("soundhole");
  const [isDisplayDropdownOpen, setIsDisplayDropdownOpen] = useState<boolean>(false);
  const [soundholeRotation, setSoundholeRotation] = useState<number>(0);
  const [fretboardRotation, setFretboardRotation] = useState<number>(0);
  const [selectedChord, setSelectedChord] = useState<Chord | null>(COMMON_CHORDS[0]);
  const [chordFilter, setChordFilter] = useState<"all" | "basis" | "7th" | "barre" | "sus" | "dim" | "pentatonic" | "caged">("all");

  const [pentatonicKey, setPentatonicKey] = useState<string>("A");
  const [pentatonicType, setPentatonicType] = useState<"minor" | "major">("minor");
  const [pentatonicShape, setPentatonicShape] = useState<string>("1");

  const [cagedRoot, setCagedRoot] = useState<string>("D");
  const [cagedShape, setCagedShape] = useState<string>("A");

  // Extended Full Screen modal and scale auto play states
  const [isExtendedNeckModalOpen, setIsExtendedNeckModalOpen] = useState<boolean>(false);
  const [isScalePlaying, setIsScalePlaying] = useState<boolean>(false);
  const scalePlayTimeoutRef = useRef<any>(null);
  const [isNeckFlipped, setIsNeckFlipped] = useState<boolean>(false);
  const [isVerticalPentatonicRotated, setIsVerticalPentatonicRotated] = useState<boolean>(false);

  // Keep dynamic selectedChord synchronized to pentatonic params
  useEffect(() => {
    if (chordFilter === "pentatonic") {
      const scaleChord = generatePentatonicChord(pentatonicKey, pentatonicType, pentatonicShape);
      setSelectedChord(scaleChord);
    }
  }, [chordFilter, pentatonicKey, pentatonicType, pentatonicShape]);

  // Keep dynamic selectedChord synchronized to CAGED parameters
  useEffect(() => {
    if (chordFilter === "caged") {
      const matchName = `${cagedRoot} (${cagedShape}-Form)`;
      const found = COMMON_CHORDS.find(c => c.name === matchName);
      if (found) {
        setSelectedChord(found);
      }
    }
  }, [chordFilter, cagedRoot, cagedShape]);

  // Interactive "afterglow" state for the last strummed note / tuning delta
  const [lastStrum, setLastStrum] = useState<{
    cents: number;
    closestString: GuitarString;
    timestamp: number;
  } | null>(null);

  // WhatsApp feedback flow state variable
  const [whatsappMessage, setWhatsappMessage] = useState<string>("");

  // Continuous drone toggle for ear tuning reference tone
  const [isContinuousReference, setIsContinuousReference] = useState<boolean>(false);

  // Practice Metronome & Rhythm Partner States
  const [metronomeBpm, setMetronomeBpm] = useState<number>(120);
  const [isMetronomePlaying, setIsMetronomePlaying] = useState<boolean>(false);
  const [metronomeBeat, setMetronomeBeat] = useState<number>(0);
  const metronomeTimerRef = useRef<any>(null);
  const metronomeBeatRef = useRef<number>(0);
  const [tapTimes, setTapTimes] = useState<number[]>([]);

  // Web Audio Click Synthesis for Practice Metronome
  const playMetronomeClick = (isFirstBeat: boolean) => {
    try {
      let audioCtx = audioCtxRef.current;
      if (!audioCtx || audioCtx.state === "closed") {
        const AudioCtxClass = window.AudioContext || (window as any).webkitAudioContext;
        audioCtx = new AudioCtxClass();
        audioCtxRef.current = audioCtx;
      }
      if (audioCtx.state === "suspended") {
        audioCtx!.resume();
      }

      const osc = audioCtx!.createOscillator();
      const gainNode = audioCtx!.createGain();

      osc.type = "sine";
      // High-pitched woodblock click for accent beat, mid-pitched for non-accent
      osc.frequency.setValueAtTime(isFirstBeat ? 1000 : 600, audioCtx!.currentTime);

      gainNode.gain.setValueAtTime(0, audioCtx!.currentTime);
      gainNode.gain.linearRampToValueAtTime(0.12, audioCtx!.currentTime + 0.005);
      gainNode.gain.exponentialRampToValueAtTime(0.001, audioCtx!.currentTime + 0.08);

      osc.connect(gainNode);
      gainNode.connect(audioCtx!.destination);
      osc.start();
      osc.stop(audioCtx!.currentTime + 0.1);
    } catch (err) {
      console.warn("Metronome sound failed:", err);
    }
  };

  // Manage Metronome ticking
  useEffect(() => {
    if (isMetronomePlaying) {
      metronomeBeatRef.current = 0;
      setMetronomeBeat(0);
      
      const intervalMs = (60 / metronomeBpm) * 1000;
      
      // Initial tick
      playMetronomeClick(true);
      
      metronomeTimerRef.current = setInterval(() => {
        metronomeBeatRef.current = (metronomeBeatRef.current + 1) % 4;
        setMetronomeBeat(metronomeBeatRef.current);
        playMetronomeClick(metronomeBeatRef.current === 0);
      }, intervalMs);
    } else {
      if (metronomeTimerRef.current) {
        clearInterval(metronomeTimerRef.current);
      }
    }
    return () => {
      if (metronomeTimerRef.current) {
        clearInterval(metronomeTimerRef.current);
      }
    };
  }, [isMetronomePlaying, metronomeBpm]);

  const handleTapTempo = () => {
    const now = performance.now();
    const newTaps = [...tapTimes, now].filter(t => now - t < 2500); // keep within 2.5s
    setTapTimes(newTaps);

    if (newTaps.length >= 2) {
      const intervals = [];
      for (let i = 1; i < newTaps.length; i++) {
        intervals.push(newTaps[i] - newTaps[i - 1]);
      }
      const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
      const bpm = Math.round(60000 / avgInterval);
      if (bpm >= 40 && bpm <= 240) {
        setMetronomeBpm(bpm);
      }
    }
  };

  // Smoothing filters state trackers
  const lastFreqRef = useRef<number>(-1);
  const lastCentsRef = useRef<number>(0);
  const alphaRef = useRef<number>(0.35);

  // Auto-targeting / strike-locking trackers for pro double-tap string targeting
  const lastPluckedStringRef = useRef<number | null>(null);
  const lastPluckTimestampRef = useRef<number>(0);
  const isPluckActiveRef = useRef<boolean>(false);

  // Sync alpha setting
  useEffect(() => {
    alphaRef.current = selectedPreset.alpha;
  }, [selectedPreset]);

  // Click-away listener for custom dropdown managers
  const [isTuningDropdownOpen, setIsTuningDropdownOpen] = useState<boolean>(false);
  const tuningDropdownRef = useRef<HTMLDivElement | null>(null);
  const modusDropdownRef = useRef<HTMLDivElement | null>(null);
  const displayDropdownRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        modusDropdownRef.current && 
        !modusDropdownRef.current.contains(event.target as Node)
      ) {
        setIsModusDropdownOpen(false);
      }
      if (
        displayDropdownRef.current && 
        !displayDropdownRef.current.contains(event.target as Node)
      ) {
        setIsDisplayDropdownOpen(false);
      }
      if (
        tuningDropdownRef.current && 
        !tuningDropdownRef.current.contains(event.target as Node)
      ) {
        setIsTuningDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  // Audio synthesis reference trackers
  const activeOscillatorRef = useRef<OscillatorNode | null>(null);
  const activeGainRef = useRef<GainNode | null>(null);
  const playTimeoutRef = useRef<number | null>(null);
  const [playingStringNum, setPlayingStringNum] = useState<number | null>(null);

  // Mobile screensaver / sleep-timer state (configured to exactly 99 seconds)
  const [isDimmed, setIsDimmed] = useState<boolean>(false);
  const wakeLockRef = useRef<any>(null);
  const lastActiveRef2 = useRef<number>(Date.now());

  // Request Wake Lock to keep screen awake on mobile device
  const requestWakeLock = async () => {
    if ('wakeLock' in navigator) {
      try {
        wakeLockRef.current = await (navigator as any).wakeLock.request('screen');
      } catch (err) {
        // Ignored safe fallback
      }
    }
  };

  // Releasable reference to Wake Lock
  const releaseWakeLock = async () => {
    if (wakeLockRef.current) {
      try {
        await wakeLockRef.current.release();
        wakeLockRef.current = null;
      } catch (err) {}
    }
  };

  // Resets the inactivity countdown timer
  const resetInactivityTimer = () => {
    lastActiveRef2.current = Date.now();
    if (isDimmed) {
      setIsDimmed(false);
      requestWakeLock();
    }
  };

  // Automatically reset the idle state whenever active guitar signal is detected
  useEffect(() => {
    if (tuningData.hasSignal) {
      lastActiveRef2.current = Date.now();
      if (isDimmed) {
        setIsDimmed(false);
        requestWakeLock();
      }
    }
  }, [tuningData.hasSignal, isDimmed]);

  // Combined master interval checking for 99s sleep/dim behavior + Wake Lock binders
  useEffect(() => {
    requestWakeLock();

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        requestWakeLock();
        lastActiveRef2.current = Date.now();
      } else {
        releaseWakeLock();
      }
    };

    const handleInteraction = () => {
      resetInactivityTimer();
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    document.addEventListener('click', handleInteraction);
    document.addEventListener('touchstart', handleInteraction, { passive: true });
    document.addEventListener('mousemove', handleInteraction, { passive: true });
    document.addEventListener('keydown', handleInteraction);

    // Track active/inactive elapsed time in milliseconds (99 seconds limit)
    const checkInterval = setInterval(() => {
      const elapsed = Date.now() - lastActiveRef2.current;
      if (elapsed >= 99000) {
        if (!isDimmed) {
          setIsDimmed(true);
          releaseWakeLock();
        }
      }
    }, 1000);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      document.removeEventListener('click', handleInteraction);
      document.removeEventListener('touchstart', handleInteraction);
      document.removeEventListener('mousemove', handleInteraction);
      document.removeEventListener('keydown', handleInteraction);
      clearInterval(checkInterval);
      releaseWakeLock();
      
      // Stop scale playing on component exit
      if (scalePlayTimeoutRef.current) {
        clearTimeout(scalePlayTimeoutRef.current);
      }
    };
  }, [isDimmed]);

  const stopReferencePitch = () => {
    if (playTimeoutRef.current) {
      clearTimeout(playTimeoutRef.current);
      playTimeoutRef.current = null;
    }

    if (activeGainRef.current && audioCtxRef.current) {
      try {
        const now = audioCtxRef.current.currentTime;
        activeGainRef.current.gain.cancelScheduledValues(now);
        activeGainRef.current.gain.setValueAtTime(activeGainRef.current.gain.value, now);
        // Exponential ramp to 0 to avoid audio clicks/pops
        activeGainRef.current.gain.exponentialRampToValueAtTime(0.0001, now + 0.1);
        
        const osc = activeOscillatorRef.current;
        setTimeout(() => {
          try {
            osc?.stop();
            osc?.disconnect();
          } catch (e) {}
        }, 120);
      } catch (e) {}
      activeOscillatorRef.current = null;
      activeGainRef.current = null;
    }
    setPlayingStringNum(null);
  };

  const playReferencePitch = (freq: number, stringNum: number) => {
    // If we're already playing this string, toggle it off
    if (playingStringNum === stringNum) {
      stopReferencePitch();
      return;
    }

    // Stop active sound playback
    stopReferencePitch();

    try {
      let audioCtx = audioCtxRef.current;
      if (!audioCtx || audioCtx.state === "closed") {
        const AudioCtxClass = window.AudioContext || (window as any).webkitAudioContext;
        audioCtx = new AudioCtxClass();
        audioCtxRef.current = audioCtx;
      }

      if (audioCtx.state === "suspended") {
        audioCtx.resume();
      }

      const osc = audioCtx.createOscillator();
      const gainNode = audioCtx.createGain();

      // Triangle waves yield a warm, plucky wooden acoustic reference tone
      osc.type = "triangle";
      osc.frequency.setValueAtTime(freq, audioCtx.currentTime);

      // Continuous drone check versus simple plucky fade
      gainNode.gain.setValueAtTime(0, audioCtx.currentTime);
      if (isContinuousReference) {
        // Sustaining drone note
        gainNode.gain.linearRampToValueAtTime(0.15, audioCtx.currentTime + 0.08);
      } else {
        // Create a nice pluck-and-fade envelope
        gainNode.gain.linearRampToValueAtTime(0.22, audioCtx.currentTime + 0.08); // onset pluck
        gainNode.gain.exponentialRampToValueAtTime(0.005, audioCtx.currentTime + 3.0); // smooth decay
      }

      osc.connect(gainNode);
      gainNode.connect(audioCtx.destination);

      osc.start();

      activeOscillatorRef.current = osc;
      activeGainRef.current = gainNode;
      setPlayingStringNum(stringNum);

      // Automatic sound termination offset (only if not running a continuous drone)
      if (!isContinuousReference) {
        playTimeoutRef.current = window.setTimeout(() => {
          stopReferencePitch();
        }, 3000);
      }

    } catch (err) {
      console.error("Synthesizer failed:", err);
    }
  };

  const playNote = (stringIdx: number, fret: number) => {
    try {
      let audioCtx = audioCtxRef.current;
      if (!audioCtx || audioCtx.state === "closed") {
        const AudioCtxClass = window.AudioContext || (window as any).webkitAudioContext;
        audioCtx = new AudioCtxClass();
        audioCtxRef.current = audioCtx;
      }

      if (audioCtx.state === "suspended") {
        audioCtx.resume();
      }

      const stringsCopy = [...tunedGuitarStrings].reverse(); // from String 6 (idx 0) to 1 (idx 5)
      const str = stringsCopy[stringIdx];
      if (!str) return;
      const freq = str.frequency * Math.pow(2, fret / 12);

      const osc = audioCtx.createOscillator();
      const gainNode = audioCtx.createGain();

      osc.type = "triangle";
      osc.frequency.setValueAtTime(freq, audioCtx.currentTime);

      gainNode.gain.setValueAtTime(0, audioCtx.currentTime);
      gainNode.gain.linearRampToValueAtTime(0.20, audioCtx.currentTime + 0.015);
      gainNode.gain.exponentialRampToValueAtTime(0.005, audioCtx.currentTime + 1.2);

      osc.connect(gainNode);
      gainNode.connect(audioCtx.destination);

      osc.start();
      osc.stop(audioCtx.currentTime + 1.4);
    } catch (err) {
      console.warn("Failed to play note:", err);
    }
  };

  const stopScaleSequence = () => {
    if (scalePlayTimeoutRef.current) {
      clearTimeout(scalePlayTimeoutRef.current);
      scalePlayTimeoutRef.current = null;
    }
    setIsScalePlaying(false);
  };

  const playPentatonicSequence = () => {
    stopScaleSequence();
    setIsScalePlaying(true);

    const openStrings = [0, 5, 10, 15, 19, 24]; // corresponding to strings 6 down to 1
    const rootSemitone = KEY_SEMITONES[pentatonicKey] ?? 5;

    // Retrieve active scale configuration
    const activeScaleChord = generatePentatonicChord(pentatonicKey, pentatonicType, pentatonicShape);
    
    // Collect all valid scale pitches in range
    const noteInstances: { stringIdx: number; fret: number; pitch: number }[] = [];
    
    if (activeScaleChord.multiNotes) {
      activeScaleChord.multiNotes.forEach((m) => {
        m.frets.forEach((f) => {
          const openPitch = openStrings[m.stringIdx];
          const absolutePitch = openPitch + f;
          noteInstances.push({
            stringIdx: m.stringIdx,
            fret: f,
            pitch: absolutePitch
          });
        });
      });
    }

    // Sort ascending by frequency / pitch
    noteInstances.sort((a, b) => a.pitch - b.pitch);

    // Filter unique pitch frequencies to avoid playing duplicated pitches simultaneously
    const uniqueNotes: typeof noteInstances = [];
    const seenPitches = new Set<number>();
    for (const note of noteInstances) {
      if (!seenPitches.has(note.pitch)) {
        seenPitches.add(note.pitch);
        uniqueNotes.push(note);
      }
    }

    if (uniqueNotes.length === 0) {
      setIsScalePlaying(false);
      return;
    }

    let currentIndex = 0;
    const playNext = () => {
      if (currentIndex >= uniqueNotes.length) {
        setIsScalePlaying(false);
        return;
      }
      const item = uniqueNotes[currentIndex];
      playNote(item.stringIdx, item.fret);
      currentIndex++;
      scalePlayTimeoutRef.current = setTimeout(playNext, 340); // relaxed rhythmic timing
    };

    playNext();
  };

  const playChord = (chord: Chord) => {
    try {
      let audioCtx = audioCtxRef.current;
      if (!audioCtx || audioCtx.state === "closed") {
        const AudioCtxClass = window.AudioContext || (window as any).webkitAudioContext;
        audioCtx = new AudioCtxClass();
        audioCtxRef.current = audioCtx;
      }

      if (audioCtx.state === "suspended") {
        audioCtx.resume();
      }

      // Stop any single active reference tone
      stopReferencePitch();

      const stringsCopy = [...tunedGuitarStrings].reverse(); // from String 6 to 1

      if (chord.multiNotes) {
        // Play as a beautiful rising scale run!
        let noteCounter = 0;
        chord.multiNotes.forEach((mNotes) => {
          const str = stringsCopy[mNotes.stringIdx];
          mNotes.frets.forEach((fret) => {
            const freq = str.frequency * Math.pow(2, fret / 12);
            const staggerSeconds = 0.22 * noteCounter; // Melodic scale stagger (220ms per note)
            const playTime = audioCtx!.currentTime + staggerSeconds;

            const osc = audioCtx!.createOscillator();
            const gainNode = audioCtx!.createGain();

            osc.type = "triangle";
            osc.frequency.setValueAtTime(freq, playTime);

            gainNode.gain.setValueAtTime(0, audioCtx!.currentTime);
            gainNode.gain.setValueAtTime(0, playTime);
            gainNode.gain.linearRampToValueAtTime(0.18, playTime + 0.04);
            gainNode.gain.exponentialRampToValueAtTime(0.005, playTime + 1.2); // slightly shorter decay for fast runs

            osc.connect(gainNode);
            gainNode.connect(audioCtx!.destination);

            osc.start(playTime);
            osc.stop(playTime + 1.4);
            noteCounter++;
          });
        });
      } else {
        // Standard chord strum
        stringsCopy.forEach((str, index) => {
          const fret = chord.frets[index];
          if (fret === "X") return;

          // Calculate frequency
          const freq = str.frequency * Math.pow(2, Number(fret) / 12);
          const staggerSeconds = 0.055 * index; // beautiful, relaxed strum cadence

          const playTime = audioCtx!.currentTime + staggerSeconds;

          const osc = audioCtx!.createOscillator();
          const gainNode = audioCtx!.createGain();

          // Let's use clean "triangle" oscillators for warm resonance
          osc.type = "triangle";
          osc.frequency.setValueAtTime(freq, playTime);

          gainNode.gain.setValueAtTime(0, audioCtx!.currentTime);
          gainNode.gain.setValueAtTime(0, playTime);
          gainNode.gain.linearRampToValueAtTime(0.18, playTime + 0.06); // pluck onset
          gainNode.gain.exponentialRampToValueAtTime(0.005, playTime + 2.5); // long organic acoustic sustain

          osc.connect(gainNode);
          gainNode.connect(audioCtx!.destination);

          osc.start(playTime);

          // Schedule stopping to conserve resources
          osc.stop(playTime + 2.8);
        });
      }
    } catch (err) {
      console.error("Failed to synthesize strum:", err);
    }
  };

  // Request microphone on component mount automatically (user request)
  useEffect(() => {
    startTuningEngine("auto");
    return () => {
      stopTuningEngine();
      stopReferencePitch();
    };
  }, []);

  // Stop everything
  const stopTuningEngine = () => {
    stopReferencePitch();
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    if (sourceRef.current) {
      sourceRef.current.disconnect();
      sourceRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (audioCtxRef.current && audioCtxRef.current.state !== "closed") {
      audioCtxRef.current.close();
      audioCtxRef.current = null;
    }
    setIsListening(false);
  };

  // Start the Audio API and detect pitches
  const startTuningEngine = async (triggerType: "auto" | "manual" | any = "manual") => {
    // Reset state first
    setErrorMsg("");
    stopTuningEngine();

    try {
      // 1. Get user media stream
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error("Dein Browser unterstützt keinen Mikrofonzugriff in diesem Kontext (z. B. wegen Sicherheits-Einschränkungen im iFrame). Du kannst die App trotzdem im manuellen Modus nutzen!");
      }

      // We disable autoGainControl, noiseSuppression, and echoCancellation for instruments.
      // Filtering algorithms designed for speech completely mangle the raw harmonic contents
      // of string strikes. Disabling them is essential for pro accuracy.
      const constraints = {
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
        },
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;
      setPermissionState("granted");
      setBypassPermissionOverlay(false);

      // 2. Initialize Web Audio Context
      const AudioCtxClass = window.AudioContext || (window as any).webkitAudioContext;
      const audioCtx = new AudioCtxClass();
      if (audioCtx.state === "suspended") {
        await audioCtx.resume();
      }
      audioCtxRef.current = audioCtx;

      // 3. Create Analyser Node
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 2048; // Excellent time resolution for guitar standard tuning range
      analyserRef.current = analyser;

      // 4. Bind source
      const source = audioCtx.createMediaStreamSource(stream);
      source.connect(analyser);
      sourceRef.current = source;

      setIsListening(true);

      // Start processing samples
      const buffer = new Float32Array(analyser.fftSize);
      
      const processTick = () => {
        if (!analyserRef.current) return;
        
        if (typeof analyserRef.current.getFloat32TimeDomainData === "function") {
          analyserRef.current.getFloat32TimeDomainData(buffer);
        } else if (typeof analyserRef.current.getByteTimeDomainData === "function") {
          const byteBuffer = new Uint8Array(buffer.length);
          analyserRef.current.getByteTimeDomainData(byteBuffer);
          for (let i = 0; i < buffer.length; i++) {
            buffer[i] = (byteBuffer[i] - 128) / 128;
          }
        } else {
          // Absolute fallback if no time domain function is available
          buffer.fill(0);
        }

        // Calculate root mean square of signal strength
        let sumSq = 0;
        for (let i = 0; i < buffer.length; i++) {
          sumSq += buffer[i] * buffer[i];
        }
        const rms = Math.sqrt(sumSq / buffer.length);

        const activeInst = selectedInstrumentIdRef.current;
        const minFreq = activeInst === "ukulele" ? 180 : 70;
        const maxFreq = activeInst === "ukulele" ? 520 : (activeInst === "guitar12" ? 450 : 385);
        const freq = detectGuitarPitch(buffer, audioCtx.sampleRate, minFreq, maxFreq);

        // Amplitude-based Pluck Onset Detection for Auto-Lock tracking
        if (freq > 0 && rms > 0.008) {
          const actualClosestRes = findClosestGuitarString(freq, referenceA4Ref.current, tunedGuitarStringsRef.current);
          const actualClosestStr = actualClosestRes.closestString;

          if (!isPluckActiveRef.current) {
            isPluckActiveRef.current = true;
            const now = Date.now();
            const prevPlucked = lastPluckedStringRef.current;
            const timeDiff = now - lastPluckTimestampRef.current;

            // If same standard string is hit 2 times in a row within 2.8 seconds (but not immediate jitter < 150ms)
            if (actualClosestStr && prevPlucked === actualClosestStr.number && timeDiff > 150 && timeDiff < 2800) {
              setTargetStringLock(actualClosestStr.number);
            }

            if (actualClosestStr) {
              lastPluckedStringRef.current = actualClosestStr.number;
              lastPluckTimestampRef.current = now;
            }
          }
        } else if (rms < 0.004) {
          isPluckActiveRef.current = false;
        }

        if (freq > 0 && rms > 0.004) {
          // Identify closest string or use manual lock
          let closestStr: GuitarString;
          let cents: number;

          const currentLock = targetStringLockRef.current;
          if (currentLock !== null) {
            const lockedStr = tunedGuitarStringsRef.current.find(s => s.number === currentLock);
            if (lockedStr) {
              closestStr = lockedStr;
              cents = 1200 * Math.log2(freq / lockedStr.frequency);
            } else {
              const res = findClosestGuitarString(freq, referenceA4Ref.current, tunedGuitarStringsRef.current);
              closestStr = res.closestString;
              cents = res.centsDiff;
            }
          } else {
            const res = findClosestGuitarString(freq, referenceA4Ref.current, tunedGuitarStringsRef.current);
            closestStr = res.closestString;
            cents = res.centsDiff;
          }

          // Apply specialized exponential smoothing (EMA) for rock-solid visual feedback
          const alpha = alphaRef.current;
          let finalFreq = freq;
          let finalCents = cents;

          // Only smooth if we are targeting the same pitch vicinity, preventing transition lag
          if (lastFreqRef.current > 0 && Math.abs(freq - lastFreqRef.current) < 20) {
            finalFreq = lastFreqRef.current * (1 - alpha) + freq * alpha;
          }
          lastFreqRef.current = finalFreq;

          if (Math.abs(cents - lastCentsRef.current) < 30) {
            finalCents = lastCentsRef.current * (1 - alpha) + cents * alpha;
          }
          lastCentsRef.current = finalCents;

          setTuningData({
            frequency: finalFreq,
            closestString: closestStr,
            centsDiff: finalCents,
            hasSignal: true,
            rmsValue: rms,
          });
          setLastStrum({
            cents: finalCents,
            closestString: closestStr,
            timestamp: Date.now(),
          });
        } else {
          // No stable pitch detected or amplitude is below noise threshold
          setTuningData((prev) => ({
            ...prev,
            hasSignal: false,
            rmsValue: rms,
          }));
          
          // Gently let the last frequency decay to avoid visual jumping
          lastFreqRef.current = -1;
        }

        animationFrameRef.current = requestAnimationFrame(processTick);
      };

      animationFrameRef.current = requestAnimationFrame(processTick);

    } catch (err: any) {
      console.warn("Microphone access denied or audio issue", err);
      setPermissionState("denied");
      
      let friendlyError = "Lausch-Erlaubnis verweigert! Bitte gib uns das Mikrofon im Browser frei, sonst können wir deine Saiten-Vibrationen nicht erschnüffeln.";
      if (err.name === "NotAllowedError" || err.name === "PermissionDeniedError" || err.message?.toLowerCase().includes("denied")) {
        friendlyError = "Mikrofonzugriff blockiert! Bitte aktiviere den Zugriff in deinen Browsereinstellungen für diese Website, um das Stimmgerät voll zu nutzen. Oder wechsle in den unten angebotenen manuellen Modus.";
      } else if (err.message) {
        friendlyError = err.message;
      }
      
      setErrorMsg(friendlyError);

      // Always automatically bypass the fullscreen blocker overlay on any error/denial,
      // so the user can immediately use manual mode, reference string generator, and chord library!
      setBypassPermissionOverlay(true);
    }
  };

  const { frequency, closestString, centsDiff, hasSignal } = tuningData;
  const isInTune = hasSignal && Math.abs(centsDiff) <= 3; // Absolute master precision: within 3 cents

  // Normalized translation offset for standard needle UI (-50 cents to +50 cents mapping to 0% to 100%)
  const clampedCents = Math.max(-50, Math.min(50, centsDiff));
  const needlePercentage = ((clampedCents + 50) / 100) * 100;

  // Chord starting fret and category filtering calculations
  const allFretsList: number[] = [];
  if (selectedChord) {
    selectedChord.frets.forEach((f) => {
      if (typeof f === "number" && f > 0) allFretsList.push(f);
    });
    if (selectedChord.multiNotes) {
      selectedChord.multiNotes.forEach((m) => {
        m.frets.forEach((f) => {
          if (f > 0) allFretsList.push(f);
        });
      });
    }
  }
  const maxFret = allFretsList.length > 0 ? Math.max(...allFretsList) : 0;
  const startFret = maxFret > 5 ? Math.min(...allFretsList) : 1;
  const showNut = startFret === 1;
  const filteredChords = [...(chordFilter === "all" 
    ? COMMON_CHORDS 
    : COMMON_CHORDS.filter(c => c.tags.includes(chordFilter)))]
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: "base" }));

  // Helper to render the LED segment metric (Horizontal Tuning Bar)
  const renderHorizontalTuningBar = () => {
    const totalTiles = 29;
    const activeIdx = hasSignal ? Math.round(((clampedCents + 50) / 100) * (totalTiles - 1)) : -1;

    // Calculate last strum afterglow index & opacity
    let lastStrumIdx = -1;
    let lastStrumOpacity = 0;
    let isLastStrumInTune = false;

    if (lastStrum) {
      const elapsed = Date.now() - lastStrum.timestamp;
      lastStrumOpacity = Math.max(0, Math.min(1, 1 - (elapsed - 1000) / 3000));
      
      if (lastStrumOpacity > 0) {
        const lastClampedCents = Math.max(-50, Math.min(50, lastStrum.cents));
        lastStrumIdx = Math.round(((lastClampedCents + 50) / 100) * (totalTiles - 1));
        isLastStrumInTune = Math.abs(lastStrum.cents) <= 3;
      }
    }

    return (
      <div className="relative h-20 flex flex-col justify-end w-full max-w-xl mx-auto px-1 animate-fade-in">
        {/* Scale Labels */}
        <div className="w-full flex justify-between text-[9px] font-mono text-white/40 tracking-tighter uppercase px-1 mb-1.5">
          <span>-50 Cent (Schlaff)</span>
          <span>-25</span>
          <span className={`transition-all duration-300 font-bold ${
            hasSignal && isInTune ? "text-green-400 font-black shadow-sm" : "text-white/60"
          }`}>
            Passt!
          </span>
          <span>+25</span>
          <span>+50 Cent (Stramm)</span>
        </div>
        
        {/* Interactive Bar Grid container - Styled as vertical LED segments */}
        <div className="w-full h-10 bg-[#0A0A0A] rounded-md flex items-center justify-between gap-[3px] px-2 border border-white/10 relative">
          {Array.from({ length: totalTiles }).map((_, i) => {
            const isActive = hasSignal && activeIdx === i;
            const distance = hasSignal ? Math.abs(i - activeIdx) : -1;
            const isNear = distance === 1;

            const isLastStrumActive = !hasSignal && lastStrumIdx === i && lastStrumOpacity > 0;
            const isLastStrumNear = !hasSignal && Math.abs(i - lastStrumIdx) === 1 && lastStrumOpacity > 0;

            // Determine base LED scale colors (dim state)
            let baseColor = "bg-red-500/10";
            if (i >= 13 && i <= 15) {
              baseColor = "bg-green-500/15";
            } else if ((i >= 11 && i <= 12) || (i >= 16 && i <= 17)) {
              baseColor = "bg-yellow-500/10";
            }

            // Determine brightly lit active state colors
            let litColor = "bg-red-500 shadow-[0_0_12px_rgba(239,68,68,0.85)]";
            if (i >= 13 && i <= 15) {
              litColor = "bg-green-400 shadow-[0_0_16px_rgba(34,197,94,0.95)]";
            } else if ((i >= 11 && i <= 12) || (i >= 16 && i <= 17)) {
              litColor = "bg-yellow-400 shadow-[0_0_14px_rgba(234,179,8,0.9)]";
            }

            // Assign segment heights
            let heightClass = "h-[45%]";
            if (i === 14) {
              heightClass = "h-[75%]"; // absolute center tick is taller
            } else if (i === 0 || i === 28) {
              heightClass = "h-[65%]"; // outer boundary ticks are moderately tall
            } else if (i === 7 || i === 21) {
              heightClass = "h-[55%]"; // intermediate ticks
            }

            // Apply active glow and sizing modifications
            let finalStyle = baseColor;
            let inlineStyle: CSSProperties = {};

            if (isActive) {
              finalStyle = litColor;
              heightClass = "h-[90%]";
            } else if (isNear) {
              let nearColor = "bg-red-500/40";
              if (i >= 13 && i <= 15) {
                nearColor = "bg-green-500/40";
              } else if ((i >= 11 && i <= 12) || (i >= 16 && i <= 17)) {
                nearColor = "bg-yellow-500/40";
              }
              finalStyle = nearColor;
              heightClass = "h-[70%]";
            } else if (isLastStrumActive) {
              let afterglowColor = isLastStrumInTune 
                ? "bg-green-400/90 shadow-[0_0_16px_rgba(34,197,94,0.8)] border border-green-300" 
                : "bg-red-500/90 shadow-[0_0_12px_rgba(239,68,68,0.7)] border border-red-300";
              if ((lastStrumIdx >= 11 && lastStrumIdx <= 12) || (lastStrumIdx >= 16 && lastStrumIdx <= 17)) {
                afterglowColor = "bg-yellow-400/90 shadow-[0_0_14px_rgba(234,179,8,0.7)] border border-yellow-300";
              }
              finalStyle = afterglowColor;
              heightClass = "h-[90%]";
              inlineStyle = { opacity: lastStrumOpacity };
            } else if (isLastStrumNear) {
              let afterglowNearColor = isLastStrumInTune 
                ? "bg-green-500/40" 
                : "bg-red-500/40";
              if ((lastStrumIdx >= 11 && lastStrumIdx <= 12) || (lastStrumIdx >= 16 && lastStrumIdx <= 17)) {
                afterglowNearColor = "bg-yellow-500/40";
              }
              finalStyle = afterglowNearColor;
              heightClass = "h-[70%]";
              inlineStyle = { opacity: lastStrumOpacity };
            }

            return (
              <div
                key={i}
                className={`flex-1 rounded-sm transition-all duration-75 ease-out ${finalStyle} ${heightClass}`}
                style={inlineStyle}
              />
            );
          })}
        </div>
      </div>
    );
  };

  // Helper to render the interactive SVG Fretboard Chord Diagram
  const renderFretboardGraphic = () => {
    return (
      <div className="shrink-0 flex flex-col items-center justify-center gap-2.5">
        <div 
          id="chord-fretboard-graphic" 
          className="shrink-0 flex items-center justify-center p-2.5 bg-black/60 rounded-xl border border-white/10 shadow-inner w-[160px] h-[155px] transition-transform duration-300 ease-in-out"
          style={{ transform: `rotate(${fretboardRotation}deg)` }}
        >
          <svg viewBox="0 0 140 135" className="w-[full] h-full text-white/80 font-sans pointer-events-none">
            {/* String names above the frets */}
            {(() => {
              const notes = ["E2", "A2", "D3", "G3", "H3", "E4"];
              return notes.map((note, i) => {
                const displayStringIdx = isNeckFlipped ? (5 - i) : i;
                return (
                  <text
                    key={i}
                    x={20 + i * 20}
                    y={11}
                    textAnchor="middle"
                    className="font-mono text-[8.5px] fill-white/30 font-bold"
                  >
                    {notes[displayStringIdx]}
                  </text>
                );
              });
            })()}

            {/* Fretboard Grid Lines */}
            {/* Vertical Strings with realistic thickness graduation */}
            {Array.from({ length: 6 }).map((_, i) => {
              const displayStringIdx = isNeckFlipped ? (5 - i) : i;
              const thickness = [2.5, 2.0, 1.6, 1.2, 0.9, 0.6][displayStringIdx];
              return (
                <line
                  key={`string-${i}`}
                  x1={20 + i * 20}
                  y1={25}
                  x2={20 + i * 20}
                  y2={125}
                  className="stroke-zinc-600"
                  strokeWidth={thickness}
                />
              );
            })}

            {/* Nut (Thickened Fret 0 line) or top single fret boundary */}
            {showNut ? (
              <line
                x1={18}
                y1={25}
                x2={122}
                y2={25}
                className="stroke-amber-400"
                strokeWidth="3.5"
              />
            ) : (
              <line
                x1={20}
                y1={25}
                x2={120}
                y2={25}
                className="stroke-zinc-700"
                strokeWidth="1.5"
              />
            )}

            {/* Horizontal Frets 1 to 5 */}
            {Array.from({ length: 5 }).map((_, i) => (
              <line
                key={`fret-${i}`}
                x1={20}
                y1={25 + (i + 1) * 20}
                x2={120}
                y2={25 + (i + 1) * 20}
                className="stroke-zinc-700"
                strokeWidth="1"
              />
            ))}

            {/* Fret number labels on the left margin */}
            {Array.from({ length: 5 }).map((_, i) => (
              <text
                key={`fret-label-${i}`}
                x={8}
                y={35 + i * 20}
                textAnchor="middle"
                className="font-mono text-[7.5px] fill-white/20 font-bold"
              >
                {startFret + i}
              </text>
            ))}

            {/* Transparent background guide for Barré chord block (Fingers) */}
            {selectedChord && selectedChord.barre && (() => {
              const { fret, fromStringIdx, toStringIdx } = selectedChord.barre;
              const relativeFret = fret - startFret + 1;
              const yPos = 25 + (relativeFret - 0.5) * 20;
              const col1 = isNeckFlipped ? (5 - toStringIdx) : fromStringIdx;
              const col2 = isNeckFlipped ? (5 - fromStringIdx) : toStringIdx;
              const x1 = 20 + col1 * 20;
              const w = (col2 - col1) * 20;
              return (
                <rect
                  key="barre-indicator"
                  x={x1 - 4}
                  y={yPos - 5}
                  width={w + 8}
                  height={10}
                  rx={5}
                  className="fill-amber-500/70 stroke-amber-400/40 stroke-1"
                />
              );
            })()}

            {/* Open, Pressed or Muted Indicators */}
            {!selectedChord ? (
              // Free Listening dynamic representation on strings
              Array.from({ length: 6 }).map((_, i) => {
                const xPos = 20 + i * 20;
                const currentStrNum = isNeckFlipped ? (i + 1) : (6 - i);
                const isVibrating = hasSignal && closestString?.number === currentStrNum;

                return (
                  <g key={`free-listening-string-graphic-${i}`}>
                    <circle
                      cx={xPos}
                      cy={18}
                      r={isVibrating ? 5.5 : 3}
                      className={`transition-all duration-300 ${
                        isVibrating 
                          ? isInTune 
                            ? "fill-green-400 stroke-green-300 stroke-[1.5] drop-shadow-[0_0_8px_#22c55e]" 
                            : "fill-yellow-400 stroke-yellow-300 stroke-[1.5] drop-shadow-[0_0_8px_#eab308]"
                          : "fill-none stroke-white/10 stroke-[1.2]"
                      }`}
                    />
                    {isVibrating && (
                      <>
                        {/* Live wire glow effect */}
                        <line
                          x1={xPos}
                          y1={25}
                          x2={xPos}
                          y2={125}
                          className={`stroke-[2.5px] ${isInTune ? "stroke-green-400/80" : "stroke-yellow-400/80 animate-pulse"}`}
                        />
                        {/* Pulse traveling down */}
                        <circle
                          cx={xPos}
                          y={55}
                          r="4.5"
                          className={`animate-ping ${isInTune ? "fill-green-400" : "fill-yellow-400"}`}
                        />
                      </>
                    )}
                  </g>
                );
              })
            ) : selectedChord.multiNotes ? (
              selectedChord.multiNotes.flatMap((mNotes) => {
                const stringIdx = mNotes.stringIdx;
                const displayStringIdx = isNeckFlipped ? (5 - stringIdx) : stringIdx;
                const xPos = 20 + displayStringIdx * 20;

                return mNotes.frets.map((fret, noteIdx) => {
                  const relativeFret = fret - startFret + 1;
                  const yPos = 25 + (relativeFret - 0.5) * 20;
                  const fingeringNum = mNotes.fingerings?.[noteIdx] || null;

                  return (
                    <g key={`scale-${stringIdx}-${fret}`}>
                      <circle
                        cx={xPos}
                        cy={yPos}
                        r="6.5"
                        className="fill-amber-500 stroke-white/20 stroke-[1]"
                      />
                      {fingeringNum && (
                        <text
                          x={xPos}
                          y={yPos + 2.5}
                          textAnchor="middle"
                          className="font-sans text-[8px] font-black fill-black"
                        >
                          {fingeringNum}
                        </text>
                      )}
                    </g>
                  );
                });
              })
            ) : (
              Array.from({ length: 6 }).map((_, i) => {
                const stringIdx = isNeckFlipped ? (5 - i) : i;
                const fret = selectedChord.frets[stringIdx];
                const xPos = 20 + i * 20;

                // Case 1: Muted string 'X'
                if (fret === "X") {
                  return (
                    <g key={`muted-${i}`}>
                      <line x1={xPos - 3} y1={15} x2={xPos + 3} y2={21} className="stroke-red-500/80 stroke-2" />
                      <line x1={xPos + 3} y1={15} x2={xPos - 3} y2={21} className="stroke-red-500/80 stroke-2" />
                    </g>
                  );
                }

                // Case 2: Open string '0' (draw a small circle at the top)
                if (fret === 0) {
                  return (
                    <circle
                      key={`open-${i}`}
                      cx={xPos}
                      cy={18}
                      r="3.5"
                      className="fill-none stroke-green-400 stroke-[1.5]"
                    />
                  );
                }

                // Case 3: Fingering/pressed fret (with starting fret calculation offsets)
                const relativeFret = Number(fret) - startFret + 1;
                const yPos = 25 + (relativeFret - 0.5) * 20;
                const isChordRoot = selectedChord.rootStringIdx !== undefined && selectedChord.rootStringIdx === stringIdx;
                const fingeringNum = isChordRoot ? "R" : (selectedChord.fingering?.[stringIdx] || null);

                // If is part of a barre chord and is on the barre fret, we can draw a ring highlights, or skip background as it already has rect
                const isPartOfBarreFret = selectedChord.barre && 
                  fret === selectedChord.barre.fret && 
                  stringIdx >= selectedChord.barre.fromStringIdx && 
                  stringIdx <= selectedChord.barre.toStringIdx;

                return (
                  <g key={`pressed-${i}`}>
                    {/* Circle backing with glow and amber theme if it is the root note */}
                    <circle
                      cx={xPos}
                      cy={yPos}
                      r={isChordRoot ? 7.5 : 6.5}
                      className={`transition-all duration-150 ${
                        isChordRoot
                          ? "fill-amber-400 stroke-amber-100 stroke-[1.5] drop-shadow-[0_0_8px_#f59e0b] scale-110"
                          : isPartOfBarreFret 
                            ? "fill-amber-500/90 stroke-zinc-900 stroke-[1]" 
                            : "fill-amber-500 stroke-white/20 stroke-[1]"
                      }`}
                    />
                    {fingeringNum && (
                      <text
                        x={xPos}
                        y={yPos + 2.5}
                        textAnchor="middle"
                        className={`font-sans text-[8px] font-black ${isChordRoot ? "fill-neutral-950 font-black" : "fill-black"}`}
                      >
                        {fingeringNum}
                      </text>
                    )}
                  </g>
                );
              })
            )}
          </svg>
        </div>


        <button
          id="rotate-fretboard-btn"
          onClick={() => setFretboardRotation((prev) => (prev + 90) % 360)}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-neutral-950/80 hover:bg-neutral-800 border border-white/10 hover:border-white/20 rounded-lg text-[9.3px] uppercase tracking-wider font-extrabold text-[#f59e0b] hover:text-[#fbbf24] transition-all cursor-pointer select-none active:scale-95 shadow-lg group"
          title="Diagramm um 90 Grad rotieren"
        >
          <RotateCw size={11} className="transition-transform group-hover:rotate-45" />
          <span>Drehen 90°</span>
        </button>
      </div>
    );
  };

  const renderHorizontalFullNeck = () => {
    const scaleIntervals = pentatonicType === "minor" ? [0, 3, 5, 7, 10] : [0, 2, 4, 7, 9];
    const rootSemitone = KEY_SEMITONES[pentatonicKey] ?? 5;

    return (
      <div className="flex flex-col items-center gap-3 w-full animate-fade-in select-none">
        {/* Control bar */}
        <div className="flex items-center justify-between w-full px-2 gap-2 flex-wrap mb-1">
          <div className="flex flex-col text-left min-w-0 flex-1">
            <span className="text-[10px] uppercase font-mono font-black text-amber-500 tracking-wider">Ganzes Griffbrett (Master)</span>
            <span className="text-[8.5px] text-zinc-400 truncate tracking-tight">{pentatonicKey} {pentatonicType === "minor" ? "Moll" : "Dur"}-Pentatonik [Fret 0-17]</span>
          </div>
          
          <div className="flex gap-1.5 shrink-0">
            <button
              onClick={() => setIsNeckFlipped(prev => !prev)}
              className={`flex items-center gap-1 px-2.5 py-1.5 border rounded-xl text-[9px] uppercase font-black transition-all cursor-pointer select-none active:scale-95 shadow-md ${
                isNeckFlipped
                  ? "bg-amber-500/20 border-amber-500/50 text-amber-300"
                  : "bg-neutral-900 hover:bg-neutral-850 border-white/10 hover:border-white/20 text-white"
              }`}
              title="Gitarrenhals vertikal spiegeln (E-Saiten vertauschen)"
            >
              <RotateCw size={10} className={`transition-transform duration-300 ${isNeckFlipped ? "rotate-180" : ""}`} />
              <span>Spiegeln {isNeckFlipped ? "Aktiv" : "180°"}</span>
            </button>
            <button
              onClick={() => setIsExtendedNeckModalOpen(true)}
              className="flex items-center gap-1 px-2.5 py-1.5 bg-neutral-900 border border-white/10 hover:border-white/20 hover:bg-neutral-850 rounded-xl text-[9px] uppercase font-black text-white transition-all cursor-pointer select-none active:scale-95 shadow-md"
              title="Große interaktive Großansicht öffnen"
            >
              <span>🔍 Großansicht</span>
            </button>
          </div>
        </div>

        {/* Fretboard viewport with horizontal scrolling wrapper */}
        <div className="w-full overflow-x-auto pb-1.5 select-none scrollbar-thin">
          <div className="relative min-w-[810px] h-[165px] bg-gradient-to-r from-neutral-950 via-[#1e130a]/80 to-neutral-500/5 rounded-xl p-3 border border-white/5 shadow-inner">
            <svg viewBox="0 0 812 145" className="w-[810px] h-[142px] font-sans">
              {/* Beautiful active scale background watermarks */}
              <g className="pointer-events-none select-none">
                <text
                  x="395"
                  y="78"
                  textAnchor="middle"
                  alignmentBaseline="middle"
                  className="font-sans font-black text-[96px] fill-amber-500/[0.05] tracking-widest uppercase transition-all duration-300"
                >
                  {pentatonicKey}
                </text>
                <text
                  x="395"
                  y="114"
                  textAnchor="middle"
                  className="font-mono font-black text-[9px] tracking-[0.25em] uppercase fill-amber-500/25"
                >
                  {pentatonicType === "minor" ? "PENTATONISCHE MOLL-SKALA" : "PENTATONISCHE DUR-SKALA"}
                </text>
              </g>

              {/* Fret Markers / Inlay dots background layer (Fret 3, 5, 7, 9, 15, 17) */}
              {[3, 5, 7, 9, 15, 17].map(fret => {
                const x = 30 + fret * 44 - 22;
                return (
                  <circle
                    key={`v-full-marker-${fret}`}
                    cx={x}
                    cy={70}
                    r={5.5}
                    className="fill-white/5 stroke-none pointer-events-none"
                  />
                );
              })}

              {/* Octave double marker at Fret 12 */}
              {(() => {
                const x = 30 + 12 * 44 - 22;
                return (
                  <g key="v-full-marker-12" className="pointer-events-none">
                    <circle cx={x} cy={45} r={4.5} className="fill-white/5 stroke-none" />
                    <circle cx={x} cy={95} r={4.5} className="fill-white/5 stroke-none" />
                  </g>
                );
              })()}

              {/* Horizontal Strings (6 of them) */}
              {[0, 1, 2, 3, 4, 5].map((sIdx) => {
                const y = 20 + sIdx * 20;
                const strokeWidths = [1.2, 1.4, 1.8, 2.0, 2.4, 3.0]; // thick low E (3.0), thin high E (1.2)
                const lineStrokeIdx = isNeckFlipped ? (5 - sIdx) : sIdx;
                return (
                  <line
                    key={`v-full-h-str-${sIdx}`}
                    x1={30}
                    y1={y}
                    x2={778}
                    y2={y}
                    className="stroke-zinc-500/35 pointer-events-none"
                    strokeWidth={strokeWidths[lineStrokeIdx]}
                  />
                );
              })}

              {/* String name labels on the left of the Nut */}
              {[0, 1, 2, 3, 4, 5].map((sIdx) => {
                const y = 20 + sIdx * 20;
                const stringIdx = isNeckFlipped ? sIdx : (5 - sIdx);
                const getStringLabelDoc = (idx: number) => {
                  switch (idx) {
                    case 0: return { name: "E", color: "fill-red-400 font-extrabold" };
                    case 1: return { name: "A", color: "fill-orange-400 font-extrabold" };
                    case 2: return { name: "D", color: "fill-yellow-400 font-extrabold" };
                    case 3: return { name: "G", color: "fill-emerald-400 font-extrabold" };
                    case 4: return { name: "H", color: "fill-blue-400 font-extrabold" };
                    case 5: return { name: "e", color: "fill-purple-400 font-extrabold" };
                    default: return { name: "", color: "fill-zinc-400" };
                  }
                };
                const doc = getStringLabelDoc(stringIdx);
                return (
                  <g key={`v-full-string-label-${sIdx}`} className="pointer-events-none select-none">
                    <rect
                      x={2}
                      y={y - 8}
                      width={20}
                      height={16}
                      rx={4}
                      className="fill-neutral-950/90 stroke stroke-zinc-700/50 stroke-[0.7]"
                    />
                    <text
                      x={12}
                      y={y + 3.5}
                      textAnchor="middle"
                      className={`font-mono text-[9px] font-black ${doc.color}`}
                    >
                      {doc.name}
                    </text>
                  </g>
                );
              })}

              {/* Vertical Frets (0 to 17) */}
              {Array.from({ length: 18 }).map((_, fIdx) => {
                const x = 30 + fIdx * 44;
                const isNut = fIdx === 0;

                const openStrings = [0, 5, 10, 15, 19, 24];
                const containsRoot = openStrings.some(openPitch => {
                  const offset = ((openPitch + fIdx - rootSemitone) % 12 + 12) % 12;
                  return offset === 0;
                });

                return (
                  <g key={`v-full-v-fret-${fIdx}`} className="pointer-events-none">
                    <line
                      x1={x}
                      y1={15}
                      x2={x}
                      y2={125}
                      className={isNut ? "stroke-amber-500/80" : "stroke-zinc-700/50"}
                      strokeWidth={isNut ? 3.5 : 1}
                    />

                    {containsRoot && fIdx > 0 && (
                      <rect
                        x={x - 30}
                        y={129}
                        width={16}
                        height={12}
                        rx={4}
                        className="fill-amber-500/15 stroke stroke-amber-500/35 stroke-[0.5]"
                      />
                    )}

                    <text
                      x={isNut ? x - 8 : x - 22}
                      y={138}
                      textAnchor="middle"
                      className={`font-mono text-[8px] font-bold ${
                        containsRoot && fIdx > 0
                          ? "fill-amber-400 font-extrabold"
                          : "fill-white/15"
                      }`}
                    >
                      {fIdx === 0 ? "Nut" : fIdx}
                    </text>
                  </g>
                );
              })}

              {/* Note bubbles */}
              {(() => {
                const openStrings = [0, 5, 10, 15, 19, 24]; // open tuning values from E2 to E4

                return [0, 1, 2, 3, 4, 5].flatMap((sIdx) => {
                  const stringIdx = isNeckFlipped ? sIdx : (5 - sIdx); // 5 matches top string (E4), 0 matches bottom string (E2)
                  const openPitch = openStrings[stringIdx];
                  const y = 20 + sIdx * 20;

                  return Array.from({ length: 18 }).map((_, fret) => {
                    const pitch = openPitch + fret;
                    const offset = ((pitch - rootSemitone) % 12 + 12) % 12;
                    const isScaleNote = scaleIntervals.includes(offset);
                    if (!isScaleNote) return null;

                    const isRoot = offset === 0;
                    const x = fret === 0 ? 15 : 30 + fret * 44 - 22;

                    return (
                      <g
                        key={`v-full-neck-note-${stringIdx}-${fret}`}
                        className="cursor-pointer group/note"
                        onClick={() => playNote(stringIdx, fret)}
                      >
                        <circle
                          cx={x}
                          cy={y}
                          r={8.5}
                          className={`transition-all duration-200 ${
                            isRoot
                              ? "fill-amber-400 stroke-amber-200 stroke-1 drop-shadow-[0_0_6px_#f59e0b] group-hover/note:scale-110"
                              : "fill-neutral-900 stroke-amber-500/80 stroke-1.5 group-hover/note:fill-amber-600 group-hover/note:scale-110"
                          }`}
                        />
                        <text
                          x={x}
                          y={y + 2.5}
                          textAnchor="middle"
                          className={`font-sans text-[7.5px] font-black transition-colors ${
                            isRoot
                              ? "fill-neutral-950 font-black"
                              : "font-mono fill-white/80 group-hover/note:fill-white"
                          }`}
                        >
                          {isRoot ? pentatonicKey : scaleIntervals.indexOf(offset) + 1}
                        </text>
                        
                        <circle
                          cx={x}
                          cy={y}
                          r={16}
                          className="fill-none stroke-amber-500/20 stroke-1 scale-0 transition-transform group-hover/note:scale-100 duration-300 pointer-events-none"
                        />
                      </g>
                    );
                  });
                });
              })()}
            </svg>
          </div>
        </div>
      </div>
    );
  };


  // Render function for the gorgeous, reactive Chromatic Tone Wheel (rendered as a horizontal sliding electricity meter tape)
  const renderToneWheel = () => {
    const CHROMATIC_SCALE = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "H"];
    const GUITAR_NOTES_SET = new Set(["E", "A", "D", "G", "H"]); // standard guitar notes in German

    let activeNoteName: string | null = null;
    let activeCents = 0;
    let displayOctave: number | null = null;

    if (hasSignal && frequency > 0) {
      const chrom = findClosestChromaticNote(frequency, referenceA4);
      activeNoteName = chrom.note;
      activeCents = chrom.centsDiff;
      displayOctave = chrom.octave;
    } else if (playingStringNum !== null) {
      const playingStr = tunedGuitarStrings.find(s => s.number === playingStringNum);
      if (playingStr) {
        activeNoteName = playingStr.note;
        activeCents = 0;
        // Parse octave from pitch (e.g. "E2" -> 2)
        displayOctave = parseInt(playingStr.pitch.replace(/[^0-9]/g, "")) || null;
      }
    }

    const activeIndex = activeNoteName ? CHROMATIC_SCALE.indexOf(activeNoteName) : -1;
    const isWheelInTune = activeNoteName !== null && Math.abs(activeCents) <= 3;

    // Use a smooth state or fallback to index 4 (E) if no active pitch is found.
    const centerIndex = activeIndex !== -1 ? activeIndex : 4;
    const fractionalPos = centerIndex + (activeIndex !== -1 ? activeCents / 100 : 0);

    // Note spacing for high precision tape: 75px per note
    const noteSpacing = 75;

    return (
      <div 
        id="chromatic-tone-wheel" 
        className="bg-neutral-900/65 border border-white/10 rounded-2xl p-4 flex flex-col justify-between items-center w-full max-w-xl md:max-w-2xl h-[168px] min-h-[168px] max-h-[168px] shadow-xl transition-[background-color,border-color] duration-300 relative overflow-hidden"
      >
        <div className="w-full flex justify-between items-center mb-2.5 px-2 h-7">
          <div className="flex flex-col text-left">
            <span className="text-[10px] uppercase tracking-[0.25em] text-white/50 font-bold block leading-none">
              CHROMATISCHER WALZEN-DETEKTOR 📻
            </span>
            <span className="text-[9px] text-white/35 font-mono leading-none mt-1">
              Interaktive Frequenz-Abrollskala (C bis H)
            </span>
          </div>
          <div className="flex items-center h-6">
            {activeNoteName ? (
              <div className="flex items-center gap-1.5 font-mono text-[10px] font-bold bg-white/5 border border-white/10 px-2 py-0.5 rounded-md">
                <span className={isWheelInTune ? "text-green-400" : Math.abs(activeCents) <= 15 ? "text-yellow-400" : "text-red-400"}>
                  {activeNoteName}
                  {displayOctave !== null && <span className="text-[8px] opacity-40 align-super">{displayOctave}</span>}
                </span>
                <span className="text-white/20">|</span>
                <span className="text-white/60">
                  {activeCents > 0 ? "+" : ""}{activeCents.toFixed(0)} ct
                </span>
              </div>
            ) : (
              <span className="text-[9px] font-mono text-white/20 uppercase tracking-widest leading-none">BEREIT SITZEND...</span>
            )}
          </div>
        </div>

        {/* Viewport container with glass reflections and shadows */}
        <div className="relative w-full h-[70px] bg-black/55 rounded-xl border border-white/5 flex items-center justify-center overflow-hidden shadow-inner">
          
          {/* Vertical Center Hairline needle (The target alignment pointer) */}
          <div className="absolute inset-y-0 w-[2.5px] z-20 pointer-events-none flex flex-col items-center justify-between">
            {/* Bottom bead arrow */}
            <div className={`w-0 h-0 border-l-[4px] border-r-[4px] border-t-[5px] border-l-transparent border-r-transparent transition-colors duration-200 ${
              activeIndex !== -1 
                ? isWheelInTune 
                  ? "border-t-green-400 drop-shadow-[0_0_6px_#22c55e]" 
                  : Math.abs(activeCents) <= 15 
                    ? "border-t-yellow-400 drop-shadow-[0_0_5px_#eab308]" 
                    : "border-t-red-400 drop-shadow-[0_0_5px_#ef4444]"
                : "border-t-white/20"
            }`} />
            
            {/* Main Hairline needle wire */}
            <div className={`w-[2.5px] h-full transition-all duration-200 ${
              activeIndex !== -1 
                ? isWheelInTune 
                  ? "bg-green-400 drop-shadow-[0_0_4px_#22c55e]" 
                  : Math.abs(activeCents) <= 15 
                    ? "bg-yellow-400" 
                    : "bg-red-500"
                : "bg-white/15"
            }`} />

            {/* Bottom bead arrow */}
            <div className={`w-0 h-0 border-l-[4px] border-r-[4px] border-b-[5px] border-l-transparent border-r-transparent transition-colors duration-200 ${
              activeIndex !== -1 
                ? isWheelInTune 
                  ? "border-b-green-400 drop-shadow-[0_0_6px_#22c55e]" 
                  : Math.abs(activeCents) <= 15 
                    ? "border-b-yellow-400 drop-shadow-[0_0_5px_#eab308]" 
                    : "border-b-red-400 drop-shadow-[0_0_5px_#ef4444]"
                : "border-b-white/20"
            }`} />
          </div>

          {/* Side Glass Shadow Deflectors (Fades the tape out at boundaries like a real drum) */}
          <div className="absolute inset-y-0 left-0 w-16 sm:w-20 bg-gradient-to-r from-black/85 via-black/50 to-transparent pointer-events-none z-15" />
          <div className="absolute inset-y-0 right-0 w-16 sm:w-20 bg-gradient-to-l from-black/85 via-black/50 to-transparent pointer-events-none z-15" />

          {/* Scrolling Tape Container */}
          <div className="absolute inset-x-0 h-full flex items-center justify-center z-10 font-mono">
            {/* Horizontal line running all the way behind the ticks */}
            <div className="absolute inset-x-0 h-[1px] bg-white/5 pointer-events-none" />

            {/* Map each notes of the 12 chromatic semitones dynamically with circular wrap calculations */}
            {CHROMATIC_SCALE.map((note, index) => {
              // Calculate circular shortest distance to active/fractional centered index
              let diff = index - fractionalPos;
              
              // Wrap diff seamlessly into [-6, 6] domain for continuous circular scroll
              while (diff < -6) diff += 12;
              while (diff > 6) diff -= 12;

              // Compute relative physical location from center
              const xPos = diff * noteSpacing;

              // Hide far away notes to improve render speed
              if (Math.abs(xPos) > 300) return null;

              const isClosest = activeNoteName === note;
              const isGuitarStandard = GUITAR_NOTES_SET.has(note);

              let textClass = "text-white/20 text-xs font-semibold";
              let mainTickClass = "bg-white/10 w-[1.5px] h-[14px]";

              if (activeIndex !== -1 && isClosest) {
                if (isWheelInTune) {
                  textClass = "text-green-400 text-sm font-black scale-110 drop-shadow-[0_0_10px_#22c55e]";
                  mainTickClass = "bg-green-400 w-[2.5px] h-[22px] drop-shadow-[0_0_6px_#22c55e]";
                } else if (Math.abs(activeCents) <= 15) {
                  textClass = "text-yellow-400 text-xs font-bold scale-105 drop-shadow-[0_0_6px_#eab308]";
                  mainTickClass = "bg-yellow-400 w-[2px] h-[18px]";
                } else {
                  textClass = "text-red-400 text-xs font-bold scale-105 drop-shadow-[0_0_6px_#ef4444]";
                  mainTickClass = "bg-red-400 w-[2px] h-[18px]";
                }
              } else if (isGuitarStandard) {
                textClass = "text-white/55 text-xs font-bold";
                mainTickClass = "bg-white/25 w-[1.5px] h-[14px]";
              }

              return (
                <div 
                  key={`tape-note-${note}`}
                  id={`tape-note-element-${note}`}
                  className="absolute flex flex-col items-center justify-center pointer-events-none select-none"
                  style={{
                    transform: `translateX(${xPos}px)`,
                  }}
                >
                  {/* The note label text */}
                  <span className={`leading-none mb-1 text-center font-sans tracking-tighter ${textClass}`}>
                    {note}
                  </span>

                  {/* Main tick for the semitones */}
                  <div className={`rounded-full ${mainTickClass}`} />

                  {/* Symmetrical fine sub-ticks (every 20 cents) between index and index + 1 */}
                  {Array.from({ length: 4 }).map((_, stepIdx) => {
                    const stepCents = (stepIdx + 1) * 20; // 20, 40, 60, 80 cents offset
                    return (
                      <div 
                        key={`sub-tick-${note}-${stepIdx}`}
                        className="absolute h-[6px] w-[1px] bg-white/10 rounded-full"
                        style={{
                          transform: `translateX(${(stepCents / 100) * noteSpacing}px) translateY(8px)`
                        }}
                      />
                    );
                  })}
                </div>
              );
            })}
          </div>

        </div>

        {/* Dynamic Helpful Assist Prompts at Bottom */}
        <div className="w-full mt-2.5 p-2 rounded-xl bg-black/40 border border-white/5 font-mono text-[9px] text-center select-none h-[34px] min-h-[34px] max-h-[34px] overflow-hidden flex items-center justify-center">
          {activeNoteName !== null ? (
            (() => {
              const activeIdx = CHROMATIC_SCALE.indexOf(activeNoteName);
              const prevNoteName = CHROMATIC_SCALE[(activeIdx + 11) % 12];
              const nextNoteName = CHROMATIC_SCALE[(activeIdx + 1) % 12];

              if (isWheelInTune) {
                return (
                  <div className="text-green-400 font-bold flex items-center justify-center gap-1 animate-pulse h-3.5">
                    <CheckCircle2 size={10} />
                    <span>PERFEKT IN STIMMUNG!</span>
                  </div>
                );
              }

              if (activeCents < -3) {
                return (
                  <div className="flex items-center justify-center gap-2 text-white/70 h-3.5">
                    <span className="text-yellow-400 font-bold uppercase tracking-wider">ZU SCHLAFF (TIEF)</span>
                    <span className="text-white/20">|</span>
                    <span className="text-[10px] text-white/50">
                      Scherbe zieht nach links ─▶ Spannen (nach rechts drehen)!
                    </span>
                  </div>
                );
              }

              // Sharp
              return (
                <div className="flex items-center justify-center gap-2 text-white/70 h-3.5">
                  <span className="text-red-400 font-bold uppercase tracking-wider">ZU STRAMM (HOCH)</span>
                  <span className="text-white/20">|</span>
                  <span className="text-[10px] text-white/50">
                    Scherbe zieht nach rechts ◀─ Lockern (nach links drehen)!
                  </span>
                </div>
              );
            })()
          ) : (
            <div className="text-white/25 italic h-3.5 flex items-center justify-center">
              Zupfe eine beliebige Saite, um die Stimmhilfe anzuzeigen...
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className={`h-screen max-h-screen overflow-hidden ${
      themeMode === "sunshine" ? "bg-[#FFF9E6] text-[#2C1E0A] sunshine-mode" :
      themeMode === "park" ? "bg-[#CDE7C9] text-[#0E2911] park-mode" :
      "bg-[#0A0A0A] text-[#F5F5F5]"
    } flex flex-col justify-between font-sans transition-all duration-300 relative select-none`}>
      
      {bypassPermissionOverlay && permissionState !== "granted" && (
        <div id="manual-mode-banner" className="bg-amber-950/30 border-b border-amber-500/20 px-6 sm:px-10 py-3 text-[11px] sm:text-xs text-amber-300 font-mono flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 animate-fade-in z-20">
          <div className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse shrink-0" />
            <span>
              <strong>Manueller Referenz-Modus:</strong> Stimmgerät lauscht gerade nicht (Blockiert oder Stumm). Benutze die Saiten unten oder die Akkord-Bibliothek zum Stimmen!
            </span>
          </div>
          <button
            onClick={() => {
              setBypassPermissionOverlay(false);
              startTuningEngine();
            }}
            className="px-3 py-1 bg-amber-500 text-black font-extrabold uppercase rounded text-[9px] hover:bg-amber-400 active:scale-95 transition-all cursor-pointer self-end sm:self-auto"
          >
            Mikrofon aktivieren 🎤
          </button>
        </div>
      )}

      {/* Design Header: Status Bar Layout */}
      <header className={`flex items-center w-full px-2 sm:px-10 py-3 sm:py-5 border-b transition-all duration-300 relative gap-1.5 sm:gap-4 justify-between ${
        themeMode === "sunshine" ? "bg-[#FFF9E6] border-[#EEDBA5]" :
        themeMode === "park" ? "bg-[#EAF4E8] border-[#C5DBBF]" :
        "bg-[#0A0A0A] border-white/10"
      } ${(isModusDropdownOpen || isTuningDropdownOpen) ? "z-[70]" : "z-10"}`}>
        {/* Device Status Segment */}
        <button 
          id="mic-head-toggle-btn"
          onClick={isListening ? stopTuningEngine : startTuningEngine}
          className="flex-1 md:flex-initial min-w-0 flex items-center justify-center sm:justify-start bg-neutral-900/50 border border-white/10 hover:border-white/20 rounded-xl hover:bg-neutral-800/40 active:scale-95 transition-all text-left shadow-lg cursor-pointer group px-1 sm:px-3.5 py-1.5 gap-1 sm:gap-2.5"
        >
          <div className="flex items-center gap-1.5 sm:gap-2.5 min-w-0">
            <div className="flex-shrink-0 flex items-center justify-center w-7 h-7 rounded-lg bg-neutral-950/80 border border-white/5 relative transition-all">
              {isListening ? (
                <>
                  <Mic size={13} className="text-green-400 drop-shadow-[0_0_6px_#22c55e]" />
                  <span className="absolute top-1.5 right-1.5 w-1 h-1 rounded-full bg-green-500 animate-ping" />
                </>
              ) : (
                <MicOff size={13} className="text-red-400" />
              )}
            </div>
            <div className="flex flex-col leading-tight min-w-0">
              <span className="text-[8px] uppercase tracking-[0.12em] sm:tracking-[0.25em] text-white/45 font-bold truncate">
                Lauscher
              </span>
              <span className={`text-[10px] sm:text-[11px] font-mono font-bold uppercase transition-colors truncate ${isListening ? "text-green-400" : "text-white/60"}`}>
                {isListening ? "Aktiv" : "Aus"}
              </span>
            </div>
          </div>
        </button>
        
        {/* Reference Segment */}
        <div className="flex-1 md:flex-initial min-w-0">
          <div 
            id="kammerton-toggle-container"
            className="flex items-center justify-center sm:justify-start bg-neutral-900/50 border border-white/10 rounded-xl hover:border-white/20 hover:bg-neutral-800/40 shadow-lg p-0.5 sm:p-1 gap-1 sm:gap-1.5 w-full h-full"
          >
            {/* Play Button Trigger */}
            <button
              type="button"
              title={`${referenceA4} Hz Ton abspielen`}
              onClick={(e) => {
                e.stopPropagation();
                playReferencePitch(referenceA4, 99);
              }}
              className="w-7 h-7 rounded-lg border flex items-center justify-center transition-all cursor-pointer bg-neutral-950/80 border-white/5 hover:border-white/15 text-white/50 hover:text-white shrink-0"
            >
              {playingStringNum === 99 ? (
                <Pause size={10} className="fill-current" />
              ) : (
                <Volume2 size={11} className="transition-transform group-hover:scale-110" />
              )}
            </button>

            {/* Freq Toggle switch */}
            <div 
              role="button"
              tabIndex={0}
              onClick={() => {
                const targetFreq = referenceA4 === 440 ? 432 : 440;
                setReferenceA4(targetFreq);
                if (playingStringNum === 99) {
                  setTimeout(() => {
                    playReferencePitch(targetFreq, 99);
                  }, 50);
                }
              }}
              className="flex flex-col leading-tight px-1 py-0.5 sm:px-2.5 sm:py-1 text-left select-none cursor-pointer group rounded-lg hover:bg-white/5 min-w-0"
            >
              <span className="text-[8px] uppercase tracking-[0.12em] sm:tracking-[0.25em] text-white/45 font-bold mb-0.5 truncate">
                Concert Pitch
              </span>
              <span className="text-[10px] sm:text-[11px] font-mono font-bold text-white/80 uppercase flex items-center gap-1 min-w-0 truncate">
                A4=<span className={referenceA4 === 432 ? "text-amber-400 font-extrabold" : "text-white"}>{referenceA4}</span>
                <span className={`text-[8.5px] scale-80 font-sans px-1 py-[0.5px] rounded uppercase hidden xl:inline-block ${
                  referenceA4 === 432 
                    ? "bg-amber-500/10 text-amber-400 border border-amber-500/30 animate-pulse" 
                    : "bg-white/5 text-white/40"
                }`}>
                  {referenceA4 === 432 ? "Klang" : "Std"}
                </span>
              </span>
            </div>
          </div>
        </div>

        {/* Tuning Preset Selector Segment */}
        <div className="relative font-sans z-50 animate-none flex-1 md:flex-initial min-w-0" ref={tuningDropdownRef}>
          <button 
            id="stimm-preset-dropdown-btn"
            onClick={() => setIsTuningDropdownOpen(!isTuningDropdownOpen)}
            className="w-full flex items-center justify-center sm:justify-start bg-neutral-900/50 border border-white/10 rounded-xl hover:bg-neutral-800/45 hover:border-white/20 active:scale-95 transition-all text-left shadow-lg cursor-pointer group px-1 sm:px-3.5 py-1.5 gap-1 sm:gap-2.5 text-white/85"
            title="Wähle Stimmungs-Voreinstellung"
          >
            <div className="flex-shrink-0 flex items-center justify-center w-7 h-7 rounded-lg bg-neutral-950/80 border border-white/5 transition-all">
              <Zap size={12} className="text-amber-400" />
            </div>
            <div className="flex flex-col leading-tight pr-1 min-w-0">
              <span className="text-[8px] uppercase tracking-[0.12em] sm:tracking-[0.18em] text-white/45 font-bold mb-0.5 truncate">
                Stimmung
              </span>
              <span className="text-[10px] sm:text-[11px] font-mono font-bold uppercase flex items-center gap-1 min-w-0 truncate">
                {selectedInstrumentId === "ukulele" ? (
                  UKULELE_TUNING_PRESETS.find(p => p.id === selectedTuningId)?.name.split(" ")[0] || "Standard"
                ) : selectedInstrumentId === "guitar12" ? (
                  "Standard"
                ) : (
                  GUITAR_TUNING_PRESETS.find(p => p.id === selectedTuningId)?.name.split(" ")[0] || "Standard"
                )}
                <ChevronDown size={11} className={`text-white/40 transition-transform duration-200 ${isTuningDropdownOpen ? "rotate-180" : ""}`} />
              </span>
            </div>
          </button>

          {isTuningDropdownOpen && (
            <div className="absolute left-1/2 -translate-x-1/2 md:left-auto md:right-0 md:translate-x-0 mt-2 w-64 bg-neutral-900/95 backdrop-blur-md border border-white/10 rounded-xl overflow-hidden shadow-2xl z-50 animate-fade-in pointer-events-auto py-1.5 px-1.5 flex flex-col gap-1 text-left">
              <div className="px-2.5 py-1 border-b border-white/5 mb-1 flex items-center justify-between">
                <span className="text-[8px] uppercase tracking-wider text-white/40 font-bold">
                  Stimmung wählen
                </span>
                {selectedInstrumentId === "guitar12" && (
                  <span className="text-[7.5px] uppercase font-mono px-1.5 py-[1px] rounded bg-white/5 text-white/40 border border-white/10">
                    Fixiert
                  </span>
                )}
              </div>
              
              {selectedInstrumentId === "guitar12" ? (
                <div className="px-3 py-2 text-xs italic text-white/35 font-sans">
                  Der 12-Saiter Modus läuft standardmäßig in doppelten Oktaven.
                </div>
              ) : selectedInstrumentId === "ukulele" ? (
                UKULELE_TUNING_PRESETS.map((preset) => (
                  <button
                    key={preset.id}
                    onClick={() => {
                      setSelectedTuningId(preset.id);
                      setIsTuningDropdownOpen(false);
                    }}
                    className={`w-full text-left px-3 py-1.5 rounded-lg text-xs font-mono transition-all flex items-center justify-between cursor-pointer ${
                      selectedTuningId === preset.id
                        ? "bg-amber-500/15 text-amber-400 font-extrabold border border-amber-500/20"
                        : "text-white/60 hover:bg-white/5 hover:text-white border border-transparent"
                    }`}
                  >
                    <div className="flex flex-col">
                      <span className="font-bold font-sans text-white/80">{preset.name}</span>
                      <span className="text-[8.5px] text-white/35">{preset.pitches.join(" • ")}</span>
                    </div>
                    {selectedTuningId === preset.id && (
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                    )}
                  </button>
                ))
              ) : (
                GUITAR_TUNING_PRESETS.map((preset) => (
                  <button
                    key={preset.id}
                    onClick={() => {
                      setSelectedTuningId(preset.id);
                      setIsTuningDropdownOpen(false);
                    }}
                    className={`w-full text-left px-3 py-1.5 rounded-lg text-xs font-mono transition-all flex items-center justify-between cursor-pointer ${
                      selectedTuningId === preset.id
                        ? "bg-amber-500/15 text-amber-400 font-extrabold border border-amber-500/20"
                        : "text-white/60 hover:bg-white/5 hover:text-white border border-transparent"
                    }`}
                  >
                    <div className="flex flex-col">
                      <span className="font-bold font-sans text-white/80">{preset.name}</span>
                      <span className="text-[8.5px] text-white/35">{preset.pitches.join(" • ")}</span>
                    </div>
                    {selectedTuningId === preset.id && (
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                    )}
                  </button>
                ))
              )}
            </div>
          )}
        </div>

        {/* Lock / Automatic Mode Segment */}
        <div className="relative font-sans z-50 animate-none flex-1 md:flex-initial min-w-0" ref={modusDropdownRef}>
          <button 
            id="stimm-modus-cycle-btn"
            onClick={() => setIsModusDropdownOpen(!isModusDropdownOpen)}
            className={`w-full flex items-center justify-center sm:justify-start bg-neutral-900/50 border rounded-xl hover:bg-neutral-800/45 hover:border-white/20 active:scale-95 transition-all text-left shadow-lg cursor-pointer group px-1 sm:px-3.5 py-1.5 gap-1 sm:gap-2.5 ${
              targetStringLock !== null ? "border-sky-500/50 text-sky-400" : "border-white/10 hover:border-white/20"
            }`}
          >
            <div className={`flex-shrink-0 flex items-center justify-center w-7 h-7 rounded-lg bg-neutral-950/80 border border-white/5 relative transition-all ${
              targetStringLock !== null ? "border-sky-500/30 text-sky-400 bg-sky-950/10" : "text-white/50"
            }`}>
              {targetStringLock !== null ? (
                <Target size={13} className="text-sky-400" />
              ) : (
                <Radio size={13} className="text-white/55" />
              )}
              {playingStringNum !== null && playingStringNum !== 99 && (
                <span className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" />
              )}
            </div>
            <div className="flex flex-col leading-tight pr-1 min-w-0">
              <span className="text-[8px] uppercase tracking-[0.12em] sm:tracking-[0.25em] text-white/45 font-bold mb-0.5 truncate">
                Stimm-Modus
              </span>
              <span className="text-[10px] sm:text-[11px] font-mono font-bold text-white/80 uppercase flex items-center gap-1 min-w-0 truncate">
                {targetStringLock !== null ? (
                  (() => {
                    const lockedStr = tunedGuitarStrings.find(s => s.number === targetStringLock);
                    return lockedStr ? `${lockedStr.note}${lockedStr.pitch.replace(/[^0-9]/g, "")}` : `Saite ${targetStringLock}`;
                  })()
                ) : (
                  "Auto"
                )}
                <ChevronDown size={11} className={`text-white/40 transition-transform duration-200 ${isModusDropdownOpen ? "rotate-180" : ""}`} />
              </span>
            </div>
          </button>

          {/* Expanded Dropdown Panel */}
          {isModusDropdownOpen && (
            <div className="absolute left-1/2 -translate-x-1/2 md:left-auto md:right-0 md:translate-x-0 mt-2 w-72 bg-neutral-900/95 backdrop-blur-md border border-white/10 rounded-xl overflow-hidden shadow-2xl z-50 animate-fade-in pointer-events-auto">
              <div className="px-3 py-2 bg-neutral-950/45 border-b border-white/5 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="text-[9px] uppercase tracking-wider text-white/40 font-bold">
                    Stimm-Modus wählen
                  </span>
                  {playingStringNum !== null && playingStringNum !== 99 && (
                    <span className="text-[8.5px] uppercase font-mono bg-emerald-950/45 text-emerald-400 border border-emerald-900/40 px-1.5 py-0.5 rounded animate-pulse">
                      Sound Aktiv 🔊
                    </span>
                  )}
                </div>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsModusDropdownOpen(false);
                  }}
                  className="w-5 h-5 rounded-md hover:bg-white/10 flex items-center justify-center text-white/50 hover:text-white transition-all cursor-pointer"
                  title="Schließen"
                >
                  <X size={11} />
                </button>
              </div>

              <div className="p-1.5 flex flex-col gap-1 max-h-[380px] overflow-y-auto">
                {/* Continuous Drone Mode Toggle */}
                <div className="px-3 py-2 rounded-lg bg-neutral-950/45 border border-white/5 flex items-center justify-between text-xs font-mono">
                  <div className="flex flex-col leading-tight">
                    <span className="font-bold text-white/80 font-sans">🔄 Dauerschleife</span>
                    <span className="text-[8.5px] text-white/35">Referenzton dauerhaft halten</span>
                  </div>
                  <button 
                    type="button"
                    onClick={() => {
                      setIsContinuousReference(!isContinuousReference);
                      stopReferencePitch();
                    }}
                    className={`w-9 h-5 rounded-full p-[2px] transition-all cursor-pointer relative shrink-0 ${
                      isContinuousReference ? "bg-amber-500" : "bg-neutral-800"
                    }`}
                  >
                    <div className={`w-3.5 h-3.5 rounded-full bg-neutral-950 shadow-md transition-all transform ${
                      isContinuousReference ? "translate-x-4.5" : "translate-x-0"
                    }`} />
                  </button>
                </div>

                {/* Separator */}
                <div className="h-[1px] bg-white/5 my-0.5" />

                {/* Option 1: Automatic Detection */}
                <div 
                  className={`flex items-center justify-between px-3 py-2 rounded-lg transition-all text-xs font-mono cursor-pointer ${
                    targetStringLock === null 
                      ? "bg-white/5 text-white border border-white/5" 
                      : "text-white/60 hover:bg-white/5 hover:text-white border border-transparent"
                  }`}
                  onClick={() => {
                    setTargetStringLock(null);
                    setIsModusDropdownOpen(false);
                  }}
                >
                  <div className="flex items-center gap-2.5">
                    <Radio size={12} className={targetStringLock === null ? "text-sky-400" : "text-white/30"} />
                    <div className="flex flex-col leading-tight">
                      <span className="font-bold font-sans text-white/90">Auto-Riecher</span>
                      <span className="text-[9px] text-white/35">Automatische Frequenz-Erkennung</span>
                    </div>
                  </div>
                  {targetStringLock === null && (
                    <span className="w-1.5 h-1.5 rounded-full bg-sky-400" />
                  )}
                </div>

                {/* Separator */}
                <div className="h-[1px] bg-white/5 my-1" />

                {/* Option 2: Individual Guitar Strings */}
                {[...tunedGuitarStrings].reverse().map((str) => {
                  const isLocked = targetStringLock === str.number;
                  const isSounding = playingStringNum === str.number;

                  return (
                    <div 
                      key={str.number}
                      className={`flex items-center justify-between px-3 py-1.5 rounded-lg transition-all text-xs border ${
                        isLocked 
                          ? "bg-sky-950/15 text-white border-sky-500/20 shadow-sm" 
                          : "text-white/60 hover:bg-white/5 hover:text-white border border-transparent"
                      }`}
                    >
                      {/* Left Side: Label and Pitch Details */}
                      <div 
                        className="flex-1 flex items-center gap-2.5 py-0.5 cursor-pointer text-left"
                        onClick={() => {
                          setTargetStringLock(str.number);
                          // Play the reference tone immediately for 3 seconds on selection
                          playReferencePitch(str.frequency, str.number);
                          setIsModusDropdownOpen(false);
                        }}
                      >
                        <div className={`w-6 h-6 rounded-md flex items-center justify-center font-bold text-xs ${
                          isLocked ? "bg-sky-500/10 text-sky-400" : "bg-neutral-950/70 text-white/40"
                        }`}>
                          {str.note}
                        </div>
                        <div className="flex flex-col leading-tight">
                          <span className="font-bold font-sans">Saite {str.number} ({str.pitch})</span>
                          <span className="text-[9.5px] text-white/35 font-mono">{str.frequency.toFixed(2)} Hz</span>
                        </div>
                      </div>

                      {/* Right Side: Interactive Play for 3s Button */}
                      <button
                        title="Ton für 3 Sek. abspielen"
                        className={`w-7 h-7 rounded-md border flex items-center justify-center transition-all cursor-pointer ${
                          isSounding 
                            ? "bg-emerald-950/30 border-emerald-500/30 text-emerald-400 animate-pulse" 
                            : "bg-[#141414] border-white/5 hover:border-white/15 text-white/50 hover:text-white hover:bg-neutral-800"
                        }`}
                        onClick={(e) => {
                          e.stopPropagation();
                          playReferencePitch(str.frequency, str.number);
                        }}
                      >
                        {isSounding ? (
                          <Pause size={10} className="fill-current" />
                        ) : (
                          <Play size={10} className="fill-current ml-0.5" />
                        )}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* 3-Way Cycle Theme Selector (COMMIT: Introduced multi-option background theme cycle - Dark, Sunshine, Park to optimize visibility and comfort) */}
        {/* 3-Way Cycle Theme Selector (COMMIT: Introduced multi-option background theme cycle - Dark, Sunshine, Park to optimize visibility and comfort) */}
        <button
          id="theme-cycle-toggle-btn"
          onClick={() => {
            setThemeMode((prev) => {
              if (prev === "dark") return "sunshine";
              if (prev === "sunshine") return "park";
              return "dark";
            });
          }}
          className={`flex-1 md:flex-initial min-w-0 flex items-center justify-center sm:justify-start gap-1 sm:gap-2 px-1 sm:px-3 py-1.5 rounded-xl border hover:scale-105 active:scale-95 transition-all shadow-lg cursor-pointer text-left z-50 ${
            themeMode === "sunshine" 
              ? "bg-amber-100 border-[#DBCAB1] text-amber-800 hover:bg-amber-150" 
              : themeMode === "park"
              ? "bg-emerald-100 border-[#BCD6B9] text-emerald-850 hover:bg-emerald-150"
              : "bg-neutral-900/50 border-white/10 text-amber-400 hover:bg-neutral-800/40 hover:border-white/20"
          }`}
          title="Wechsle das Thema (Dunkel 🛸 -> Sonne ☀️ -> Park 🌲)"
        >
          <div className={`w-7 h-7 rounded-lg flex items-center justify-center border transition-all shrink-0 ${
            themeMode === "sunshine" 
              ? "bg-amber-500 text-white border-amber-400" 
              : themeMode === "park"
              ? "bg-emerald-600 text-white border-emerald-500"
              : "bg-neutral-950/80 border-white/5 text-amber-400"
          }`}>
            {themeMode === "sunshine" && <Sun size={14} className="animate-[spin_20s_linear_infinite]" />}
            {themeMode === "park" && <Trees size={14} />}
            {themeMode === "dark" && <SunDim size={14} />}
          </div>
          <div className="flex flex-col leading-tight pr-1 min-w-0">
            <span className={`text-[8px] uppercase tracking-[0.12em] sm:tracking-[0.25em] font-bold mb-0.5 truncate ${
              themeMode === "sunshine" ? "text-amber-800/60" : themeMode === "park" ? "text-emerald-800/60" : "text-white/45"
            }`}>
              Design
            </span>
            <span className={`text-[10px] sm:text-[11px] font-mono font-bold uppercase truncate ${
              themeMode === "sunshine" ? "text-amber-950" : themeMode === "park" ? "text-emerald-950" : "text-amber-400"
            }`}>
              {themeMode === "sunshine" ? "Sonne" : themeMode === "park" ? "Park" : "Dunkel"}
            </span>
          </div>
        </button>
      </header>

      {/* Dynamic theme style overrides for Sunshine and Park Modes */}
      {(themeMode === "sunshine" || themeMode === "park") && (
        <style>{`
          /* === COMMON LIGHT MODE STYLE RESETS === */
          .sunshine-mode {
            background: radial-gradient(circle at top, #FFFDF0 0%, #FAF1D6 60%, #EFE1B8 100%) !important;
            color: #302205 !important;
          }
          .park-mode {
            background: radial-gradient(circle at top, #CDE7C9 0%, #B7DCB2 60%, #9BC696 100%) !important;
            color: #0E2911 !important;
          }

          /* Headers, Containers and Buttons */
          .sunshine-mode header,
          .sunshine-mode #zeiger-dampen-row,
          .sunshine-mode #horizontal-full-neck-visualizer,
          .sunshine-mode #chord-display-container,
          .sunshine-mode #theory-help-drawer,
          .sunshine-mode #mic-head-toggle-btn,
          .sunshine-mode #kammerton-toggle-container,
          .sunshine-mode #stimm-modus-cycle-btn,
          .sunshine-mode #view-dropdown-trigger {
            background-color: #FAF2D8 !important;
            border-color: #E6D4B2 !important;
            color: #302205 !important;
            box-shadow: 0 4px 15px rgba(139, 90, 43, 0.08) !important;
          }

          .park-mode header,
          .park-mode #zeiger-dampen-row,
          .park-mode #horizontal-full-neck-visualizer,
          .park-mode #chord-display-container,
          .park-mode #theory-help-drawer,
          .park-mode #mic-head-toggle-btn,
          .park-mode #kammerton-toggle-container,
          .park-mode #stimm-modus-cycle-btn,
          .park-mode #view-dropdown-trigger {
            background-color: #BBE1B6 !important;
            border-color: #92B98E !important;
            color: #0A260E !important;
            box-shadow: 0 4px 15px rgba(9, 34, 13, 0.08) !important;
          }

          .sunshine-mode header button, .sunshine-mode header div,
          .park-mode header button, .park-mode header div {
            color: inherit !important;
          }

          /* Banner Colors */
          .sunshine-mode #manual-mode-banner {
            background-color: #FEF3C7 !important;
            color: #92400E !important;
            border-color: #FCD34D !important;
          }
          .park-mode #manual-mode-banner {
            background-color: #D1FAE5 !important;
            color: #065F46 !important;
            border-[#A7F3D0] !important;
          }

          /* Details and Text Muting */
          .sunshine-mode .text-white\\/40, .sunshine-mode .text-white\\/45,
          .sunshine-mode .text-white\\/50, .sunshine-mode .text-white\\/35,
          .sunshine-mode .text-stone-400 {
            color: #7C694E !important;
          }
          .park-mode .text-white\\/40, .park-mode .text-white\\/45,
          .park-mode .text-white\\/50, .park-mode .text-white\\/35,
          .park-mode .text-stone-400 {
            color: #3C5A40 !important;
          }

          .sunshine-mode .text-white, .sunshine-mode .text-white\\/90,
          .sunshine-mode .text-white\\/80, .sunshine-mode .text-white\\/60 {
            color: #302205 !important;
          }
          .park-mode .text-white, .park-mode .text-white\\/90,
          .park-mode .text-white\\/80, .park-mode .text-white\\/60 {
            color: #061A08 !important;
          }

          /* Border styling */
          .sunshine-mode .border-white\\/10, .sunshine-mode .border-white\\/5,
          .sunshine-mode .border-white\\/15, .sunshine-mode .border-[#1E1E1E],
          .sunshine-mode .border-neutral-800 {
            border-color: #EADCB9 !important;
          }
          .park-mode .border-white\\/10, .park-mode .border-white\\/5,
          .park-mode .border-white\\/15, .park-mode .border-[#1E1E1E],
          .park-mode .border-neutral-800 {
            border-color: #9EC09A !important;
          }

          /* Nested Container backgrounds */
          .sunshine-mode .bg-neutral-900\\/40, .sunshine-mode .bg-neutral-900\\/50,
          .sunshine-mode .bg-neutral-950\\/85, .sunshine-mode .bg-[#141414],
          .sunshine-mode .bg-black\\/20, .sunshine-mode .bg-black\\/40 {
            background-color: #F8EFCF !important;
            color: #302205 !important;
            border-color: #E6D8AD !important;
          }
          .park-mode .bg-neutral-900\\/40, .park-mode .bg-neutral-900\\/50,
          .park-mode .bg-neutral-950\\/85, .park-mode .bg-[#141414],
          .park-mode .bg-black\\/20, .park-mode .bg-black\\/40 {
            background-color: #B2D8AD !important;
            color: #061A08 !important;
            border-color: #8CBA86 !important;
          }

          /* Inlaid black boxes */
          .sunshine-mode .bg-neutral-950\\/80, .sunshine-mode .bg-neutral-950\\/70, .sunshine-mode .bg-neutral-950\\/45 {
            background-color: #EDDEB6 !important;
            color: #302205 !important;
            border-color: #DEC89F !important;
          }
          .park-mode .bg-neutral-950\\/80, .park-mode .bg-neutral-950\\/70, .park-mode .bg-neutral-950\\/45 {
            background-color: #A4CC9E !important;
            color: #061A08 !important;
            border-color: #82AF7C !important;
          }

          /* Dampen row active button */
          .sunshine-mode #zeiger-dampen-row button:not(.bg-white) {
            color: #7C694E !important;
          }
          .sunshine-mode #zeiger-dampen-row button.bg-white {
            background-color: #D97706 !important;
            color: #FFFFFF !important;
          }

          .park-mode #zeiger-dampen-row button:not(.bg-white) {
            color: #3C5A40 !important;
          }
          .park-mode #zeiger-dampen-row button.bg-white {
            background-color: #166534 !important;
            color: #FFFFFF !important;
          }

          /* Human texts */
          .sunshine-mode p, .sunshine-mode span.text-stone-400, .sunshine-mode li {
            color: #54442A !important;
          }
          .park-mode p, .park-mode span.text-stone-400, .park-mode li {
            color: #123315 !important;
          }

          /* Headings & Accent Labels */
          .sunshine-mode h1, .sunshine-mode h2, .sunshine-mode h3, 
          .sunshine-mode h4, .sunshine-mode h5, .sunshine-mode h6 {
            color: #92400E !important;
          }
          .park-mode h1, .park-mode h2, .park-mode h3, 
          .park-mode h4, .park-mode h5, .park-mode h6 {
            color: #14532D !important;
          }

          /* Tune board svg elements */
          .sunshine-mode svg text, .park-mode svg text {
            fill: #302205 !important;
          }
          .sunshine-mode #dial-tuner-text, .park-mode #dial-tuner-text {
            color: inherit !important;
          }
          .sunshine-mode #shared-horizontal-tuning-bar {
            background-color: #FAF2D8 !important;
            border-color: #E6D4B2 !important;
          }
          .park-mode #shared-horizontal-tuning-bar {
            background-color: #BBE1B6 !important;
            border-color: #92B98E !important;
          }

          /* Tone wheel adjustments */
          .sunshine-mode #renderToneWheel-bg {
            stroke: rgba(146, 64, 14, 0.15) !important;
          }
          .park-mode #renderToneWheel-bg {
            stroke: rgba(22, 101, 52, 0.15) !important;
          }

          /* Dropdown panel backgrounds */
          .sunshine-mode .absolute.right-0 {
            background-color: #FAF5DC !important;
            border-color: #E6D3A0 !important;
            box-shadow: 0 10px 30px rgba(139, 90, 43, 0.15) !important;
          }
          .park-mode .absolute.right-0 {
            background-color: #BFE3BA !important;
            border-color: #95BD90 !important;
            box-shadow: 0 10px 30px rgba(9, 34, 13, 0.15) !important;
          }

          /* Scrollbar Custom Styling for Mobile Header Nav */
          header::-webkit-scrollbar {
            height: 3px;
          }
          header::-webkit-scrollbar-track {
            background: rgba(0,0,0,0.05);
          }
          header::-webkit-scrollbar-thumb {
            background: rgba(0,0,0,0.15);
            border-radius: 99px;
          }
          .sunshine-mode *::-webkit-scrollbar-track {
            background: #EDDEB6 !important;
          }
          .sunshine-mode *::-webkit-scrollbar-thumb {
            background: #DEC89F !important;
          }
          .park-mode *::-webkit-scrollbar-track {
            background: #A4CC9E !important;
          }
          .park-mode *::-webkit-scrollbar-thumb {
            background: #82AF7C !important;
          }
          
          /* Visual cue elements */
          .sunshine-mode .bg-green-950\\/20 {
            background-color: #FEF3C7 !important;
            color: #D97706 !important;
            border-color: #FCD34D !important;
          }
          .park-mode .bg-green-950\\/20 {
            background-color: #A7F3D0 !important;
            color: #047857 !important;
            border-color: #34D399 !important;
          }
        `}</style>
      )}

      {/* Scrollable Workspace Container to make everything fit beautifully to screen heights */}
      <div className="flex-1 overflow-y-auto flex flex-col relative z-10">
        <main className="flex-1 flex flex-col items-center justify-start relative px-4 pt-2 pb-12">
        {/* Inline CSS animations for physically realistic string vibration */}
        <style>{`
          @keyframes vibrateStringAnimation {
            0% { transform: translate(0, 0); }
            20% { transform: translate(-1.2px, 0.4px); }
            40% { transform: translate(1.2px, -0.4px); }
            60% { transform: translate(-0.8px, -0.2px); }
            80% { transform: translate(0.8px, 0.2px); }
            100% { transform: translate(0, 0); }
          }
          .animate-string-vibrate {
            animation: vibrateStringAnimation 0.08s infinite linear;
          }
        `}</style>

        {/* Elegant Vertical Acoustic Guitar Body Underlay */}
        <div className="absolute inset-0 z-0 pointer-events-none flex items-center justify-center overflow-visible">
          <svg 
            viewBox="0 0 600 850" 
            className="w-[720px] sm:w-[940px] md:w-[1080px] h-auto max-w-[170vw] opacity-80 select-none animate-fade-in transition-all duration-300"
            preserveAspectRatio="xMidYMid meet"
          >
            <defs>
              {/* Sunburst Gradient */}
              <radialGradient id="guitar-sunburst" cx="300" cy="425" r="300" fx="300" fy="425" gradientUnits="userSpaceOnUse">
                <stop offset="0%" stopColor="#ffb300" stopOpacity="0.85" />
                <stop offset="30%" stopColor="#f57c00" stopOpacity="0.8" />
                <stop offset="55%" stopColor="#d84315" stopOpacity="0.7" />
                <stop offset="82%" stopColor="#3e2723" stopOpacity="0.9" />
                <stop offset="100%" stopColor="#0d0d0d" stopOpacity="0.95" />
              </radialGradient>

              {/* Fingerboard Texture */}
              <linearGradient id="fingerboard-grad" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#1a120b" />
                <stop offset="50%" stopColor="#2e2114" />
                <stop offset="100%" stopColor="#1a120b" />
              </linearGradient>

              {/* Pickguard/Schlagschutz Shape Gradient */}
              <linearGradient id="pickguard-grad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#2b0e02" />
                <stop offset="100%" stopColor="#080301" />
              </linearGradient>

              {/* Bridge Wood Gradient */}
              <linearGradient id="bridge-wood" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="#3E2723" />
                <stop offset="100%" stopColor="#1A0C06" />
              </linearGradient>
            </defs>

            {/* Fretboard & Neck (standing vertically up) */}
            <rect x="272" y="0" width="56" height="282" fill="url(#fingerboard-grad)" rx="1" />
            
            {/* Silver NICKEL frets on neck */}
            {Array.from({ length: 14 }).map((_, i) => {
              const fretY = 282 - (i * 18);
              return (
                <g key={i}>
                  <line x1="272" y1={fretY} x2="328" y2={fretY} stroke="#8a8a8a" strokeWidth="1" opacity="0.5" />
                  {/* Pearl Dot Inlays on fret 3, 5, 7, 9, 12 */}
                  {[3, 5, 7, 9].includes(i + 1) && (
                    <circle cx="300" cy={fretY - 9} r="2.5" fill="#eaeaea" opacity="0.8" />
                  )}
                  {i + 1 === 12 && (
                    <>
                      <circle cx="293" cy={fretY - 9} r="2" fill="#eaeaea" opacity="0.8" />
                      <circle cx="307" cy={fretY - 9} r="2" fill="#eaeaea" opacity="0.8" />
                    </>
                  )}
                </g>
              );
            })}

            {/* Wood Grain Sunburst Guitar Front Face Plate */}
            <path 
              d="M 300 280 
                 C 245 280, 160 286, 142 360 
                 C 125 430, 175 480, 195 505 
                 C 165 545, 85 600, 85 695 
                 C 85 795, 175 850, 300 850 
                 C 425 850, 515 795, 515 695 
                 C 515 600, 435 545, 405 505 
                 C 425 480, 475 430, 458 360 
                 C 440 286, 355 280, 300 280 Z" 
              fill="url(#guitar-sunburst)"
              stroke="#432111"
              strokeWidth="8"
              className="drop-shadow-[0_15px_30px_rgba(0,0,0,0.9)]"
            />

            {/* Outer binding decoration */}
            <path 
              d="M 300 283 
                 C 246 283, 162 289, 145 361 
                 C 128 431, 176 481, 196 506 
                 C 166 546, 88 601, 88 696 
                 C 88 792, 177 847, 300 847 
                 C 423 847, 512 792, 512 696 
                 C 512 601, 434 546, 404 506 
                 C 424 501, 472 481, 455 361 
                 C 438 289, 354 283, 300 283 Z" 
              fill="none"
              stroke="#fffef2"
              strokeWidth="1.5"
              opacity="0.2"
            />

            {/* Classic Tortoiseshell Custom Pickguard */}
            <path
              d="M 300 425
                 A 75 75 0 0 1 353 478
                 L 395 478
                 C 415 478, 440 520, 420 550
                 C 400 580, 335 520, 320 495
                 Z"
              fill="url(#pickguard-grad)"
              opacity="0.75"
              className="drop-shadow-[0_2px_4px_rgba(0,0,0,0.45)]"
            />

            {/* Wooden Soundhole Outer Rosette Binding (underlays actual rosette interface card) */}
            <circle cx="300" cy="425" r="77" fill="none" stroke="#2B1408" strokeWidth="6" opacity="0.6" />
            <circle cx="300" cy="425" r="75" fill="none" stroke="#ffb300" strokeWidth="2" opacity="0.4" />
            <circle cx="300" cy="425" r="69" fill="#000000" opacity="0.1" />

            {/* Rosewood Bridge on lower bout */}
            <g transform="translate(0, 390)" className="drop-shadow-[0_4px_10px_rgba(0,0,0,0.7)]">
              {/* Bridge body wings */}
              <path 
                d="M 190 318
                   C 220 316, 225 310, 245 310
                   L 355 310
                   C 375 310, 380 316, 410 318
                   C 420 322, 420 326, 410 329
                   C 380 331, 375 328, 355 328
                   L 245 328
                   C 225 328, 220 331, 190 329
                   C 180 326, 180 322, 190 318 Z" 
                fill="url(#bridge-wood)"
                stroke="#150a04"
                strokeWidth="1.5"
              />
              
              {/* Bone saddle */}
              <rect x="238" y="316" width="124" height="3" fill="#faf9f2" rx="0.5" className="drop-shadow-[0_1px_1px_rgba(0,0,0,0.3)]" />
              
              {/* Pin slots with dot details */}
              {Array.from({ length: 6 }).map((_, idx) => {
                const pinX = 250 + idx * 20;
                return (
                  <g key={idx}>
                    <circle cx={pinX} cy="323" r="3" fill="#1b120f" stroke="#0e0806" strokeWidth="0.5" />
                    <circle cx={pinX} cy="323" r="1" fill="#ffffff" opacity="0.85" />
                  </g>
                );
              })}
            </g>
          </svg>
        </div>
        
        {/* Centered Pitch Indicator Line (Static Backdrop Overlay only for standard display) */}
        {displayMode === "led-bar" && (
          <div className="absolute inset-x-0 inset-y-0 pointer-events-none flex justify-center z-0">
            <div className="h-full w-[1.5px] bg-white/10 relative">
              <div className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-4 h-4 rounded-full transition-all duration-500 ${
                hasSignal && isInTune 
                  ? "bg-green-400 shadow-[0_0_25px_#22c55e,0_0_10px_#22c55e]" 
                  : "bg-white/40 shadow-[0_0_15px_rgba(255,255,255,0.2)]"
              }`} />
            </div>
          </div>
        )}

        {/* Quick Launch Notification for Pentatonic Workstation */}
        <div className="relative z-30 w-full max-w-xl mx-auto mb-3 flex justify-center">
          <button
            onClick={() => {
              setChordFilter("pentatonic");
              setTimeout(() => {
                const el = document.getElementById("pentatonic-workstation") || document.getElementById("horizontal-full-neck-visualizer");
                if (el) {
                  el.scrollIntoView({ behavior: "smooth", block: "center" });
                }
              }, 120);
            }}
            className="w-full flex items-center justify-between gap-1.5 bg-gradient-to-r from-amber-600/35 to-amber-900/40 hover:from-amber-600/45 hover:to-amber-900/55 border border-amber-500/30 hover:border-amber-500/50 rounded-xl p-2 px-3.5 text-[10.5px] font-sans font-bold text-amber-300 hover:text-white transition-all cursor-pointer shadow-lg shadow-amber-950/20 active:scale-[0.98] group"
          >
            <div className="flex items-center gap-2 text-left">
              <span className="text-sm group-hover:scale-110 transition-transform">✨</span>
              <div className="flex flex-col select-none">
                <span className="text-[10px] uppercase tracking-wider font-extrabold text-white">Pentatonik Workstation & Master-Griffbrett</span>
                <span className="text-[8px] text-amber-400/70 font-mono mt-0.5">Automatisches Master Neck & Box Muster öffnen</span>
              </div>
            </div>
            <span className="bg-amber-400 text-neutral-950 text-[8.5px] font-mono font-black px-2 py-0.5 rounded-full shadow shrink-0">ÖFFNEN ➔</span>
          </button>
        </div>

        {/* Dampening Control Header Rail + View Mode Dropdown: Nadel-Zappel-Bremse */}
        <div id="zeiger-dampen-row" className="relative z-20 w-full max-w-xl mx-auto bg-neutral-900/50 border border-white/5 rounded-2xl p-2.5 px-4 flex flex-col sm:flex-row items-center justify-between gap-3 text-center sm:text-left mb-5 shadow-xl leading-none">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-lg bg-white/5 flex items-center justify-center text-xs">
              🎛️
            </div>
            <div className="flex flex-col text-left">
              <span className="text-[10px] uppercase tracking-[0.12em] text-white/50 font-extrabold font-mono">Steuerung</span>
              <span className="text-[9px] text-white/35 font-mono mt-0.5">Bremse & Ansicht</span>
            </div>
          </div>
          
          <div className="flex items-center gap-2.5 flex-wrap sm:flex-nowrap">
            {/* Bremse presets */}
            <div className="flex gap-1 bg-neutral-950/85 p-1 rounded-lg border border-white/5 font-mono select-none">
              {SMOOTHING_PRESETS.map((preset) => (
                <button
                  id={`preset-speed-${preset.name.toLowerCase()}`}
                  key={preset.name}
                  onClick={() => setSelectedPreset(preset)}
                  className={`text-[9px] uppercase tracking-wider py-1 px-2.5 rounded transition-all cursor-pointer ${
                    selectedPreset.name === preset.name
                      ? "bg-white text-black font-extrabold shadow-sm"
                      : "text-white/55 hover:text-white hover:bg-white/5"
                  }`}
                  title={preset.description}
                >
                  {preset.name}
                </button>
              ))}
            </div>

            {/* Dynamic Instrument & View Selectable Dropdown Container */}
            <div className="relative font-sans animate-none" ref={displayDropdownRef}>
              <button
                id="view-dropdown-trigger"
                onClick={() => setIsDisplayDropdownOpen(!isDisplayDropdownOpen)}
                className="flex items-center gap-1.5 px-3 py-1 bg-neutral-950/85 hover:bg-neutral-800 border border-white/10 hover:border-white/20 rounded-lg text-[9px] uppercase tracking-wider font-extrabold text-[#F5F5F5] transition-all cursor-pointer select-none"
                title="Wähle Instrument & Ansicht"
              >
                <span>
                  {displayMode === "led-bar" 
                    ? "📊 Studio" 
                    : selectedInstrumentId === "ukulele" 
                    ? "🪕 Ukulele" 
                    : selectedInstrumentId === "guitar12" 
                    ? "🎸₁₂ 12-Saiter" 
                    : "🎸 Gitarre"}
                </span>
                <ChevronDown size={10} className={`text-white/40 transition-transform duration-200 ${isDisplayDropdownOpen ? "rotate-180" : ""}`} />
              </button>

              {isDisplayDropdownOpen && (
                <div className="absolute right-0 mt-1.5 w-44 bg-neutral-950/95 backdrop-blur-md border border-white/10 rounded-lg overflow-hidden shadow-2xl z-50 animate-fade-in pointer-events-auto py-1">
                  <div className="px-3 py-0.5 text-[7.5px] uppercase tracking-wider text-white/35 font-mono font-bold">
                    Instrument
                  </div>
                  <button
                    onClick={() => {
                      setSelectedInstrumentId("guitar");
                      setDisplayMode("soundhole");
                      setIsDisplayDropdownOpen(false);
                    }}
                    className={`w-full text-left px-3 py-1.5 text-[9.5px] uppercase font-bold tracking-wider flex items-center justify-between hover:bg-white/5 transition-all ${
                      displayMode === "soundhole" && selectedInstrumentId === "guitar" ? "text-amber-400 bg-amber-500/5" : "text-white/60"
                    }`}
                  >
                    <span>🎸 Gitarre</span>
                  </button>
                  <button
                    onClick={() => {
                      setSelectedInstrumentId("ukulele");
                      setDisplayMode("soundhole");
                      setIsDisplayDropdownOpen(false);
                    }}
                    className={`w-full text-left px-3 py-1.5 text-[9.5px] uppercase font-bold tracking-wider flex items-center justify-between hover:bg-white/5 transition-all ${
                      displayMode === "soundhole" && selectedInstrumentId === "ukulele" ? "text-amber-400 bg-amber-500/5" : "text-white/60"
                    }`}
                  >
                    <span>🪕 Ukulele</span>
                  </button>
                  <button
                    onClick={() => {
                      setSelectedInstrumentId("guitar12");
                      setDisplayMode("soundhole");
                      setIsDisplayDropdownOpen(false);
                    }}
                    className={`w-full text-left px-3 py-1.5 text-[9.5px] uppercase font-bold tracking-wider flex items-center justify-between hover:bg-white/5 transition-all ${
                      displayMode === "soundhole" && selectedInstrumentId === "guitar12" ? "text-amber-400 bg-amber-500/5" : "text-white/60"
                    }`}
                  >
                    <span>🎸₁₂ 12-Saiter</span>
                  </button>

                  <div className="h-[1px] bg-white/5 my-1" />

                  <div className="px-3 py-0.5 text-[7.5px] uppercase tracking-wider text-white/35 font-mono font-bold">
                    Anzeigemodus
                  </div>
                  <button
                    onClick={() => {
                      setDisplayMode("soundhole");
                      setIsDisplayDropdownOpen(false);
                    }}
                    className={`w-full text-left px-3 py-1.5 text-[9.5px] uppercase font-bold tracking-wider flex items-center justify-between hover:bg-white/5 transition-all ${
                      displayMode === "soundhole" ? "text-amber-400 bg-amber-500/5" : "text-white/60"
                    }`}
                  >
                    <span>🎸 Schallloch</span>
                  </button>
                  <button
                    onClick={() => {
                      setDisplayMode("led-bar");
                      setIsDisplayDropdownOpen(false);
                    }}
                    className={`w-full text-left px-3 py-1.5 text-[9.5px] uppercase font-bold tracking-wider flex items-center justify-between hover:bg-white/5 transition-all ${
                      displayMode === "led-bar" ? "text-amber-400 bg-amber-500/5" : "text-white/60"
                    }`}
                  >
                    <span>📊 Studio (LED)</span>
                  </button>
                </div>
              )}
            </div>

          </div>
        </div>

        {/* Real-time Dynamic dual visualizer layout */}
        <div className="relative z-10 w-full max-w-3xl flex flex-col items-center justify-center gap-6 my-auto px-2">
          
          {/* Main Selected Tuner Visualizer */}
          <div className="flex-1 flex flex-col items-center justify-center w-full min-h-[360px] sm:min-h-[440px]">
            {displayMode === "soundhole" ? (
              /* ==================== ACOUSTIC SOUNDHOLE CALIBRATOR ==================== */
              <div id="soundhole-container" className="relative z-10 flex flex-col items-center justify-center w-full my-auto">
                {/* 90-Degree Rotation Button integrated inside the top left corner of the container area */}
                <button
                  id="soundhole-rotate-btn"
                  onClick={() => setSoundholeRotation((prev) => (prev + 90) % 360)}
                  className="absolute top-2 right-2 z-30 flex items-center gap-1.5 px-3 py-1.5 bg-neutral-950/90 hover:bg-neutral-800 border border-white/10 hover:border-white/20 rounded-full text-[9px] uppercase tracking-wider font-extrabold text-[#F5F5F5] transition-all cursor-pointer select-none active:scale-95 shadow-xl"
                  title="Gitarre drehen / Turn Instrument (90° steps)"
                >
                  <RotateCw size={10} className="text-amber-400" />
                  <span>DREHEN ({soundholeRotation}°)</span>
                </button>

            {/* The Rosette Body container */}
            <div 
              className="relative z-10 w-64 h-64 sm:w-[290px] sm:h-[290px] md:w-[325px] md:h-[325px] rounded-full p-[10px] bg-gradient-to-br from-[#8C5230] via-[#5C3218] to-[#2B1408] shadow-[0_20px_50px_rgba(0,0,0,0.85),inset_0_2px_12px_rgba(255,255,255,0.15)] border border-[#8C5230]/40 flex items-center justify-center select-none transition-all duration-500 ease-out"
              style={{ transform: `rotate(${soundholeRotation}deg)` }}
            >
              
              {/* Wooden Inlaid Concentric Rosette Rings */}
              <div className="absolute inset-4 rounded-full border-4 border-double border-yellow-600/35 pointer-events-none" />
              <div className="absolute inset-7 rounded-full border border-yellow-700/20 pointer-events-none" />
              <div className="absolute inset-[3px] rounded-full border border-black/40 pointer-events-none" />

              {/* Black Soundhole Deep interior cavity */}
              <div className="w-full h-full rounded-full bg-[#030303] relative overflow-hidden flex flex-col items-center justify-center shadow-[inset_0_10px_35px_rgba(0,0,0,0.96)] border-2 border-neutral-950">
                
                {/* Acoustic Strings overlay vertically */}
                <div className={`absolute inset-x-0 top-0 bottom-0 flex justify-between pointer-events-none z-10 ${
                  selectedInstrumentId === "ukulele" 
                    ? "px-16 sm:px-24 md:px-28" 
                    : selectedInstrumentId === "guitar12"
                    ? "px-6 sm:px-10 md:px-12"
                    : "px-10 sm:px-14 md:px-16"
                }`}>
                  {(() => {
                    const stringPositions = tunedGuitarStrings.map((str) => {
                      let thickness = "w-[1.2px] sm:w-[1.5px]";
                      if (selectedInstrumentId === "ukulele") {
                        if (str.number === 3) thickness = "w-[2.4px] sm:w-[2.8px]";
                        else if (str.number === 4) thickness = "w-[1.8px] sm:w-[2.2px]";
                        else if (str.number === 2) thickness = "w-[1.5px] sm:w-[1.8px]";
                        else thickness = "w-[1.1px] sm:w-[1.4px]";
                      } else if (selectedInstrumentId === "guitar12") {
                        const tMap: Record<number, string> = {
                          1: "w-[0.8px] sm:w-[0.9px]",
                          2: "w-[0.8px] sm:w-[0.9px]",
                          3: "w-[1.1px] sm:w-[1.3px]",
                          4: "w-[1.1px] sm:w-[1.3px]",
                          5: "w-[0.8px] sm:w-[0.9px]",
                          6: "w-[1.6px] sm:w-[1.8px]",
                          7: "w-[1.1px] sm:w-[1.2px]",
                          8: "w-[2.2px] sm:w-[2.4px]",
                          9: "w-[1.3px] sm:w-[1.4px]",
                          10: "w-[2.8px] sm:w-[3.0px]",
                          11: "w-[1.6px] sm:w-[1.8px]",
                          12: "w-[3.6px] sm:w-[3.8px]",
                        };
                        thickness = tMap[str.number] || "w-[1.2px] sm:w-[1.5px]";
                      } else {
                        const tMap: Record<number, string> = {
                          1: "w-[0.9px] sm:w-[1.1px]",
                          2: "w-[1.4px] sm:w-[1.7px]",
                          3: "w-[2.0px] sm:w-[2.4px]",
                          4: "w-[2.6px] sm:w-[3.1px]",
                          5: "w-[3.3px] sm:w-[3.9px]",
                          6: "w-[4.2px] sm:w-[5px]",
                        };
                        thickness = tMap[str.number] || "w-[1.2px] sm:w-[1.5px]";
                      }

                      return {
                        num: str.number,
                        label: str.note,
                        pitch: str.pitch,
                        thickness
                      };
                    });

                    const reversedList = [...stringPositions].reverse();

                    if (selectedInstrumentId === "guitar12") {
                      // Group elements of reversedList into pairs of two (6 courses)
                      const courses: (typeof reversedList)[] = [];
                      for (let i = 0; i < reversedList.length; i += 2) {
                        courses.push(reversedList.slice(i, i + 2));
                      }

                      return courses.map((course, courseIdx) => {
                        // Standard 12-string guitars place the thin octave string first (on the left),
                        // followed by the thicker prime/standard string (on the right) for the E, A, D, and G courses.
                        // Reversing each course pair turns search order [thick, thin] into physical [thin, thick] perfectly!
                        const orderedCourse = [...course].reverse();
                        return (
                          <div key={courseIdx} className="h-full flex gap-1.5 sm:gap-2.5 items-stretch relative">
                            {orderedCourse.map((str) => {
                              const isDetected = hasSignal && closestString?.number === str.num;
                              const isBrummtonActive = playingStringNum === str.num;
                              const shouldVibrate = isDetected || isBrummtonActive;

                              let stringColor = "bg-gradient-to-r from-zinc-500 via-zinc-400 to-zinc-600 shadow-[1px_0_1px_rgba(0,0,0,0.4)]";
                              if (shouldVibrate) {
                                stringColor = "bg-gradient-to-r from-yellow-300 via-amber-400 to-yellow-500 shadow-[0_0_10px_rgb(234,179,8),0_0_2px_white]";
                              }

                              const isTrebleLimit = str.num === 1;
                              const isBassLimit = str.num === tunedGuitarStrings.length;

                              return (
                                <div key={str.num} className="h-full flex flex-col items-center relative opacity-85">
                                  {/* Label at bottom with high-contrast visibility and inverse rotation, placed below needle center */}
                                  <div 
                                    className={`absolute top-[80%] font-mono text-[9px] sm:text-[10px] font-bold transition-all duration-300 z-20 ${
                                      isDetected 
                                        ? "text-yellow-400 font-extrabold scale-110 drop-shadow-[0_0_8px_rgba(250,204,21,0.6)]" 
                                        : isTrebleLimit 
                                        ? "text-sky-400 font-extrabold drop-shadow-[0_0_4px_rgba(56,189,248,0.5)]" 
                                        : isBassLimit 
                                        ? "text-orange-400 font-extrabold drop-shadow-[0_0_4px_rgba(251,146,60,0.5)]" 
                                        : "text-amber-100/75 drop-shadow-[0_1px_2px_rgba(0,0,0,0.6)]"
                                    }`}
                                    style={{ transform: `rotate(${-soundholeRotation}deg)` }}
                                  >
                                    {str.pitch}
                                  </div>

                                  <div 
                                    className={`h-full ${str.thickness} ${stringColor} transition-all duration-300 ${shouldVibrate ? "animate-string-vibrate" : ""}`} 
                                  />
                                </div>
                              );
                            })}
                          </div>
                        );
                      });
                    }

                    return reversedList.map((str) => {
                      const isDetected = hasSignal && closestString?.number === str.num;
                      
                      // Check if manual audio bummton is playing this string
                      const isBrummtonActive = playingStringNum === str.num;

                      const shouldVibrate = isDetected || isBrummtonActive;
                      
                      let stringColor = "bg-gradient-to-r from-zinc-500 via-zinc-400 to-zinc-600 shadow-[1px_0_1px_rgba(0,0,0,0.4)]";
                      if (shouldVibrate) {
                        stringColor = "bg-gradient-to-r from-yellow-300 via-amber-400 to-yellow-500 shadow-[0_0_10px_rgb(234,179,8),0_0_2px_white]";
                      }

                      // Coloring difference: High treble vs Low bass
                      const isTrebleLimit = str.num === 1;
                      const isBassLimit = str.num === tunedGuitarStrings.length;

                      return (
                        <div key={str.num} className="h-full flex flex-col items-center relative opacity-80">
                          {/* Label at bottom with high-contrast visibility and inverse rotation, placed below needle center */}
                          <div 
                            className={`absolute top-[80%] font-mono text-[9px] sm:text-[10px] font-bold transition-all duration-300 z-20 ${
                              isDetected 
                                ? "text-yellow-400 font-extrabold scale-110 drop-shadow-[0_0_8px_rgba(250,204,21,0.6)]" 
                                : isTrebleLimit 
                                ? "text-sky-400 font-extrabold drop-shadow-[0_0_4px_rgba(56,189,248,0.5)]" 
                                : isBassLimit 
                                ? "text-orange-400 font-extrabold drop-shadow-[0_0_4px_rgba(251,146,60,0.5)]" 
                                : "text-amber-100/75 drop-shadow-[0_1px_2px_rgba(0,0,0,0.6)]"
                            }`}
                            style={{ transform: `rotate(${-soundholeRotation}deg)` }}
                          >
                            {str.pitch}
                          </div>

                          <div 
                            className={`h-full ${str.thickness} ${stringColor} transition-all duration-300 ${shouldVibrate ? "animate-string-vibrate" : ""}`} 
                          />
                        </div>
                      );
                    });
                  })()}
                </div>

                {/* Subdued content center: Detected Note displayed like a glowing wood burned stamp */}
                <div 
                  className="relative z-20 flex flex-col items-center justify-center text-center select-none pointer-events-none mix-blend-screen transition-transform duration-500 ease-out"
                  style={{ transform: `rotate(${-soundholeRotation}deg)` }}
                >
                  {hasSignal && closestString ? (
                    <div className="flex flex-col items-center">
                      <span className={`text-[85px] sm:text-[105px] md:text-[115px] font-black tracking-tighter leading-none select-none transition-all duration-300 ${
                        isInTune 
                          ? "text-green-400 drop-shadow-[0_0_25px_rgba(34,197,94,0.45)]" 
                          : "text-white/90 drop-shadow-[0_4px_10px_rgba(0,0,0,0.85)]"
                      }`}>
                        {closestString.note}
                        <span className="text-xl sm:text-2xl font-light text-white/40 align-super select-none ml-0.5">
                          {closestString.pitch.replace(closestString.note, "")}
                        </span>
                      </span>
                      <span className={`text-[9px] font-mono tracking-[0.25em] font-bold uppercase -mt-2 ${isInTune ? "text-green-400" : "text-yellow-500/80"}`}>
                        {isInTune ? "STIMMT PERFEKT!" : `${centsDiff > 0 ? "ZU STRAMM" : "ZU SCHLAFF"}`}
                      </span>
                    </div>
                  ) : playingStringNum !== null ? (
                    (() => {
                  const playingStr = tunedGuitarStrings.find(s => s.number === playingStringNum);
                      return playingStr ? (
                        <div className="flex flex-col items-center justify-center">
                          <span className="text-[85px] sm:text-[105px] font-black tracking-tighter text-green-400/90 leading-none drop-shadow-[0_0_20px_rgba(34,197,94,0.35)]">
                            {playingStr.note}
                            <span className="text-xl font-light text-green-400/50 align-super ml-0.5">
                              {playingStr.pitch.replace(playingStr.note, "")}
                            </span>
                          </span>
                          <span className="text-[8px] font-mono tracking-widest text-green-400/70 uppercase font-bold -mt-2">
                            BRUMMTON REFERENZ
                          </span>
                        </div>
                      ) : null;
                    })()
                  ) : (
                    <div className="flex flex-col items-center justify-center py-4">
                      <span className="text-[30px] sm:text-[36px] font-black text-white/10 uppercase italic tracking-wider leading-none select-none">
                        ZUPFEN! 🎸
                      </span>
                      <span className="text-[8px] font-mono tracking-[0.2em] text-white/20 uppercase font-bold mt-1">
                        {isListening ? "HÖRE ZU..." : "STILL"}
                      </span>
                    </div>
                  )}
                </div>

                {/* SVG Overlay: Curved Calibration Grid & Swing Needle Pointer */}
                <svg viewBox="0 0 240 240" className="absolute inset-0 w-full h-full pointer-events-none z-30">
                  {/* Anchor/Pivot points cap near the lower quadrant */}
                  <circle cx="120" cy="180" r="13" className="fill-[#1A1513] stroke-amber-600/80 stroke-2" />
                  <circle cx="120" cy="180" r="5.5" className="fill-amber-500" />

                  {/* Tick Gauge Elements */}
                  {(() => {
                    const elements = [];
                    // From -50 to +50 cents, steps of 5 cents
                    for (let c = -50; c <= 50; c += 5) {
                      const tickAngle = c * 1.35; // maps from -67.5 to +67.5 deg
                      const angleRad = ((90 - tickAngle) * Math.PI) / 180;
                      
                      // Outer radius 122
                      const x1 = 120 + 122 * Math.cos(angleRad);
                      const y1 = 180 - 122 * Math.sin(angleRad);
                      
                      // Inner radius: Much longer ticks for high visibility
                      const isCenter = c === 0;
                      const isMajor = c % 10 === 0;
                      
                      // Center tick is 20px long, major is 15px, minor is 10px
                      const innerRadius = isCenter ? 102 : (isMajor ? 107 : 112);
                      const x2 = 120 + innerRadius * Math.cos(angleRad);
                      const y2 = 180 - innerRadius * Math.sin(angleRad);
                      
                      // Thickness & default opacities scaled up for much clearer presence (Griffs / Balken)
                      let strokeWidthClass = isCenter ? "stroke-[4px]" : (isMajor ? "stroke-[3px]" : "stroke-[2.2px]");
                      
                      // Color categorization - highly visible default colors
                      let tickColorClass = `stroke-red-500/50 ${strokeWidthClass}`;
                      if (isCenter) {
                        tickColorClass = `stroke-green-400 stroke-[4.5px] opacity-80`;
                      } else if (Math.abs(c) <= 3) {
                        tickColorClass = `stroke-green-400/70 ${strokeWidthClass}`;
                      } else if (Math.abs(c) <= 15) {
                        tickColorClass = `stroke-yellow-400/60 ${strokeWidthClass}`;
                      }
                      
                      // Highlight active tick if needle is close - super ultra thick glow
                      const isLit = hasSignal && Math.abs(clampedCents - c) <= 2.5;
                      if (isLit) {
                        if (Math.abs(c) <= 3) {
                          tickColorClass = "stroke-green-400 stroke-[5.5px] drop-shadow-[0_0_12px_#22c55e]";
                        } else if (Math.abs(c) <= 15) {
                          tickColorClass = "stroke-yellow-400 stroke-[5px] drop-shadow-[0_0_10px_#eab308]";
                        } else {
                          tickColorClass = "stroke-red-500 stroke-[5px] drop-shadow-[0_0_10px_#ef4444]";
                        }
                      }
                      
                      elements.push(
                        <line
                          key={c}
                          x1={x1}
                          y1={y1}
                          x2={x2}
                          y2={y2}
                          className={`transition-all duration-75 ease-out ${tickColorClass}`}
                        />
                      );
                    }
                    return elements;
                  })()}

                  {/* Glowing perfect target line in center */}
                  <line 
                    x1="120" 
                    y1="46" 
                    x2="120" 
                    y2="66" 
                    className={`transition-all duration-300 ${
                      hasSignal && isInTune 
                        ? "stroke-green-400 stroke-[5px] drop-shadow-[0_0_12px_#22c55e]" 
                        : "stroke-white/40 stroke-[2.5px]"
                    }`} 
                  />

                  {/* Sweep-Hand Needle Pointer */}
                  {(() => {
                    const needleAngle = hasSignal ? clampedCents * 1.35 : 0;
                    const angleRad = ((90 - needleAngle) * Math.PI) / 180;
                    const len = 112;
                    const targetX = 120 + len * Math.cos(angleRad);
                    const targetY = 180 - len * Math.sin(angleRad);

                    let needleColor = "stroke-amber-400";
                    let glowFilter = "drop-shadow(0 0 6px rgba(245,158,11,0.65))";
                    let beadColor = "#f59e0b";

                    if (hasSignal) {
                      if (isInTune) {
                        needleColor = "stroke-green-400";
                        glowFilter = "drop-shadow(0 0 15px #22c55e) drop-shadow(0 0 5px #22c55e)";
                        beadColor = "#22c55e";
                      } else if (Math.abs(centsDiff) <= 15) {
                        needleColor = "stroke-yellow-400";
                        glowFilter = "drop-shadow(0 0 12px #eab308) drop-shadow(0 0 4px #eab308)";
                        beadColor = "#eab308";
                      } else {
                        needleColor = "stroke-red-500";
                        glowFilter = "drop-shadow(0 0 12px #ef4444) drop-shadow(0 0 4px #ef4444)";
                        beadColor = "#ef4444";
                      }
                    } else {
                      // Quiet state: needle is much more clear/visible (opaque and styled with a crisp color)
                      needleColor = "stroke-white/35";
                      glowFilter = "drop-shadow(0 2px 4px rgba(0,0,0,0.5))";
                      beadColor = "rgba(255,255,255,0.45)";
                    }

                    return (
                      <g style={{ filter: glowFilter }} className="transition-all duration-150 ease-out">
                        {/* Needle line body - Upgraded to stroke-[6px] for bold presence */}
                        <line 
                          x1="120" 
                          y1="180" 
                          x2={targetX} 
                          y2={targetY} 
                          className="stroke-[6px] rounded-full transition-all duration-100 ease-out"
                          stroke={needleColor}
                          strokeLinecap="round"
                        />
                        
                        {/* Highlights core overlay for realistic gloss */}
                        <line 
                          x1="120" 
                          y1="180" 
                          x2={targetX} 
                          y2={targetY} 
                          className="stroke-[1.5px] opacity-80 transition-all duration-100 ease-out"
                          stroke="#ffffff"
                          strokeLinecap="round"
                        />

                        {/* Large glowing needle head bubble bead */}
                        <circle 
                          cx={targetX} 
                          cy={targetY} 
                          r="6.5" 
                          fill={beadColor} 
                          className="stroke-white/35 stroke-[1px] transition-all duration-150"
                        />
                      </g>
                    );
                  })()}
                </svg>

              </div>
            </div>
          </div>
        ) : (
          /* ==================== THE TRADITIONAL HUGE NOTE INDICATOR CONTAINER ==================== */
          <div className="relative z-10 flex flex-col items-center justify-between text-center min-h-[300px] sm:min-h-[380px] md:min-h-[440px] w-full max-w-xl overflow-hidden animate-fade-in gap-5">
            <div className="flex-1 flex flex-col items-center justify-center w-full">
              {hasSignal && closestString ? (
                <div className="flex flex-col items-center justify-center w-full h-full">
                  {/* Massive Bold Character Wrapper with custom fixed heights to prevent jumps */}
                  <div className="h-[140px] sm:h-[190px] md:h-[240px] flex items-center justify-center relative w-full">
                    <div 
                      id="huge-note-indicator" 
                      className={`text-[120px] sm:text-[180px] md:text-[220px] leading-none font-black tracking-tighter transition-all duration-150 ${
                        isInTune 
                          ? "text-green-400 drop-shadow-[0_0_35px_rgba(34,197,94,0.25)]" 
                          : "text-white"
                      }`}
                    >
                      {closestString.note}
                      <span className="text-2xl sm:text-3xl md:text-4xl align-top font-light text-white/35 ml-1 inline-block">
                        {closestString.pitch.replace(closestString.note, "")}
                      </span>
                    </div>
                  </div>
                </div>
              ) : playingStringNum !== null ? (
                (() => {
                  const playingStr = tunedGuitarStrings.find(s => s.number === playingStringNum);
                  return playingStr ? (
                    <div className="flex flex-col items-center justify-center w-full h-full">
                      {/* Massive Bold Character */}
                      <div className="h-[140px] sm:h-[190px] md:h-[240px] flex items-center justify-center relative w-full">
                        <div className="text-[120px] sm:text-[180px] md:text-[220px] leading-none font-black tracking-tighter text-green-400 drop-shadow-[0_0_35px_rgba(34,197,94,0.25)]">
                          {playingStr.note}
                          <span className="text-2xl sm:text-3xl md:text-4xl align-top font-light text-white/35 ml-1 inline-block">
                            {playingStr.pitch.replace(playingStr.note, "")}
                          </span>
                        </div>
                      </div>
                    </div>
                  ) : null;
                })()
              ) : (
                <div className="flex flex-col items-center justify-center w-full h-full animate-pulse-slow">
                  {/* Massive Standby Text Wrapper */}
                  <div className="h-[140px] sm:h-[190px] md:h-[240px] flex items-center justify-center relative w-full">
                    <div className="text-[42px] sm:text-[64px] md:text-[80px] leading-none font-black tracking-tight text-white/20 uppercase italic transition-all duration-300">
                      ZUPF MAL AN! 🎸
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* High-visibility horizontal bar for tuning precision */}
        <div id="shared-horizontal-tuning-bar" className="w-full mt-6">
          {renderHorizontalTuningBar()}
        </div>
      </div>

          {/* New Chromatic Tone Wheel Visualization Section */}
          <div className="flex-none flex items-center justify-center w-full max-w-xl md:max-w-2xl animate-fade-in">
            {renderToneWheel()}
          </div>

        </div>
      </main>

      {/* Footer Interface Sector: Dial + Selector + Drawer Settings */}
      <section className="w-full max-w-3xl mx-auto px-6 sm:px-10 pb-8 sm:pb-12 relative z-10">

        {/* ==================== ADDITIONAL PROFESSIONAL TOOLS TAB SWITCHER ==================== */}
        <div 
          id="additional-tools-tab-switcher" 
          className={
            themeMode === "sunshine" 
              ? "mb-5 bg-[#FAF2D8] border border-[#E6D4B2] rounded-2xl p-1.5 flex flex-col sm:flex-row gap-1.5 select-none z-30 relative shadow-md"
              : themeMode === "park"
              ? "mb-5 bg-[#BBE1B6] border border-[#92B98E] rounded-2xl p-1.5 flex flex-col sm:flex-row gap-1.5 select-none z-30 relative shadow-md"
              : "mb-5 bg-neutral-900/35 border border-white/5 rounded-2xl p-1.5 flex flex-col sm:flex-row gap-1.5 select-none z-30 relative backdrop-blur-md"
          }
        >
          <div className="flex-1 flex flex-wrap gap-1.5">
            {[
              { id: "chord", label: "Akkord-Finder & Bibliothek 📻", icon: <BookOpen size={13} /> },
              { id: "fretboard", label: "Griffbrett & Pentatonik 🏆", icon: <Zap size={13} /> },
              { id: "practice", label: "Metronom & Training ⏱️", icon: <Timer size={13} /> }
            ].map((tabItem) => {
              const isActive = activeFooterTab === tabItem.id;
              let btnClass = "";
              if (isActive) {
                if (themeMode === "sunshine") {
                  btnClass = "bg-amber-600 text-white border-amber-700 font-extrabold shadow-md scale-[1.01]";
                } else if (themeMode === "park") {
                  btnClass = "bg-emerald-700 text-white border-emerald-850 font-extrabold shadow-md scale-[1.01]";
                } else {
                  btnClass = "bg-amber-500 text-neutral-950 border-amber-400 font-extrabold shadow-[0_4px_12px_rgba(245,158,11,0.22)] scale-[1.01]";
                }
              } else {
                if (themeMode === "sunshine") {
                  btnClass = "bg-white/40 text-amber-950 border-white/20 hover:bg-white/80 hover:text-amber-950";
                } else if (themeMode === "park") {
                  btnClass = "bg-white/20 text-emerald-950 border-white/10 hover:bg-white/60 hover:text-emerald-950";
                } else {
                  btnClass = "bg-transparent text-white/50 border-transparent hover:text-white hover:bg-white/5";
                }
              }
              return (
                <button
                  key={tabItem.id}
                  onClick={() => setActiveFooterTab(activeFooterTab === tabItem.id ? null : (tabItem.id as any))}
                  className={`flex-1 min-w-[130px] flex items-center justify-center gap-2 py-2 px-3 sm:px-4 rounded-xl text-[11px] font-bold transition-all duration-300 cursor-pointer border ${btnClass}`}
                >
                  {tabItem.icon}
                  <span>{tabItem.label}</span>
                </button>
              );
            })}
          </div>

          {activeFooterTab && (
            <button
              onClick={() => setActiveFooterTab(null)}
              className={`px-3 py-2 rounded-xl text-[11px] font-mono font-bold transition-all cursor-pointer flex items-center justify-center gap-1 border ${
                themeMode === "sunshine"
                  ? "bg-white/20 hover:bg-white/60 border-amber-900/10 text-amber-900/60 hover:text-amber-950"
                  : themeMode === "park"
                  ? "bg-white/10 hover:bg-white/40 border-emerald-900/10 text-emerald-900/60 hover:text-emerald-950"
                  : "bg-neutral-950/40 hover:bg-neutral-950/85 text-white/30 hover:text-white/80 border-white/5"
              }`}
              title="Alle Zusatz-Werkzeuge einklappen, um Fokus auf Haupttuner zu maximieren"
            >
              <X size={12} />
              <span className="sm:hidden md:inline">Einklappen</span>
            </button>
          )}
        </div>

        {/* Always Visible: HIGH-VISIBILITY HZ + CENTS DETAILS DASHBOARD CARD */}
        <div id="calibration-details-dashboard" className="mb-6 bg-neutral-900/40 border border-white/5 rounded-2xl p-4 sm:p-5 flex justify-around items-center text-center font-mono select-none shadow-lg animate-fade-in">
          <div className="flex-1 flex flex-col items-center">
            <span className="text-white/25 block text-[9px] uppercase tracking-[0.2em] mb-1.5 font-bold">HZ-FREQUENZ 📊</span>
            <span id="live-hertz-frequency" className={`text-base sm:text-lg font-bold tracking-widest uppercase transition-colors ${
              hasSignal && isInTune ? "text-green-500" : "text-white/80"
            }`}>
              {hasSignal 
                ? `${frequency.toFixed(2)} Hz` 
                : playingStringNum !== null 
                  ? `${tunedGuitarStrings.find(s => s.number === playingStringNum)?.frequency.toFixed(2)} Hz` 
                  : "---"
              }
            </span>
          </div>

          <div className="w-[1px] bg-white/10 self-stretch my-1" />

          <div className="flex-1 flex flex-col items-center">
            <span className="text-white/25 block text-[9px] uppercase tracking-[0.2em] mb-1.5 font-bold">ABWEICHUNG 🎯</span>
            <span id="live-cents-deviation" className={`text-xs sm:text-sm font-sans font-extrabold tracking-wider transition-colors uppercase ${
              hasSignal 
                ? isInTune 
                  ? "text-green-400" 
                  : Math.abs(centsDiff) <= 15 
                    ? "text-yellow-400" 
                    : "text-red-400" 
                : "text-white/30"
            }`}>
              {hasSignal 
                ? centsDiff === 0 
                  ? "STIMMT PERFEKT! 🤘" 
                  : `${Math.abs(centsDiff).toFixed(1)} Cent ${centsDiff > 0 ? "zu stramm" : "zu schlaff"}`
                : playingStringNum !== null 
                  ? "REFERENZTON" 
                  : isListening 
                    ? "HÖRE ZU..." 
                    : "STUMM"
              }
            </span>
          </div>
        </div>

        {activeFooterTab === "chord" && (
          <div className="animate-fade-in">
            {/* ==================== INTERACTIVE CHORD DISPLAY ==================== */}
            <div id="chord-display-container" className="bg-neutral-900/40 border border-white/5 rounded-2xl p-4 sm:p-5 flex flex-col md:flex-row items-stretch gap-6 justify-between shadow-xl">
          <div className="flex-1 flex flex-col w-full justify-between">
            <div>
              <div className="flex justify-between items-center mb-4">
                <div>
                  <h4 className="text-xs uppercase tracking-[0.2em] text-white/40 font-bold flex items-center gap-1.5">
                    <Zap size={11} className={`text-amber-500 ${!selectedChord ? "animate-pulse" : ""}`} />
                    <span>Akkord-Bibliothek & Freies Lauschen 📻</span>
                  </h4>
                  <p className="text-[10px] text-white/20 mt-0.5 font-mono">
                    {selectedChord 
                      ? `Du hast den Akkord ${selectedChord.name} gewählt. Drücke "Freies Lauschen ↺" für automatische Erkennung!`
                      : "FREIES LAUSCHEN AKTIV — Spiele Töne oder wähle einen Akkord aus!"
                    }
                  </p>
                </div>
                
                <div className="flex gap-2">
                  {selectedChord && (
                    <button 
                      id="reset-chord-free-listening"
                      onClick={() => {
                        setSelectedChord(null);
                        setTargetStringLock(null);
                        stopReferencePitch();
                      }}
                      className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-full bg-white/10 hover:bg-white/20 border border-white/10 text-white/90 text-[10px] font-bold tracking-wider uppercase transition-all shadow-md cursor-pointer select-none"
                      title="Setze Akkordwahl zurück, um frei zu lauschen"
                    >
                      <RefreshCw size={11} className="text-emerald-400" />
                      <span>Freies Lauschen ↺</span>
                    </button>
                  )}
                  
                  {selectedChord ? (
                    <button 
                      id="play-strum-chord"
                      onClick={() => playChord(selectedChord)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-amber-600 hover:bg-amber-500 text-white text-[10px] font-bold tracking-wider uppercase transition-all shadow-md shadow-amber-900/30 cursor-pointer"
                    >
                      <Volume2 size={11} />
                      <span>Anschlagen 🔊</span>
                    </button>
                  ) : (
                    <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-950/25 text-emerald-400 border border-emerald-500/25 text-[10px] font-bold tracking-wider uppercase">
                      <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                      <span>Lauschen... 📻</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Categorization Tabs */}
              <div className="flex flex-wrap gap-1 bg-black/40 p-1 rounded-lg border border-white/5 mb-3">
                {[
                  { id: "all", label: "Alle" },
                  { id: "basis", label: "Grund" },
                  { id: "7th", label: "7er" },
                  { id: "barre", label: "Barré" },
                  { id: "sus", label: "Sus-Akkorde" },
                  { id: "dim", label: "Dim / Verm." },
                  { id: "caged", label: "📦 CAGED System 💡" },
                  { id: "pentatonic", label: "✨ Pentatonik Workstation 🏆" }
                ].map((tab) => {
                  const isSpecial = tab.id === "pentatonic" || tab.id === "caged";
                  const isPentatonic = tab.id === "pentatonic";
                  const isCaged = tab.id === "caged";
                  return (
                    <button
                      key={tab.id}
                      onClick={() => setChordFilter(tab.id as any)}
                      className={`text-[10px] font-mono py-1 px-2.5 rounded transition-all select-none cursor-pointer border ${
                        chordFilter === tab.id
                          ? isSpecial
                            ? isCaged
                              ? "bg-blue-500/25 text-blue-300 font-extrabold border-blue-500 shadow-[0_0_12px_rgba(59,130,246,0.4)]"
                              : "bg-amber-500/25 text-yellow-300 font-extrabold border-amber-500 shadow-[0_0_12px_rgba(245,158,11,0.4)]"
                            : "bg-white/10 text-amber-400 font-bold border-transparent"
                          : isSpecial
                            ? isCaged
                              ? "bg-blue-950/30 border-blue-900/40 text-blue-400/90 hover:text-blue-300 hover:bg-blue-900/30 font-bold"
                              : "bg-amber-950/30 border-amber-900/40 text-amber-400/90 hover:text-amber-300 hover:bg-amber-900/30 animate-pulse"
                            : "text-white/45 border-transparent hover:text-white hover:bg-white/5"
                      }`}
                    >
                      {tab.label}
                    </button>
                  );
                })}
              </div>

              {/* Grid of Chord Buttons or Workbenches */}
              {chordFilter === "pentatonic" ? (
                <div id="pentatonic-workstation" className="flex flex-col gap-4 bg-black/30 p-4 border border-white/5 rounded-2xl shadow-inner w-full">
                  {/* 1. Grundton / Key selection */}
                  <div className="flex flex-col gap-1.5">
                    <span className="text-[9px] uppercase font-mono font-bold tracking-wider text-white/30">1. Grundton (Key):</span>
                    <div className="flex flex-wrap gap-1">
                      {["C", "D", "E", "F", "G", "A", "H"].map((k) => (
                        <button
                          key={k}
                          onClick={() => setPentatonicKey(k)}
                          className={`px-3 py-1.5 rounded-lg text-[10px] font-mono font-black transition-all cursor-pointer ${
                            pentatonicKey === k
                              ? "bg-amber-500 text-black shadow-md shadow-amber-500/10"
                              : "bg-white/5 text-white/60 hover:text-white hover:bg-white/10"
                          }`}
                        >
                          {k}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* 2. Modus / Scale selection */}
                  <div className="flex flex-col gap-1.5">
                    <span className="text-[9px] uppercase font-mono font-bold tracking-wider text-white/30">2. Modus (Scale Type):</span>
                    <div className="flex gap-1.5">
                      {[
                        { id: "minor", label: "Moll-Pentatonik (Blues/Rock)" },
                        { id: "major", label: "Dur-Pentatonik (Country/Jazz)" },
                      ].map((t) => (
                        <button
                          key={t.id}
                          onClick={() => setPentatonicType(t.id as any)}
                          className={`flex-1 py-1.5 rounded-lg text-[10px] font-sans font-bold transition-all cursor-pointer border ${
                            pentatonicType === t.id
                              ? "bg-amber-500/10 text-amber-400 border-amber-500/50 shadow-inner"
                              : "bg-white/5 text-white/60 border-transparent hover:text-white hover:bg-white/10"
                          }`}
                        >
                          {t.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* 3. Shape selection */}
                  <div className="flex flex-col gap-1.5">
                    <span className="text-[9px] uppercase font-mono font-bold tracking-wider text-white/30">3. Lage / Muster (Box Shape):</span>
                    <div className="grid grid-cols-3 sm:grid-cols-6 gap-1/5 shrink-0">
                      {["1", "2", "3", "4", "5", "extended"].map((s) => (
                        <button
                          key={s}
                          onClick={() => setPentatonicShape(s)}
                          className={`py-1.5 px-1 rounded-lg text-[10px] font-mono font-black transition-all cursor-pointer border ${
                            pentatonicShape === s
                              ? s === "extended"
                                ? "bg-emerald-600/30 border-emerald-500 text-emerald-400 font-extrabold"
                                : "bg-amber-600/25 border-amber-500/50 text-amber-400 font-extrabold"
                              : "bg-white/5 border-transparent text-white/60 hover:text-white hover:bg-white/10"
                          }`}
                        >
                          {s === "extended" ? "Ganzes Neck" : `Box ${s}`}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Fretboard Graphic nested just below Box Shape selection */}
                  <div className={`flex flex-col items-center justify-center py-4 bg-black/40 border border-white/5 rounded-2xl shadow-inner mx-auto w-full transition-all duration-300 animate-fade-in ${
                    pentatonicShape === "extended" ? "max-w-4xl px-2.5" : "max-w-sm"
                  }`}>
                    <div className="flex items-center justify-between w-full px-4 mb-2.5 flex-wrap gap-2">
                      <span className="text-[9.5px] uppercase font-mono font-bold tracking-wider text-amber-400/70">
                        {pentatonicShape === "extended" ? "Visuelles Griffbrett (Ganzes Neck):" : "Visuelles Griffbild (Fretboard Shape):"}
                      </span>
                      
                      {/* Integrated Mirror/Spiegeln button on all pentatonic workstation views */}
                      <button
                        onClick={() => setIsNeckFlipped(prev => !prev)}
                        className={`flex items-center gap-1.5 px-2.5 py-1 border rounded-lg text-[9px] uppercase font-black transition-all cursor-pointer select-none active:scale-[0.98] shadow-md ${
                          isNeckFlipped
                            ? "bg-amber-500/20 border-amber-500/50 text-amber-300"
                            : "bg-neutral-900 hover:bg-neutral-850 border-white/10 hover:border-white/20 text-[#f5f5f5]"
                        }`}
                        title="Gitarrenhals spiegeln (Saitenverlauf von oben nach unten vertauschen)"
                      >
                        <RotateCw size={9} className={`transition-transform duration-300 ${isNeckFlipped ? "rotate-180 text-amber-400" : ""}`} />
                        <span>Spiegeln {isNeckFlipped ? "Aktiv" : "180°"}</span>
                      </button>
                    </div>
                    {pentatonicShape === "extended" ? renderHorizontalFullNeck() : renderFretboardGraphic()}
                  </div>

                  {/* Comprehensive Interactive Theory block */}
                  {(() => {
                    const KEY_SEMITONES: Record<string, number> = {
                      E: 0, F: 1, G: 3, A: 5, H: 7, C: 8, D: 10
                    };
                    const SEMITONE_NAMES = ["E", "F", "F#", "G", "G#", "A", "A#", "H", "C", "C#", "D", "D#"];
                    const SEMITONE_TO_KEY: Record<number, string> = {
                      0: "E", 1: "F", 2: "F#", 3: "G", 4: "G#", 5: "A", 6: "A#", 7: "H", 8: "C", 9: "C#", 10: "D", 11: "D#"
                    };
                    
                    const rootSemi = KEY_SEMITONES[pentatonicKey] ?? 5;
                    const scaleSteps = pentatonicType === "minor" ? [0, 3, 5, 7, 10] : [0, 2, 4, 7, 9];
                    const scaleNotes = scaleSteps.map(offset => {
                      const pitch = (rootSemi + offset) % 12;
                      return SEMITONE_NAMES[pitch];
                    });
                    
                    const parallelSemi = pentatonicType === "minor" ? (rootSemi + 3) % 12 : (rootSemi + 9) % 12;
                    const parallelKey = SEMITONE_TO_KEY[parallelSemi] ?? "C";
                    
                    return (
                      <div className="mt-2.5 pt-3 border-t border-white/5 flex flex-col gap-3.5 font-sans">
                        {/* Dynamic Notes Panel */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          {/* Scale notes */}
                          <div className="bg-black/40 border border-amber-500/10 p-3 rounded-xl flex flex-col gap-1.5">
                            <div className="flex items-center gap-1.5">
                              <span className="text-amber-400 text-xs">🎵</span>
                              <span className="text-[10px] uppercase font-mono font-bold tracking-wider text-amber-300">
                                Die Töne der {pentatonicKey}-{pentatonicType === "minor" ? "Moll" : "Dur"}-Pentatonik:
                              </span>
                            </div>
                            <div className="flex flex-wrap gap-1.5 my-1">
                              {scaleSteps.map((offset, idx) => {
                                const note = scaleNotes[idx];
                                const intervalAbbrev = pentatonicType === "minor"
                                  ? ["1 (Root)", "b3 (Min3)", "4 (P4)", "5 (P5)", "b7 (Min7)"][idx]
                                  : ["1 (Root)", "2 (Maj2)", "3 (Maj3)", "5 (P5)", "6 (Maj6)"][idx];
                                return (
                                  <div key={idx} className="flex flex-col items-center bg-white/5 px-2.5 py-1 rounded-lg border border-white/5 shadow-sm min-w-[55px] flex-1">
                                    <span className="text-xs font-mono font-black text-amber-400">{note}</span>
                                    <span className="text-[8px] font-mono text-white/40 tracking-tight text-center">{intervalAbbrev}</span>
                                  </div>
                                );
                              })}
                            </div>
                            <span className="text-[9.5px] text-white/50 leading-relaxed font-mono">
                              Intervalle: {pentatonicType === "minor" ? "1 - b3(kleine Terz) - 4(Quarte) - 5(Quinte) - b7(Septime)" : "1 - 2(Sekunde) - 3(große Terz) - 5(Quinte) - 6(Sexte)"}
                            </span>
                          </div>

                          {/* Parallel relationship relation */}
                          <div className="bg-black/40 border border-amber-500/10 p-3 rounded-xl flex flex-col justify-between gap-1.5">
                            <div className="flex flex-col gap-1">
                              <div className="flex items-center gap-1.5">
                                <span className="text-amber-400 text-xs">🔄</span>
                                <span className="text-[10px] uppercase font-mono font-bold tracking-wider text-yellow-100">
                                  Parallel-Verbindung (Relation)
                                </span>
                              </div>
                              <p className="text-[10px] text-white/70 leading-relaxed">
                                {pentatonicType === "minor" ? (
                                  <>
                                    Die <strong>{pentatonicKey}-Moll-Pentatonik</strong> teilt sich exakt dieselben Töne mit der parallelen <strong>{parallelKey}-Dur-Pentatonik</strong> ({scaleNotes.join(", ")}). Beide verwenden identische Muster auf dem Griffbrett! Der einzige Unterschied ist der klangliche Fokuspunkt (tonales Zentrum).
                                  </>
                                ) : (
                                  <>
                                    Die <strong>{pentatonicKey}-Dur-Pentatonik</strong> teilt sich exakt dieselben Töne mit der parallelen <strong>{parallelKey}-Moll-Pentatonik</strong> ({scaleNotes.join(", ")}). Du kannst alle Box-Muster für beide Tonarten verwenden, indem du den Grundton-Fokus verschiebst!
                                  </>
                                )}
                              </p>
                            </div>
                            <div className="text-[9px] font-mono text-amber-300 bg-amber-950/20 px-2 py-1 rounded border border-amber-800/10">
                              💡 Pro-Tipp: Improvisiere über {pentatonicType === "minor" ? `${parallelKey}-Dur` : `${parallelKey}-Moll`} Musikstücke einfach mit dieser Skala!
                            </div>
                          </div>
                        </div>

                        {/* Interactive Deep Theory: Moll vs Dur Explanations */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          {/* Moll explanation box */}
                          <div className="bg-neutral-900/40 p-3.5 rounded-xl border border-white/5 flex flex-col gap-1.5">
                            <div className="flex items-center gap-1.5">
                              <span className="text-amber-400 text-[10px]">🖤</span>
                              <span className="text-[10.5px] font-bold text-red-300 font-mono">Die Moll-Pentatonik (Minor Pentatonic)</span>
                            </div>
                            <p className="text-[10px] text-white/70 leading-relaxed">
                              Die Moll-Pentatonik entfaltet einen <strong>erdigen, melancholischen und ungemein kraftvollen Blues/Rock-Charakter</strong>. Dadurch, dass die unruhigen Halbtonschritt-Intervalle ausgeklammert sind (keine kleine Sekunde, keine kleine Sexte), gibt es absolut keine reibenden Dissonanzen. Man nennt sie auch die "Zauberskala" für Solisten.
                            </p>
                            <div className="p-1 px-2 rounded bg-black/30 font-mono text-[8px] text-white/50 w-fit">
                              🎸 <strong>Stilrichtung:</strong> Blues, Hard Rock, Blues Rock, Heavy Metal & Soul.
                            </div>
                          </div>

                          {/* Dur explanation box */}
                          <div className="bg-neutral-900/40 p-3.5 rounded-xl border border-white/5 flex flex-col gap-1.5">
                            <div className="flex items-center gap-1.5">
                              <span className="text-amber-400 text-[10px]">☀️</span>
                              <span className="text-[10.5px] font-bold text-emerald-300 font-mono">Die Dur-Pentatonik (Major Pentatonic)</span>
                            </div>
                            <p className="text-[10px] text-white/70 leading-relaxed">
                              Die Dur-Pentatonik klingt <strong>fröhlich, warm, unbeschwert und süßlich</strong>. Sie lässt die reibenden Halbtöne der herkömmlichen Durtonleiter (die 4. und 7. Stufe) aus. Dadurch klingt sie extrem geschmeidig, flüssig und optimistisch, ohne dass jemals ein Ton "falsch" klingt.
                            </p>
                            <div className="p-1 px-2 rounded bg-black/30 font-mono text-[8px] text-white/50 w-fit">
                              🤠 <strong>Stilrichtung:</strong> Country, Pop, Folk, Southern Rock, Southern Blues & Jazz.
                            </div>
                          </div>
                        </div>

                        {/* Connection of Box Patterns with CAGED */}
                        <div className="bg-blue-950/20 border border-blue-500/10 p-3 rounded-xl flex flex-col gap-2 text-[10px] text-white/75 leading-relaxed">
                          <div className="flex items-center gap-2 text-blue-300 font-semibold font-mono">
                            <span>📐</span>
                            <span>Die unschlagbare Brücke: 5 Pentatonik-Boxen & das CAGED-System</span>
                          </div>
                          <p>
                            Jede Pentatonik erstrechnet sich über das gesamte Griffbrett und wiederholt sich in <strong>5 Lagen-Mustern (Boxen)</strong>. Jede dieser Boxen korrespondiert direkt mit einer offenen Akkordform aus dem <strong>CAGED-System</strong>! Beherrschst du also eine Pentatonik-Box, kennst du automatisch das Solo-Muster rund um den zugehörigen Barré-Akkord:
                          </p>
                          <div className="grid grid-cols-2 sm:grid-cols-5 gap-1.5 mt-1 pt-1.5 border-t border-white/5 text-[9px] font-mono text-center">
                            <div className="p-1 rounded bg-black/25 border border-white/5"><strong className="text-amber-400">Box 1:</strong> G/E-Form-Akkorde</div>
                            <div className="p-1 rounded bg-black/25 border border-white/5"><strong className="text-amber-400">Box 2:</strong> D-Form-Akkorde</div>
                            <div className="p-1 rounded bg-black/25 border border-white/5"><strong className="text-amber-400">Box 3:</strong> C-Form-Akkorde</div>
                            <div className="p-1 rounded bg-black/25 border border-white/5"><strong className="text-amber-400">Box 4:</strong> A-Form-Akkorde</div>
                            <div className="p-1 rounded bg-black/25 border border-white/5"><strong className="text-amber-400">Box 5:</strong> G-Form-Akkorde</div>
                          </div>
                        </div>
                      </div>
                    );
                  })()}
                </div>
              ) : chordFilter === "caged" ? (
                <div id="caged-system-workstation" className="flex flex-col gap-4 bg-black/40 p-4 border border-blue-500/10 rounded-2xl shadow-inner w-full">
                  {/* Info Header */}
                  <div className="flex flex-col gap-1 p-2.5 rounded-xl bg-blue-950/25 border border-blue-500/20">
                    <span className="text-[10px] uppercase font-mono font-bold tracking-wider text-blue-300">📦 DAS INTERAKTIVE CAGED-SYSTEM GIG-TOOL 💡</span>
                    <p className="text-[10.5px] text-white/70 font-sans leading-relaxed">
                      Das CAGED-System teilt das Gitarrengriffbrett in <strong>5 verschiebbare offene Grundakkordformen</strong> (C, A, G, E und D) auf. Wähle einen Grundton und die gewünschte Form, um das Griffbild zu erzeugen und anzuschlagen!
                    </p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Column 1: Root Tone */}
                    <div className="flex flex-col gap-2">
                      <span className="text-[9.5px] uppercase font-mono font-bold tracking-wider text-white/35">1. Grundton des Akkords (Root Key):</span>
                      <div className="flex flex-wrap gap-1.5">
                        {["C", "D", "E", "G", "A"].map((k) => (
                          <button
                            key={k}
                            onClick={() => setCagedRoot(k)}
                            className={`px-3.5 py-2 rounded-xl text-[10.5px] font-mono font-black transition-all cursor-pointer ${
                              cagedRoot === k
                                ? "bg-blue-500 text-white shadow-md shadow-blue-500/25 border-transparent font-extrabold"
                                : "bg-white/5 text-white/60 border border-white/5 hover:text-white hover:bg-white/10"
                            }`}
                          >
                            {k}-Dur
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Column 2: Shape */}
                    <div className="flex flex-col gap-2">
                      <span className="text-[9.5px] uppercase font-mono font-bold tracking-wider text-white/35">2. CAGED-Barré-Akkordform (Shape):</span>
                      <div className="flex flex-wrap gap-1.5">
                        {["C", "A", "G", "E", "D"].map((s) => (
                          <button
                            key={s}
                            onClick={() => setCagedShape(s)}
                            className={`px-3.5 py-2 rounded-xl text-[10.5px] font-mono font-black transition-all cursor-pointer border ${
                              cagedShape === s
                                ? "bg-blue-600/30 border-blue-500 text-blue-300 shadow-md shadow-blue-500/10 font-extrabold"
                                : "bg-white/5 border-transparent text-white/60 hover:text-white hover:bg-white/10"
                            }`}
                          >
                            {s}-Form
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Dynamic Explanation block */}
                  <div className="mt-1 p-2.5 rounded-xl bg-black/40 border border-white/5 font-mono text-[10px] text-white/60 leading-relaxed min-h-16 flex items-center">
                    <div className="flex gap-2.5 items-start">
                      <span className="text-blue-400 text-xs">ℹ️</span>
                      <span>
                        <strong className="text-white/80">{cagedRoot}-Dur in der {cagedShape}-Form:</strong>{" "}
                        {(() => {
                          switch (cagedShape) {
                            case "C":
                              return `Hier greifst du die offene C-Dur-Form nach oben verschoben. Der Grundton liegt auf der A-Saite im ${cagedRoot === "D" ? "5." : cagedRoot === "E" ? "7." : cagedRoot === "G" ? "10." : cagedRoot === "A" ? "12." : "3."} Bund (${cagedRoot}).`;
                            case "A":
                              return `Hier greifst du die offene A-Dur-Form nach oben verschoben. Der Grundton liegt auf der A-Saite im ${cagedRoot === "C" ? "3." : cagedRoot === "D" ? "5." : cagedRoot === "E" ? "7." : cagedRoot === "G" ? "10." : "0."} Bund (${cagedRoot}). ${cagedRoot === "D" ? "Dies ist deine gesuchte D-Dur A-Form!" : ""}`;
                            case "G":
                              return `Hier greifst du die offene G-Dur-Form nach oben verschoben. Der Grundton liegt auf der tiefen E-Saite im ${cagedRoot === "C" ? "8." : cagedRoot === "D" ? "10." : cagedRoot === "E" ? "12." : cagedRoot === "A" ? "5." : "3."} Bund (${cagedRoot}).`;
                            case "E":
                              return `Hier greifst du die offene E-Dur-Form nach oben verschoben (Klassischer Barré-Griff). Der Grundton liegt auf der tiefen E-Saite im ${cagedRoot === "C" ? "8." : cagedRoot === "D" ? "10." : cagedRoot === "G" ? "3." : cagedRoot === "A" ? "5." : "0."} Bund (${cagedRoot}).`;
                            case "D":
                              return `Hier greifst du die offene D-Dur-Form nach oben verschoben. Der Grundton liegt auf der D-Saite im ${cagedRoot === "C" ? "10." : cagedRoot === "G" ? "5." : cagedRoot === "A" ? "7." : cagedRoot === "E" ? "2." : "0."} Bund (${cagedRoot}).`;
                            default:
                              return "";
                          }
                        })()}{" "}
                        {cagedRoot === "D" && cagedShape === "A" ? "💡 Perfekt, genau dieses gesuchte Griffbild zeigt das Diagramm rechts!" : ""}
                      </span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-1.5 w-full">
                  {filteredChords.map((chord) => {
                    const isCurrent = selectedChord && selectedChord.name === chord.name;
                    return (
                      <div key={chord.name} className="contents">
                        <button
                          id={`chord-btn-${chord.name.toLowerCase().replace(" ", "-").replace("#", "sharp")}`}
                          onClick={() => {
                            if (isCurrent) {
                              setSelectedChord(null); // click again to collapse/toggle if selected!
                            } else {
                              setSelectedChord(chord);
                              playChord(chord); // Automatically strum on select for great UX
                            }
                          }}
                          className={`text-[11px] font-bold uppercase py-1.5 rounded-lg border transition-all text-center cursor-pointer select-none ${
                            isCurrent
                              ? "bg-amber-600/20 border-amber-500 text-amber-400 font-black shadow-inner shadow-amber-950/40"
                              : "border-white/5 bg-white/5 text-white/60 hover:text-white hover:bg-white/10"
                          }`}
                        >
                          {chord.name}
                        </button>
                        {isCurrent && (
                          <div className="col-span-2 sm:col-span-4 md:col-span-full bg-neutral-950/45 border border-amber-500/20 rounded-xl p-3 sm:p-4 flex flex-col md:flex-row items-center justify-between gap-4 w-full my-2 animate-fade-in relative z-10 shadow-lg shadow-black/10">
                            <div className="flex-1 flex flex-col gap-2.5 w-full text-left">
                              <div className="flex items-center justify-between border-b border-white/5 pb-2">
                                <span className="text-[11px] font-mono text-amber-400 font-black uppercase tracking-wider flex items-center gap-1.5">
                                  <Zap size={11} className="text-amber-500 animate-bounce" />
                                  <span>Akkord-Profil: {chord.name}</span>
                                </span>
                                <span className="text-[9px] font-mono text-white/30 truncate hidden sm:inline">
                                  Interaktives Diagramm direkt darunter ⚡
                                </span>
                              </div>
                              
                              <div className="flex flex-col gap-1.5 text-[10px] font-mono">
                                <div className="flex flex-wrap items-center gap-2 text-white/35">
                                  <span className="font-bold text-white/45">Begleitende Saitenlegung:</span>
                                  <span className="bg-white/5 px-2 py-0.5 rounded text-white/60 border border-white/10">
                                    {chord.multiNotes ? (
                                      chord.multiNotes.map((m) => {
                                        const stringLabels = ["E/6", "A/5", "D/4", "G/3", "H/2", "E/1"];
                                        return `${stringLabels[m.stringIdx]}:${m.frets.join(",")}`;
                                      }).join(" | ")
                                    ) : (
                                      chord.frets.map((f, i) => {
                                        const stringLabels = ["E/6", "A/5", "D/4", "G/3", "H/2", "E/1"];
                                        return `${stringLabels[i]}:${f}`;
                                      }).join(" | ")
                                    )}
                                  </span>
                                </div>
                                
                                {chord.rootStringIdx !== undefined && (
                                  <div className="text-amber-400 font-extrabold bg-amber-400/10 px-2 py-1 rounded border border-amber-400/20 w-fit flex items-center gap-1.5 mt-1">
                                    <span className="w-1.5 h-1.5 rounded-full bg-amber-400 inline-block drop-shadow-[0_0_4px_#f59e0b]" />
                                    <span>Grundton auf Saite {6 - chord.rootStringIdx}: Bund {chord.frets[chord.rootStringIdx]}</span>
                                  </div>
                                )}
                              </div>

                              <div className="flex items-center gap-2 mt-2">
                                <button
                                  onClick={() => playChord(chord)}
                                  className="px-3 py-1.5 bg-amber-600 hover:bg-amber-500 text-white font-mono text-[10px] rounded-lg cursor-pointer flex items-center gap-1.5 uppercase font-bold transition-all shadow-md shadow-amber-900/20 hover:scale-102 active:scale-98"
                                >
                                  <Volume2 size={11} />
                                  <span>Anschlagen 🔊</span>
                                </button>
                                <button
                                  onClick={() => setSelectedChord(null)}
                                  className="px-2.5 py-1.5 bg-white/5 border border-white/5 hover:bg-white/10 hover:border-white/10 text-white/50 hover:text-white rounded-lg text-[10px] font-bold uppercase transition-all"
                                >
                                  Schließen ✕
                                </button>
                              </div>
                            </div>
                            
                            {/* Embedded Visualizer */}
                            <div className="shrink-0 flex items-center justify-center bg-black/30 p-2 rounded-xl border border-white/5 scale-95 origin-center">
                              {renderFretboardGraphic()}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
            
            <div className="mt-4 flex flex-wrap gap-2 text-[10px] items-center text-white/35 font-mono">
              <span className="font-bold uppercase tracking-wider text-white/50">Details:</span>
              {selectedChord ? (
                <>
                  <span>{selectedChord.multiNotes ? "Tonleiter Töne (Saiten frets):" : "Saiten (von links nach rechts):"}</span>
                  <span className="bg-white/5 px-2 py-0.5 rounded text-white/60 border border-white/10">
                    {selectedChord.multiNotes ? (
                      selectedChord.multiNotes.map((m) => {
                        const stringLabels = ["E/6", "A/5", "D/4", "G/3", "H/2", "E/1"];
                        return `${stringLabels[m.stringIdx]}:${m.frets.join(",")}`;
                      }).join(" | ")
                    ) : (
                      selectedChord.frets.map((f, i) => {
                        const stringLabels = ["E/6", "A/5", "D/4", "G/3", "H/2", "E/1"];
                        return `${stringLabels[i]}:${f}`;
                      }).join(" | ")
                    )}
                  </span>
                  {selectedChord.rootStringIdx !== undefined && (
                    <span className="text-amber-400 font-extrabold bg-amber-400/10 px-2 py-0.5 rounded border border-amber-400/20 flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-400 inline-block drop-shadow-[0_0_4px_#f59e0b]" />
                      <span>Grundton auf E2-Saite: Bund {selectedChord.frets[selectedChord.rootStringIdx]}</span>
                    </span>
                  )}
                </>
              ) : (
                <span className="text-emerald-400 font-semibold bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/15">
                  📻 FREIES LAUSCHEN AKTIV — Spiele deine Gitarre oder wähle oben einen Akkord aus!
                </span>
              )}
            </div>
          </div>

          {/* SVG Fretboard Chord Diagram (Only visible at side in CAGED mode, or if no chord is selected inside standard libraries, avoiding duplicate listings) */}
          {chordFilter !== "pentatonic" && (chordFilter === "caged" || !selectedChord) && (
            <div className="hidden lg:flex items-center justify-center border-l border-white/5 pl-6 shrink-0">
              {renderFretboardGraphic()}
            </div>
          )}
        </div>
      </div>
    )}

        {activeFooterTab === "fretboard" && (
          <div className="animate-fade-in">
            {/* ----------------- GORGEOUS HORIZONTAL FULL NECK PENTATONIC VISUALIZER ----------------- */}
            <div id="horizontal-full-neck-visualizer" className="mt-6 bg-neutral-900/40 border border-white/5 rounded-2xl p-4 sm:p-5 flex flex-col gap-3 shadow-xl select-none animate-fade-in relative z-10">
          <div className="flex flex-col sm:flex-row gap-3 justify-between items-start sm:items-center border-b border-white/5 pb-2.5">
            <div className="flex flex-col sm:flex-row sm:items-center gap-4">
              <div>
                <h5 className="text-[11px] uppercase tracking-[0.15em] text-amber-400 font-extrabold flex items-center gap-1.5 font-mono">
                  <span>Griffbrett-Master-Visualizer 🏆</span>
                </h5>
                <p className="text-[10px] text-white/30 font-mono mt-0.5">
                  Interaktives Gesamt-Diagramm der <strong className="text-white/70">{pentatonicKey}-{pentatonicType === "minor" ? "Moll" : "Dur"}-Pentatonik</strong>. Klicke Töne an, um sie anzuspielen!
                </p>
              </div>

              {chordFilter !== "pentatonic" && (
                <div className="flex items-center gap-1.5 bg-black/40 border border-white/5 rounded-xl px-2 py-1">
                  <span className="text-[9px] font-mono text-white/40 uppercase font-bold">Skala:</span>
                  <select
                    value={pentatonicKey}
                    onChange={(e) => setPentatonicKey(e.target.value)}
                    className="bg-neutral-800 text-amber-400 font-mono font-bold text-[10px] rounded px-1.5 py-0.5 border border-white/10 outline-none cursor-pointer"
                  >
                    {["C", "D", "E", "F", "G", "A", "H"].map(k => (
                      <option key={k} value={k}>{k}</option>
                    ))}
                  </select>
                  <select
                    value={pentatonicType}
                    onChange={(e) => setPentatonicType(e.target.value as any)}
                    className="bg-neutral-800 text-white font-sans font-bold text-[10px] rounded px-1.5 py-0.5 border border-white/10 outline-none cursor-pointer"
                  >
                    <option value="minor">Moll-Pentatonik</option>
                    <option value="major">Dur-Pentatonik</option>
                  </select>
                </div>
              )}
            </div>
            
            {/* Dynamic control buttons with sequence play, and expanded view modal */}
            <div className="flex flex-wrap items-center gap-2 mt-2 sm:mt-0">
              <div className="flex items-center gap-1.5 bg-black/40 border border-white/5 rounded-full px-2.5 py-1 font-mono text-[9px] text-white/40">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                <span>R = Grundton</span>
              </div>

              <button
                onClick={() => {
                  if (isScalePlaying) {
                    stopScaleSequence();
                  } else {
                    playPentatonicSequence();
                  }
                }}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-[9.5px] uppercase tracking-wider font-extrabold transition-all cursor-pointer select-none active:scale-[0.98] ${
                  isScalePlaying
                    ? "bg-red-500/25 border border-red-500/50 text-red-300 animate-pulse"
                    : "bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-amber-300 hover:text-amber-200"
                }`}
                title="Tonleiter automatisch abspielen"
              >
                <span className="text-[10px]">{isScalePlaying ? "⏹" : "▶"}</span>
                <span>{isScalePlaying ? "Stopp" : "Abspielen"}</span>
              </button>

              <button
                onClick={() => setIsExtendedNeckModalOpen(true)}
                className="flex items-center gap-1 px-3 py-1 bg-neutral-800 hover:bg-neutral-700 hover:text-white border border-white/10 hover:border-white/25 rounded-lg text-[9.5px] uppercase tracking-wider font-extrabold text-[#f5f5f5] transition-all cursor-pointer select-none"
                title="Öffne das Griffbrett in einer großen interaktiven Großansicht"
              >
                🔍 Großansicht
              </button>
            </div>
          </div>

          {/* Scrollable fretboard wrapper */}
          <div className="w-full overflow-x-auto pb-1.5 select-none scrollbar-thin">
            <div className="relative min-w-[810px] h-[165px] bg-gradient-to-r from-neutral-950 via-[#1e130a]/80 to-neutral-500/5 rounded-xl p-3 border border-white/5 shadow-inner">
              <svg viewBox="0 0 812 145" className="w-[810px] h-[142px] font-sans">
                {/* Beautiful active scale background watermarks */}
                <g className="pointer-events-none select-none">
                  <text
                    x="395"
                    y="78"
                    textAnchor="middle"
                    alignmentBaseline="middle"
                    className="font-sans font-black text-[96px] fill-amber-500/[0.05] tracking-widest uppercase transition-all duration-300"
                  >
                    {pentatonicKey}
                  </text>
                  <text
                    x="395"
                    y="114"
                    textAnchor="middle"
                    className="font-mono font-black text-[9px] tracking-[0.25em] uppercase fill-amber-500/25"
                  >
                    {pentatonicType === "minor" ? "PENTATONISCHE MOLL-SKALA" : "PENTATONISCHE DUR-SKALA"}
                  </text>
                </g>

                {/* Fret Markers / Inlay dots background layer (Fret 3, 5, 7, 9, 15, 17) */}
                {[3, 5, 7, 9, 15, 17].map(fret => {
                  const x = 30 + fret * 44 - 22;
                  return (
                    <circle
                      key={`marker-${fret}`}
                      cx={x}
                      cy={70}
                      r={5.5}
                      className="fill-white/5 stroke-none pointer-events-none"
                    />
                  );
                })}

                {/* Octave double marker at Fret 12 */}
                {(() => {
                  const x = 30 + 12 * 44 - 22;
                  return (
                    <g key="marker-12" className="pointer-events-none">
                      <circle cx={x} cy={45} r={4.5} className="fill-white/5 stroke-none" />
                      <circle cx={x} cy={95} r={4.5} className="fill-white/5 stroke-none" />
                    </g>
                  );
                })()}

                {/* Horizontal Strings (6 of them) */}
                {[0, 1, 2, 3, 4, 5].map((sIdx) => {
                  const y = 20 + sIdx * 20;
                  const strokeWidths = [1.2, 1.4, 1.8, 2.0, 2.4, 3.0]; // thick low E (3.0), thin high E (1.2)
                  const lineStrokeIdx = isNeckFlipped ? (5 - sIdx) : sIdx;
                  return (
                    <line
                      key={`h-str-${sIdx}`}
                      x1={30}
                      y1={y}
                      x2={778}
                      y2={y}
                      className="stroke-zinc-500/35 pointer-events-none"
                      strokeWidth={strokeWidths[lineStrokeIdx]}
                    />
                  );
                })}

                {/* String name labels on the left of the Nut (E2 to E4 depending on flip state) */}
                {[0, 1, 2, 3, 4, 5].map((sIdx) => {
                  const y = 20 + sIdx * 20;
                  const stringIdx = isNeckFlipped ? sIdx : (5 - sIdx);
                  const getStringLabelDoc = (idx: number) => {
                    switch (idx) {
                      case 0: return { name: "E", color: "fill-red-400 font-extrabold" };
                      case 1: return { name: "A", color: "fill-orange-400 font-extrabold" };
                      case 2: return { name: "D", color: "fill-yellow-400 font-extrabold" };
                      case 3: return { name: "G", color: "fill-emerald-400 font-extrabold" };
                      case 4: return { name: "H", color: "fill-blue-400 font-extrabold" };
                      case 5: return { name: "e", color: "fill-purple-400 font-extrabold" };
                      default: return { name: "", color: "fill-zinc-400" };
                    }
                  };
                  const doc = getStringLabelDoc(stringIdx);
                  return (
                    <g key={`string-label-${sIdx}`} className="pointer-events-none select-none">
                      <rect
                        x={2}
                        y={y - 8}
                        width={20}
                        height={16}
                        rx={4}
                        className="fill-neutral-950/90 stroke stroke-zinc-700/50 stroke-[0.7]"
                      />
                      <text
                        x={12}
                        y={y + 3.5}
                        textAnchor="middle"
                        className={`font-mono text-[9px] font-black ${doc.color}`}
                      >
                        {doc.name}
                      </text>
                    </g>
                  );
                })}

                {/* Vertical Frets (0 to 17) */}
                {Array.from({ length: 18 }).map((_, fIdx) => {
                  const x = 30 + fIdx * 44;
                  const isNut = fIdx === 0;

                  const openStrings = [0, 5, 10, 15, 19, 24];
                  const rootSemitone = KEY_SEMITONES[pentatonicKey] ?? 5;
                  const containsRoot = openStrings.some(openPitch => {
                    const offset = ((openPitch + fIdx - rootSemitone) % 12 + 12) % 12;
                    return offset === 0;
                  });

                  return (
                    <g key={`v-fret-${fIdx}`} className="pointer-events-none">
                      <line
                        x1={x}
                        y1={15}
                        x2={x}
                        y2={125}
                        className={isNut ? "stroke-amber-500/80" : "stroke-zinc-700/50"}
                        strokeWidth={isNut ? 3.5 : 1}
                      />

                      {/* Highlight background rect for fret label if it contains the root note */}
                      {containsRoot && fIdx > 0 && (
                        <rect
                          x={x - 30}
                          y={129}
                          width={16}
                          height={12}
                          rx={4}
                          className="fill-amber-500/15 stroke stroke-amber-500/35 stroke-[0.5]"
                        />
                      )}

                      {/* Fret label */}
                      <text
                        x={isNut ? x - 8 : x - 22}
                        y={138}
                        textAnchor="middle"
                        className={`font-mono text-[8px] font-bold ${
                          containsRoot && fIdx > 0
                            ? "fill-amber-400 font-extrabold"
                            : "fill-white/15"
                        }`}
                      >
                        {fIdx === 0 ? "Nut" : fIdx}
                      </text>
                    </g>
                  );
                })}

                {/* Interactive Note bubbles */}
                {(() => {
                  const openStrings = [0, 5, 10, 15, 19, 24]; // open tuning values from E2 to E4
                  const scaleIntervals = pentatonicType === "minor" ? [0, 3, 5, 7, 10] : [0, 2, 4, 7, 9];
                  const rootSemitone = KEY_SEMITONES[pentatonicKey] ?? 5;

                  return [0, 1, 2, 3, 4, 5].flatMap((sIdx) => {
                    const stringIdx = isNeckFlipped ? sIdx : (5 - sIdx); // 5 matches top string (E4), 0 matches bottom string (E2)
                    const openPitch = openStrings[stringIdx];
                    const y = 20 + sIdx * 20;

                    return Array.from({ length: 18 }).map((_, fret) => {
                      const pitch = openPitch + fret;
                      const offset = ((pitch - rootSemitone) % 12 + 12) % 12;
                      const isScaleNote = scaleIntervals.includes(offset);
                      if (!isScaleNote) return null;

                      const isRoot = offset === 0;
                      const x = fret === 0 ? 15 : 30 + fret * 44 - 22;

                      // Check if this note falls inside the active box shape to highlight it
                      let isHighlighted = false;
                      if (chordFilter !== "pentatonic" || pentatonicShape === "extended") {
                        isHighlighted = true;
                      } else {
                        const activeChord = generatePentatonicChord(pentatonicKey, pentatonicType, pentatonicShape);
                        const activeStringData = activeChord.multiNotes?.find(m => m.stringIdx === stringIdx);
                        if (activeStringData && activeStringData.frets.includes(fret)) {
                          isHighlighted = true;
                        }
                      }

                      return (
                        <g
                          key={`neck-note-${stringIdx}-${fret}`}
                          className="cursor-pointer group/note"
                          onClick={() => playNote(stringIdx, fret)}
                        >
                          {/* Inner circle bubble */}
                          <circle
                            cx={x}
                            cy={y}
                            r={8.5}
                            className={`transition-all duration-200 ${
                              isHighlighted
                                ? isRoot
                                  ? "fill-amber-400 stroke-amber-200 stroke-1 drop-shadow-[0_0_6px_#f59e0b] group-hover/note:scale-110"
                                  : "fill-neutral-900 stroke-amber-500/80 stroke-1.5 group-hover/note:fill-amber-600 group-hover/note:scale-110"
                                : "fill-neutral-950/20 stroke-white/5 stroke-1 opacity-20 group-hover/note:opacity-90 group-hover/note:scale-110 pointer-events-auto"
                            }`}
                          />
                          {/* Inner note labeling */}
                          <text
                            x={x}
                            y={y + 2.5}
                            textAnchor="middle"
                            className={`font-sans text-[7.5px] font-black transition-colors ${
                              isHighlighted
                                ? isRoot
                                  ? "fill-neutral-950 font-black"
                                  : "font-mono fill-white/80 group-hover/note:fill-white"
                                : "font-mono fill-white/20 group-hover/note:fill-white/80"
                            }`}
                          >
                            {isRoot ? pentatonicKey : scaleIntervals.indexOf(offset) + 1}
                          </text>
                          
                          {/* Tap Indicator effect on click/hover */}
                          <circle
                            cx={x}
                            cy={y}
                            r={16}
                            className="fill-none stroke-amber-500/20 stroke-1 scale-0 transition-transform group-hover/note:scale-100 duration-300 pointer-events-none"
                          />
                        </g>
                      );
                    });
                  });
                })()}
              </svg>
            </div>
          </div>

          {/* Bottom helper controls with mirror button */}
          <div className="flex justify-end pt-2 border-t border-white/5 mt-1">
            <button
              onClick={() => setIsNeckFlipped(prev => !prev)}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-[9.5px] uppercase tracking-wider font-extrabold border transition-all cursor-pointer select-none active:scale-[0.98] ${
                isNeckFlipped
                  ? "bg-amber-500/20 border-amber-500/50 text-amber-300"
                  : "bg-neutral-800 hover:bg-neutral-700 hover:text-white border-white/10 hover:border-white/25 text-[#f5f5f5]"
              }`}
              title="Gitarrenhals um 180 Grad vertikal spiegeln (Tiefe E-Saite oben vs. unten)"
            >
              <RotateCw size={10} className={`transition-transform duration-300 ${isNeckFlipped ? "rotate-180 text-amber-400" : ""}`} />
              <span>Spiegeln (180°)</span>
            </button>
          </div>
        </div>

        {/* String Selector Rail */}
        <div 
          id="string-tuner-dock" 
          className="mt-8 grid gap-1.5 sm:gap-3 border-t border-white/10 pt-8"
          style={{ gridTemplateColumns: `repeat(${tunedGuitarStrings.length}, minmax(0, 1fr))` }}
        >
          {[...tunedGuitarStrings].reverse().map((str) => {
            const isActive = hasSignal && closestString?.number === str.number;
            const isLocked = targetStringLock === str.number;
            const isPlaying = playingStringNum === str.number;
            
            return (
              <button
                id={`string-selector-${str.number}`}
                key={str.number}
                onClick={() => {
                  if (targetStringLock === str.number) {
                    setTargetStringLock(null); // release
                    stopReferencePitch(); // stop playback
                  } else {
                    setTargetStringLock(str.number); // enforce lock Focus parameter
                    playReferencePitch(str.frequency, str.number); // synthesize play pitch sound
                  }
                }}
                className={`flex flex-col items-center gap-2 group transition-all duration-200 select-none pb-1 ${
                  isActive || isLocked || isPlaying
                    ? "text-white opacity-100" 
                    : "opacity-30 hover:opacity-75 grayscale"
                }`}
              >
                <div className="flex items-center gap-1 h-5 justify-center">
                  <span className="text-xs sm:text-sm font-black tracking-tight font-sans">
                    {str.pitch}
                  </span>
                  {isPlaying && (
                    <Volume2 size={11} className="text-green-400 animate-pulse shrink-0" />
                  )}
                </div>
                
                {/* Visual Accent representation string bar */}
                <div className={`w-full h-1.5 rounded-full transition-all duration-300 ${
                  isPlaying
                    ? "bg-green-400 shadow-[0_0_12px_#22c55e,0_0_4px_white] animate-pulse"
                    : isActive 
                      ? isInTune 
                        ? "bg-green-400 shadow-[0_0_10px_rgba(34,197,94,0.8)]" 
                        : "bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.7)]"
                      : isLocked 
                        ? "bg-white shadow-[0_0_8px_rgba(255,255,255,0.8)]" 
                        : "bg-white/10 group-hover:bg-white/20"
                }`} />

                {/* String number context underlay */}
                <span className="text-[9px] font-mono text-white/30 lowercase">
                  Saite {str.number}
                </span>

                {/* Dual frequency details underlay */}
                <div className="mt-2 w-full flex flex-col gap-1 font-mono text-[8px] sm:text-[9.5px] tracking-tight leading-none text-left border-t border-white/5 pt-1.5 px-0.5">
                  <div className={`flex justify-between items-center transition-colors ${referenceA4 === 440 ? "text-amber-400 font-extrabold" : "text-white/20"}`}>
                    <span className="text-[7.5px] uppercase text-white/25">440:</span>
                    <span>{currentStrings.find(s => s.number === str.number)!.frequency.toFixed(1)}Hz</span>
                  </div>
                  <div className={`flex justify-between items-center transition-colors ${referenceA4 === 432 ? "text-amber-400 font-extrabold" : "text-white/20"}`}>
                    <span className="text-[7.5px] uppercase text-white/25">432:</span>
                    <span>{(currentStrings.find(s => s.number === str.number)!.frequency * (432/440)).toFixed(1)}Hz</span>
                  </div>
                </div>
              </button>
            );
          })}
        </div>

            {/* Optional Release filter button when manual focus lock on a single string is enabled */}
            {targetStringLock !== null && (
              <div className="flex justify-center mt-4">
                <button
                   id="clear-neck-filter"
                   onClick={() => setTargetStringLock(null)}
                   className="px-3 py-1 bg-white/5 hover:bg-white/10 text-white/50 hover:text-white/80 border border-white/10 rounded-full text-[10px] font-mono uppercase tracking-wider flex items-center gap-1.5 transition-all cursor-pointer"
                >
                  <span>Saiten-Fokus für Saite {targetStringLock} wegschmeißen</span>
                  <RefreshCw size={9} />
                </button>
              </div>
            )}
          </div>
        )}

        {/* ==================== PRACTICE METRONOME & WHATSAPP FEEDBACK GRID ==================== */}
        {activeFooterTab === "practice" && (
          <div className="animate-fade-in">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-2">
          
          {/* ==================== PRACTICE METRONOME CARD ==================== */}
          <div id="metronome-practice-card" className="bg-neutral-900/40 border border-white/5 rounded-2xl p-5 sm:p-6 flex flex-col justify-between gap-4 shadow-xl select-none animate-fade-in relative z-20">
            <div className="border-b border-white/5 pb-3">
              <h4 className="text-xs uppercase tracking-[0.2em] text-white/40 font-bold flex items-center gap-1.5">
                <span className="text-sm">⏱️</span>
                <span>Präzisions-Metronom / Beat Trainer</span>
              </h4>
              <p className="text-[10px] text-white/20 mt-1 font-mono">
                Pulsgeber für perfektes Timing beim Üben. Tippe das Tempo oder nutze den Regler.
              </p>
            </div>

            {/* Quick BPM Control Panel */}
            <div className="flex flex-col items-center gap-3 bg-black/30 p-4 rounded-xl border border-white/5">
              <div className="flex items-baseline gap-2.5">
                <span className="text-[10px] text-white/40 font-mono tracking-widest uppercase mb-1">Tempo:</span>
                <span className="text-3xl font-mono font-black tracking-tight text-amber-400">
                  {metronomeBpm}
                </span>
                <span className="text-[10px] text-white/40 font-mono">BPM</span>
              </div>

              {/* Slider Block */}
              <div className="w-full flex items-center gap-3 px-1">
                <span className="text-[9px] font-mono text-white/25">40</span>
                <input
                  type="range"
                  min="40"
                  max="240"
                  value={metronomeBpm}
                  onChange={(e) => setMetronomeBpm(parseInt(e.target.value))}
                  className="flex-1 accent-amber-500 h-1 bg-white/10 rounded-lg appearance-none cursor-pointer"
                />
                <span className="text-[9px] font-mono text-white/25">240</span>
              </div>

              {/* BPM adjust shortcuts */}
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setMetronomeBpm(prev => Math.max(40, prev - 5))}
                  className="px-2 py-1 text-[9px] font-mono font-semibold bg-white/5 hover:bg-white/10 border border-white/5 hover:border-white/10 rounded text-white/60 hover:text-white cursor-pointer"
                >
                  -5
                </button>
                <button
                  type="button"
                  onClick={() => setMetronomeBpm(prev => Math.max(40, prev - 1))}
                  className="px-2 py-1 text-[9px] font-mono font-semibold bg-white/5 hover:bg-white/10 border border-white/5 hover:border-white/10 rounded text-white/60 hover:text-white cursor-pointer"
                >
                  -1
                </button>
                <button
                  type="button"
                  onClick={() => setMetronomeBpm(prev => Math.min(240, prev + 1))}
                  className="px-2 py-1 text-[9px] font-mono font-semibold bg-white/5 hover:bg-white/10 border border-white/5 hover:border-white/10 rounded text-white/60 hover:text-white cursor-pointer"
                >
                  +1
                </button>
                <button
                  type="button"
                  onClick={() => setMetronomeBpm(prev => Math.min(240, prev + 5))}
                  className="px-2 py-1 text-[9px] font-mono font-semibold bg-white/5 hover:bg-white/10 border border-white/5 hover:border-white/10 rounded text-white/60 hover:text-white cursor-pointer"
                >
                  +5
                </button>
              </div>
            </div>

            {/* Visual Beat Track + Interactive Trigger */}
            <div className="flex items-center justify-between gap-4 pt-1">
              {/* Trigger Metronome Buttons */}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsMetronomePlaying(!isMetronomePlaying)}
                  className={`px-5 py-2.5 rounded-xl text-xs font-mono font-black uppercase tracking-wider transition-all shadow-md cursor-pointer flex items-center gap-1.5 ${
                    isMetronomePlaying
                      ? "bg-red-500 hover:bg-red-400 text-neutral-950 shadow-[0_4px_14px_rgba(239,68,68,0.25)] active:scale-[0.98]"
                      : "bg-amber-500 hover:bg-amber-400 text-neutral-950 shadow-[0_4px_14px_rgba(245,158,11,0.25)] active:scale-[0.98]"
                  }`}
                >
                  {isMetronomePlaying ? (
                    <>
                      <Pause size={12} className="fill-current" />
                      <span>STOP</span>
                    </>
                  ) : (
                    <>
                      <Play size={12} className="fill-current ml-0.5" />
                      <span>START</span>
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={handleTapTempo}
                  className="px-4 py-2.5 bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/15 text-white/80 active:scale-95 transition-all rounded-xl text-xs font-mono font-bold tracking-wide cursor-pointer"
                  title="Tippe das Tempo im Beat, um das BPM-Zahl automatisch zu ermitteln"
                >
                  ⏳ TAP
                </button>
              </div>

              {/* Visual Beat Dot Row */}
              <div className="flex items-center gap-1.5 bg-black/20 px-3 py-2 rounded-xl border border-white/5">
                {[1, 2, 3, 4].map((b) => {
                  const isActive = metronomeBeat === b;
                  return (
                    <div
                      key={b}
                      className={`relative w-6 h-6 rounded-md border transition-all duration-100 flex items-center justify-center ${
                        isActive
                          ? b === 1
                            ? "bg-red-500 border-red-400 scale-110 shadow-[0_0_8px_#ef4444]"
                            : "bg-amber-500 border-amber-400 scale-110 shadow-[0_0_8px_#f59e0b]"
                          : "bg-neutral-950/45 border-white/10"
                      }`}
                    >
                      <span className={`text-[9px] font-bold font-mono transition-colors flex items-center justify-center ${isActive ? "text-neutral-950" : "text-white/40"}`}>
                        {b}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* ==================== WHATSAPP FEEDBACK AREA ==================== */}
          <div id="whatsapp-feedback-card" className="bg-neutral-900/40 border border-white/5 rounded-2xl p-5 sm:p-6 flex flex-col justify-between gap-4 shadow-xl select-none animate-fade-in relative z-20">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 border-b border-white/5 pb-3">
              <div>
                <h4 className="text-xs uppercase tracking-[0.2em] text-white/40 font-bold flex items-center gap-1.5">
                  <span className="text-sm">💬</span>
                  <span>Feedback & Vorschläge / Recommendations</span>
                </h4>
                <p className="text-[10px] text-white/20 mt-1 font-mono">
                  Wähle eine Vorlage oder tippe eigenes Feedback ein, um den grünen WhatsApp-Button freizuschalten.
                </p>
              </div>
            </div>

            {/* Feedback Presets Buttons */}
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setWhatsappMessage("Hallo! Der Tuner ist super präzise, besonders der neue 12-Saiter Modus funktioniert echt hervorragend! 🎸⭐")}
                className="px-3 py-1.5 rounded-full bg-emerald-950/40 hover:bg-emerald-950/60 border border-emerald-500/20 hover:border-emerald-500/45 text-emerald-300 text-[10px] font-bold tracking-wide transition-all cursor-pointer flex items-center gap-1"
              >
                <span>👍 Super präzise (Gut)</span>
              </button>
              <button
                type="button"
                onClick={() => setWhatsappMessage("Hi! Ich würde mir als Verbesserung einen integrierten Drum-Groove, ein Metronom und mehr Stimmungs-Presets wie Drop-D oder Open-G wünschen! 🥁")}
                className="px-3 py-1.5 rounded-full bg-blue-950/40 hover:bg-blue-950/60 border border-blue-500/20 hover:border-blue-500/45 text-blue-300 text-[10px] font-bold tracking-wide transition-all cursor-pointer flex items-center gap-1"
              >
                <span>💡 Verbesserungsvorschläge</span>
              </button>
              <button
                type="button"
                onClick={() => setWhatsappMessage("Hallo, ich habe festgestellt, dass der Tuner manchmal bei extrem tiefen Bassfrequenzen oder Nebengeräuschen etwas unruhig reagiert. 🔍")}
                className="px-3 py-1.5 rounded-full bg-red-950/40 hover:bg-red-950/60 border border-red-500/20 hover:border-red-500/45 text-red-300 text-[10px] font-bold tracking-wide transition-all cursor-pointer flex items-center gap-1"
              >
                <span>👎 Optimierungspotenzial (Kritik)</span>
              </button>
            </div>

            {/* Simple textbox preview and manual editing */}
            <div className="relative">
              <textarea
                value={whatsappMessage}
                onChange={(e) => setWhatsappMessage(e.target.value)}
                placeholder="Schreibe dein Feedback hier hinein..."
                className="w-full h-20 bg-black/40 border border-white/10 rounded-xl p-3 text-xs text-white placeholder-white/20 focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/20 transition-all font-sans resize-none"
              />
              {whatsappMessage.trim() && (
                <button
                  type="button"
                  onClick={() => setWhatsappMessage("")}
                  className="absolute right-2.5 bottom-2.5 text-[9px] font-mono text-white/40 hover:text-white/80 bg-white/5 hover:bg-white/10 px-2 py-1 rounded transition-all cursor-pointer border border-white/5"
                >
                  Löschen
                </button>
              )}
            </div>

            {/* Senden Button Row */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-1">
              <div className="text-[10px] font-mono leading-none">
                {whatsappMessage.trim() ? (
                  <span className="text-emerald-400 flex items-center gap-1.5 font-bold">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 inline-block animate-pulse shadow-[0_0_8px_#34d399]" />
                    Bereit! 📞
                  </span>
                ) : (
                  <span className="text-white/30 flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-white/10 inline-block" />
                    Preset auswählen...
                  </span>
                )}
              </div>

              <a
                href={whatsappMessage.trim() ? `https://wa.me/436508278461?text=${encodeURIComponent(whatsappMessage.trim())}` : undefined}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => {
                  if (!whatsappMessage.trim()) {
                    e.preventDefault();
                  }
                }}
                className={`w-full sm:w-auto px-5 py-2 rounded-xl font-mono text-xs font-black uppercase tracking-wider transition-all shadow-md select-none flex items-center justify-center gap-1.5 text-center pointer-events-auto ${
                  whatsappMessage.trim()
                    ? "bg-emerald-500 hover:bg-emerald-400 text-neutral-950 cursor-pointer shadow-[0_4px_14px_rgba(16,185,129,0.3)] active:scale-[0.98]"
                    : "bg-neutral-800 text-white/20 border border-white/5 cursor-not-allowed opacity-40"
                }`}
              >
                <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 fill-current" xmlns="http://www.w3.org/2000/svg">
                  <path d="M12.012 3c-4.832 0-8.75 3.917-8.75 8.75 0 1.543.4 3.012 1.137 4.293L3.13 20.87a.498.498 0 0 0 .614.614l4.827-1.269a8.681 8.681 0 0 0 3.44.734c4.833 0 8.75-3.917 8.75-8.75S16.845 3 12.012 3zm0 16.035c-1.464 0-2.833-.42-4.004-1.127a.5.5 0 0 0-.44-.04l-3.344.879.879-3.344a.5.5 0 0 0-.04-.44 7.29 7.29 0 0 1-1.127-4.004c0-4.041 3.284-7.325 7.325-7.325s7.325 3.284 7.325 7.325-3.284 7.325-7.325 7.325z" />
                </svg>
                <span>Senden</span>
              </a>
            </div>
          </div>
        </div>
      </div>
    )}

      </section>
      </div>

      {/* Gorgeous Privacy and Device Permissions Overlay if loading or denied */}
      {permissionState !== "granted" && !bypassPermissionOverlay && (
        <div id="mic-fallback-overlay" className="absolute inset-0 bg-black/85 backdrop-blur-md flex items-center justify-center z-50 p-6">
          <div className="bg-[#141414] border border-white/10 p-8 sm:p-12 rounded-3xl max-w-md text-center shadow-2xl relative">
            
            {/* Status indicator badge */}
            <div className="absolute top-4 right-4 flex items-center gap-1.5 px-2 py-0.5 rounded bg-red-950/20 border border-red-500/20">
              <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
              <span className="text-[8px] font-mono text-red-400 uppercase tracking-widest">Verriegelt 🔒</span>
            </div>

            <div className="w-16 h-16 sm:w-20 sm:h-20 bg-white rounded-full flex items-center justify-center mx-auto mb-6 sm:mb-8 text-black shadow-lg">
              <Mic size={28} className="sm:size-36" />
            </div>

            <h2 className="text-2xl sm:text-3xl font-black mb-3 tracking-tight text-white italic uppercase">
              Lauscher anwerfen! 🎤
            </h2>
            
            <p className="text-white/60 text-xs sm:text-sm mb-6 sm:mb-8 leading-relaxed">
              Dieses hochmoderne Tuning-Monster rechnet deine Saiten-Frequenzen ganz diskret und blitzschnell direkt im Browser aus. Gib uns die Erlaubnis, sonst hören wir deinen fabelhaften Krach nicht!
            </p>

            {errorMsg ? (
              <p className="mb-6 p-3 bg-red-950/20 border border-red-500/20 rounded-lg text-red-300 text-xs text-left font-mono leading-relaxed">
                {errorMsg}
              </p>
            ) : null}

            <div className="flex flex-col gap-3">
              <button 
                id="grant-mic-permission-action"
                onClick={startTuningEngine}
                className="w-full py-3.5 bg-white text-black font-bold text-xs sm:text-sm tracking-widest uppercase rounded-full hover:bg-gray-100 active:scale-[0.98] transition-all cursor-pointer shadow-md"
              >
                Lauscher anknipsen! 🔥
              </button>

              <button 
                id="bypass-mic-permission-action"
                onClick={() => setBypassPermissionOverlay(true)}
                className="w-full py-3 bg-white/5 text-white/80 font-bold text-xs tracking-widest uppercase rounded-full border border-white/15 hover:bg-white/10 active:scale-[0.98] transition-all cursor-pointer shadow-sm"
              >
                Manueller Modus & Akkorde 🎸
              </button>
            </div>

            <div className="mt-5 text-[9px] uppercase tracking-widest text-[#F5F5F5]/30 font-mono">
              Datenschutz ist Ehrensache • Kein Spionage-Server lauscht mit
            </div>
          </div>
        </div>
      )}

      {/* Elegantly Polished Custom Screensaver Overlay (99s Inactivity) */}
      {isDimmed && (
        <div 
          id="app-screensaver-overlay" 
          onClick={resetInactivityTimer}
          onTouchStart={resetInactivityTimer}
          className="fixed inset-0 bg-black/95 backdrop-blur-md flex flex-col items-center justify-center z-[100] cursor-pointer animate-fade-in select-none"
        >
          <div className="text-center p-6 max-w-sm flex flex-col items-center">
            {/* Pulsating Ambient Tuner Icon */}
            <div className="w-16 h-16 bg-amber-500/10 border border-amber-500/30 rounded-full flex items-center justify-center mb-6 animate-pulse text-amber-400">
              <Zap size={28} />
            </div>
            
            <h2 className="text-xl font-bold text-white mb-2 tracking-tight uppercase italic">
              Bildschirmschoner aktiv 💤
            </h2>
            <p className="text-white/40 text-xs mb-8 leading-relaxed font-mono">
              (Inaktivität von 99 Sekunden überschritten)
            </p>
            
            <span className="px-5 py-2.5 bg-amber-500 text-black font-extrabold uppercase text-xs tracking-widest rounded-full shadow-lg shadow-amber-950/40 hover:bg-amber-400 transition-all">
              Tippen zum Fortfahren 🎸
            </span>
          </div>
        </div>
      )}

      {/* ----------------- INTERACTIVE EXTENDED NECK MODAL OVERLAY ----------------- */}
      {isExtendedNeckModalOpen && (
        <div id="extended-neck-modal" className="fixed inset-0 bg-black/95 backdrop-blur-lg flex items-center justify-center z-[95] p-4 sm:p-6 overflow-y-auto animate-fade-in text-white font-sans pointer-events-auto">
          <div className="bg-neutral-900 border border-white/10 rounded-3xl w-full max-w-5xl shadow-2xl p-5 sm:p-7 relative flex flex-col gap-6 my-auto select-none">
            {/* Background elements */}
            <div className="absolute top-4 right-4 z-10">
              <button
                onClick={() => {
                  setIsExtendedNeckModalOpen(false);
                  stopScaleSequence();
                }}
                className="w-10 h-10 rounded-full bg-white/5 hover:bg-white/15 border border-white/10 flex items-center justify-center transition-all cursor-pointer active:scale-95 text-white/70 hover:text-white"
                title="Schließen"
              >
                <X size={20} />
              </button>
            </div>

            {/* Title / Description Header region */}
            <div className="flex flex-col gap-1.5 pr-12">
              <div className="flex items-center gap-2">
                <span className="text-xl">🏆</span>
                <span className="bg-amber-400 text-neutral-950 font-mono font-black py-0.5 px-2.5 rounded text-[10px] tracking-wider uppercase">GROSSANSICHT</span>
                <h3 className="text-base sm:text-lg font-black uppercase tracking-wider text-amber-400 font-mono">
                  Master-Griffbrett Visualizer
                </h3>
              </div>
              <p className="text-white/60 text-xs sm:text-sm font-sans leading-relaxed">
                Großansicht der <strong className="text-yellow-400 font-bold">{pentatonicKey} {pentatonicType === "minor" ? "Moll" : "Dur"}-Pentatonik</strong> über ein ausgedehntes 18-Fret-Halssegment. Bestens im Querformat bedienbar. Klicke Töne an, um sie anzuspielen!
              </p>
            </div>

            {/* Quick workbench triggers inside the modal */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-black/40 border border-white/5 rounded-2xl p-4">
              {/* Key selection */}
              <div className="flex flex-col gap-1.5">
                <span className="text-[10px] uppercase font-mono font-extrabold tracking-wider text-white/40">1. Grundton wechseln:</span>
                <div className="flex flex-wrap gap-1">
                  {["C", "D", "E", "F", "G", "A", "H"].map((k) => (
                    <button
                      key={k}
                      onClick={() => setPentatonicKey(k)}
                      className={`px-3.5 py-2 rounded-xl text-xs font-mono font-black transition-all cursor-pointer ${
                        pentatonicKey === k
                          ? "bg-amber-500 text-black shadow-md shadow-amber-500/10"
                          : "bg-white/5 text-white/60 hover:text-white hover:bg-white/10"
                      }`}
                    >
                      {k}
                    </button>
                  ))}
                </div>
              </div>

              {/* Scale Type */}
              <div className="flex flex-col gap-1.5 justify-center">
                <span className="text-[10px] uppercase font-mono font-extrabold tracking-wider text-white/40">2. Modus wechseln:</span>
                <div className="flex gap-2">
                  {[
                    { id: "minor", label: "Moll-Pentatonik (Blues/Rock)" },
                    { id: "major", label: "Dur-Pentatonik (Country/Jazz)" },
                  ].map((t) => (
                    <button
                      key={t.id}
                      onClick={() => setPentatonicType(t.id as any)}
                      className={`flex-1 py-2 rounded-xl text-xs font-sans font-extrabold transition-all cursor-pointer border ${
                        pentatonicType === t.id
                          ? "bg-amber-500/15 text-amber-400 border-amber-500/50 shadow-inner"
                          : "bg-white/5 text-white/60 border-transparent hover:text-white hover:bg-white/10"
                      }`}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Scrollable fretboards area */}
            <div className="w-full overflow-x-auto pb-4 select-none scrollbar-thin">
              <div className="relative min-w-[920px] h-[195px] bg-gradient-to-r from-neutral-950 via-[#26180c]/80 to-neutral-800/10 rounded-2xl p-4 border border-white/10 shadow-2xl">
                <svg viewBox="0 0 920 160" className="w-[920px] h-[155px] font-sans">
                  {/* Fret Markers (3, 5, 7, 9, 15, 17) */}
                  {[3, 5, 7, 9, 15, 17].map(fret => {
                    const x = 40 + fret * 48 - 24;
                    return (
                      <circle
                        key={`modal-marker-${fret}`}
                        cx={x}
                        cy={80}
                        r={6.5}
                        className="fill-white/10 stroke-none pointer-events-none"
                      />
                    );
                  })}

                  {/* Fret 12 double octave dots */}
                  {(() => {
                    const x = 40 + 12 * 48 - 24;
                    return (
                      <g key="modal-marker-12" className="pointer-events-none">
                        <circle cx={x} cy={50} r={5} className="fill-white/10 stroke-none" />
                        <circle cx={x} cy={110} r={5} className="fill-white/10 stroke-none" />
                      </g>
                    );
                  })()}

                  {/* Guitar Strings (6 of them, top E4 down to E2, proportional thickness) */}
                  {[0, 1, 2, 3, 4, 5].map((sIdx) => {
                    const y = 25 + sIdx * 22;
                    const strokeWidths = [1.3, 1.5, 2.0, 2.3, 2.7, 3.4];
                    const lineStrokeIdx = isNeckFlipped ? (5 - sIdx) : sIdx;
                    return (
                      <line
                        key={`modal-h-str-${sIdx}`}
                        x1={40}
                        y1={y}
                        x2={886}
                        y2={y}
                        className="stroke-zinc-500/40 pointer-events-none"
                        strokeWidth={strokeWidths[lineStrokeIdx]}
                      />
                    );
                  })}

                  {/* Vertical Frets (0 to 17) */}
                  {Array.from({ length: 18 }).map((_, fIdx) => {
                    const x = 40 + fIdx * 48;
                    const isNut = fIdx === 0;

                    const openStrings = [0, 5, 10, 15, 19, 24];
                    const rootSemitone = KEY_SEMITONES[pentatonicKey] ?? 5;
                    const containsRoot = openStrings.some(openPitch => {
                      const offset = ((openPitch + fIdx - rootSemitone) % 12 + 12) % 12;
                      return offset === 0;
                    });

                    return (
                      <g key={`modal-v-fret-${fIdx}`} className="pointer-events-none">
                        <line
                          x1={x}
                          y1={20}
                          x2={x}
                          y2={138}
                          className={isNut ? "stroke-amber-400" : "stroke-zinc-700/60"}
                          strokeWidth={isNut ? 4.5 : 1.2}
                        />

                        {/* Fret indicator highlight if containsRoot */}
                        {containsRoot && fIdx > 0 && (
                          <rect
                            x={x - 33}
                            y={142}
                            width={18}
                            height={14}
                            rx={4}
                            className="fill-amber-500/25 stroke stroke-amber-500/45 stroke-[0.5]"
                          />
                        )}

                        <text
                          x={isNut ? x - 10 : x - 24}
                          y={153}
                          textAnchor="middle"
                          className={`font-mono text-[9px] font-bold ${
                            containsRoot && fIdx > 0
                              ? "fill-amber-400 font-extrabold"
                              : "fill-white/20"
                          }`}
                        >
                          {fIdx === 0 ? "Nut" : fIdx}
                        </text>
                      </g>
                    );
                  })}

                  {/* Interactive Note bubbles inside the master modal */}
                  {(() => {
                    const openStrings = [0, 5, 10, 15, 19, 24];
                    const scaleIntervals = pentatonicType === "minor" ? [0, 3, 5, 7, 10] : [0, 2, 4, 7, 9];
                    const rootSemitone = KEY_SEMITONES[pentatonicKey] ?? 5;

                    return [0, 1, 2, 3, 4, 5].flatMap((sIdx) => {
                      const stringIdx = isNeckFlipped ? sIdx : (5 - sIdx);
                      const openPitch = openStrings[stringIdx];
                      const y = 25 + sIdx * 22;

                      return Array.from({ length: 18 }).map((_, fret) => {
                        const pitch = openPitch + fret;
                        const offset = ((pitch - rootSemitone) % 12 + 12) % 12;
                        const isScaleNote = scaleIntervals.includes(offset);
                        if (!isScaleNote) return null;

                        const isRoot = offset === 0;
                        const x = fret === 0 ? 20 : 40 + fret * 48 - 24;

                        // Give full-color view since this is the expanded diagram
                        return (
                          <g
                            key={`modal-neck-note-${stringIdx}-${fret}`}
                            className="cursor-pointer group/note"
                            onClick={() => playNote(stringIdx, fret)}
                          >
                            <circle
                              cx={x}
                              cy={y}
                              r={10}
                              className={`transition-all duration-150 ${
                                isRoot
                                  ? "fill-amber-400 stroke-amber-100 stroke-1.2 drop-shadow-[0_0_8px_#f59e0b] group-hover/note:scale-115"
                                  : "fill-neutral-950 stroke-amber-500/90 stroke-1.8 group-hover/note:fill-amber-600 group-hover/note:scale-115"
                              }`}
                            />
                            <text
                              x={x}
                              y={y + 3}
                              textAnchor="middle"
                              className={`font-mono text-[8.5px] font-bold ${
                                isRoot ? "fill-black font-black" : "fill-white/95 group-hover/note:fill-white"
                              }`}
                            >
                              {isRoot ? "R" : scaleIntervals.indexOf(offset) + 1}
                            </text>
                            
                            <circle
                              cx={x}
                              cy={y}
                              r={18}
                              className="fill-none stroke-amber-500/25 stroke-1 scale-0 transition-transform group-hover/note:scale-100 duration-300 pointer-events-none"
                            />
                          </g>
                        );
                      });
                    });
                  })()}
                </svg>
              </div>
            </div>

            {/* Bottom Controls */}
            <div className="flex flex-col sm:flex-row gap-3 justify-between items-center bg-black/30 p-4 border border-white/5 rounded-2xl">
              <div className="flex gap-4 items-center font-mono text-xs text-white/50">
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-400 inline-block drop-shadow-[0_0_4px_#f59e0b]" />
                  <span>R = Grundton</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-neutral-950 border border-amber-500/95 inline-block" />
                  <span>Skalentöne</span>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <button
                  onClick={() => {
                    if (isScalePlaying) {
                      stopScaleSequence();
                    } else {
                      playPentatonicSequence();
                    }
                  }}
                  className={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-xs font-mono font-black uppercase tracking-wider transition-all cursor-pointer shadow-md select-none ${
                    isScalePlaying
                      ? "bg-red-600 text-white animate-pulse"
                      : "bg-amber-500 hover:bg-amber-400 text-neutral-950"
                  }`}
                >
                  <span className="text-sm">{isScalePlaying ? "⏹" : "▶"}</span>
                  <span>{isScalePlaying ? "Tonleiter stopp" : "Tonleiter abspielen"}</span>
                </button>

                <button
                  onClick={() => setIsNeckFlipped(prev => !prev)}
                  className={`flex items-center gap-1.5 px-4 py-2.5 border rounded-xl text-xs uppercase font-mono font-black tracking-wider transition-all cursor-pointer select-none active:scale-[0.98] shadow-md ${
                    isNeckFlipped
                      ? "bg-amber-500/20 border-amber-500/50 text-amber-300"
                      : "bg-neutral-800 hover:bg-neutral-700 hover:text-white border-white/10 hover:border-white/20 text-[#f5f5f5]"
                  }`}
                  title="Gitarrenhals spiegeln (Saitenverlauf vertikal spiegeln)"
                >
                  <RotateCw size={11} className={`transition-transform duration-300 ${isNeckFlipped ? "rotate-180 text-amber-400" : ""}`} />
                  <span>Spiegeln {isNeckFlipped ? "Aktiv" : "180°"}</span>
                </button>

                <button
                  onClick={() => {
                    setIsExtendedNeckModalOpen(false);
                    stopScaleSequence();
                  }}
                  className="px-6 py-2.5 bg-neutral-800 hover:bg-neutral-700 hover:text-white border border-white/10 rounded-xl text-xs font-bold uppercase tracking-wider transition-all cursor-pointer"
                >
                  Schließen
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
