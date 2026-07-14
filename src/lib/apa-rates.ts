export interface APARate {
  role: string;
  section: string; // which budget section this belongs to
  minDailyRate: number;
  maxDailyRate: number; // this is the DEFAULT we use
  overtimeGrade: string; // 'I' | 'II' | 'III' | 'N/A'
  overtimeCoefficient: number; // 1.0, 1.25, 1.5
  basicHourlyRate: number;
  doubleHourlyRate: number;
  tripleHourlyRate: number;
  standardOvertimeRate: number;
}

export const APA_CREW_RATES: APARate[] = [
  // DIRECTION
  { role: 'Director', section: 'PRE_PRODUCTION', minDailyRate: 0, maxDailyRate: 933, overtimeGrade: 'N/A', overtimeCoefficient: 0, basicHourlyRate: 0, doubleHourlyRate: 0, tripleHourlyRate: 0, standardOvertimeRate: 0 },
  { role: '1st Assistant Director', section: 'CREW', minDailyRate: 0, maxDailyRate: 785, overtimeGrade: 'III', overtimeCoefficient: 1.0, basicHourlyRate: 79, doubleHourlyRate: 157, tripleHourlyRate: 236, standardOvertimeRate: 79 },
  { role: '2nd Assistant Director', section: 'CREW', minDailyRate: 345, maxDailyRate: 435, overtimeGrade: 'I', overtimeCoefficient: 1.5, basicHourlyRate: 44, doubleHourlyRate: 87, tripleHourlyRate: 131, standardOvertimeRate: 65 },
  { role: '3rd Assistant Director', section: 'CREW', minDailyRate: 299, maxDailyRate: 326, overtimeGrade: 'I', overtimeCoefficient: 1.5, basicHourlyRate: 33, doubleHourlyRate: 65, tripleHourlyRate: 98, standardOvertimeRate: 49 },
  { role: 'Floor Runner', section: 'CREW', minDailyRate: 0, maxDailyRate: 238, overtimeGrade: 'N/A', overtimeCoefficient: 0, basicHourlyRate: 0, doubleHourlyRate: 0, tripleHourlyRate: 0, standardOvertimeRate: 0 },
  { role: 'Production Runner', section: 'CREW', minDailyRate: 0, maxDailyRate: 238, overtimeGrade: 'N/A', overtimeCoefficient: 0, basicHourlyRate: 0, doubleHourlyRate: 0, tripleHourlyRate: 0, standardOvertimeRate: 0 },

  // PRODUCTION
  { role: 'Producer', section: 'PRE_PRODUCTION', minDailyRate: 0, maxDailyRate: 933, overtimeGrade: 'N/A', overtimeCoefficient: 0, basicHourlyRate: 0, doubleHourlyRate: 0, tripleHourlyRate: 0, standardOvertimeRate: 0 },
  { role: 'Production Manager', section: 'PRE_PRODUCTION', minDailyRate: 489, maxDailyRate: 609, overtimeGrade: 'N/A', overtimeCoefficient: 0, basicHourlyRate: 0, doubleHourlyRate: 0, tripleHourlyRate: 0, standardOvertimeRate: 0 },
  { role: 'Production Assistant', section: 'PRE_PRODUCTION', minDailyRate: 340, maxDailyRate: 428, overtimeGrade: 'N/A', overtimeCoefficient: 0, basicHourlyRate: 0, doubleHourlyRate: 0, tripleHourlyRate: 0, standardOvertimeRate: 0 },
  { role: 'Location Manager', section: 'LOCATIONS', minDailyRate: 489, maxDailyRate: 580, overtimeGrade: 'II', overtimeCoefficient: 1.25, basicHourlyRate: 58, doubleHourlyRate: 116, tripleHourlyRate: 174, standardOvertimeRate: 73 },
  { role: 'Script Supervisor', section: 'PRE_PRODUCTION', minDailyRate: 449, maxDailyRate: 558, overtimeGrade: 'II', overtimeCoefficient: 1.25, basicHourlyRate: 56, doubleHourlyRate: 112, tripleHourlyRate: 167, standardOvertimeRate: 70 },

  // CAMERA
  { role: 'Director of Photography', section: 'CREW', minDailyRate: 908, maxDailyRate: 1516, overtimeGrade: 'III', overtimeCoefficient: 1.0, basicHourlyRate: 152, doubleHourlyRate: 303, tripleHourlyRate: 455, standardOvertimeRate: 152 },
  { role: 'Camera Operator', section: 'CREW', minDailyRate: 514, maxDailyRate: 637, overtimeGrade: 'II', overtimeCoefficient: 1.25, basicHourlyRate: 64, doubleHourlyRate: 127, tripleHourlyRate: 191, standardOvertimeRate: 80 },
  { role: 'Focus Puller (1st AC)', section: 'CREW', minDailyRate: 448, maxDailyRate: 558, overtimeGrade: 'II', overtimeCoefficient: 1.25, basicHourlyRate: 56, doubleHourlyRate: 112, tripleHourlyRate: 167, standardOvertimeRate: 70 },
  { role: 'Clapper Loader', section: 'CREW', minDailyRate: 345, maxDailyRate: 435, overtimeGrade: 'I', overtimeCoefficient: 1.5, basicHourlyRate: 44, doubleHourlyRate: 87, tripleHourlyRate: 131, standardOvertimeRate: 65 },
  { role: 'DIT', section: 'CREW', minDailyRate: 0, maxDailyRate: 512, overtimeGrade: 'II', overtimeCoefficient: 1.25, basicHourlyRate: 51, doubleHourlyRate: 102, tripleHourlyRate: 154, standardOvertimeRate: 64 },
  { role: 'Video Operator', section: 'CREW', minDailyRate: 324, maxDailyRate: 391, overtimeGrade: 'I', overtimeCoefficient: 1.5, basicHourlyRate: 39, doubleHourlyRate: 78, tripleHourlyRate: 117, standardOvertimeRate: 59 },

  // LIGHTING & GRIP
  { role: 'Gaffer', section: 'CREW', minDailyRate: 0, maxDailyRate: 568, overtimeGrade: 'II', overtimeCoefficient: 1.25, basicHourlyRate: 57, doubleHourlyRate: 114, tripleHourlyRate: 170, standardOvertimeRate: 71 },
  { role: 'Lighting Technician', section: 'CREW', minDailyRate: 0, maxDailyRate: 444, overtimeGrade: 'I', overtimeCoefficient: 1.5, basicHourlyRate: 44, doubleHourlyRate: 89, tripleHourlyRate: 133, standardOvertimeRate: 67 },
  { role: 'Key Grip', section: 'CREW', minDailyRate: 0, maxDailyRate: 558, overtimeGrade: 'II', overtimeCoefficient: 1.25, basicHourlyRate: 56, doubleHourlyRate: 112, tripleHourlyRate: 167, standardOvertimeRate: 70 },
  { role: 'Grip', section: 'CREW', minDailyRate: 0, maxDailyRate: 511, overtimeGrade: 'II', overtimeCoefficient: 1.25, basicHourlyRate: 51, doubleHourlyRate: 102, tripleHourlyRate: 153, standardOvertimeRate: 64 },
  { role: 'Rigger', section: 'CREW', minDailyRate: 326, maxDailyRate: 386, overtimeGrade: 'I', overtimeCoefficient: 1.5, basicHourlyRate: 39, doubleHourlyRate: 77, tripleHourlyRate: 116, standardOvertimeRate: 58 },

  // ART DEPARTMENT
  { role: 'Art Director', section: 'ART_DEPARTMENT', minDailyRate: 655, maxDailyRate: 852, overtimeGrade: 'III', overtimeCoefficient: 1.0, basicHourlyRate: 85, doubleHourlyRate: 170, tripleHourlyRate: 256, standardOvertimeRate: 85 },
  { role: 'Asst. Art Director', section: 'ART_DEPARTMENT', minDailyRate: 479, maxDailyRate: 568, overtimeGrade: 'II', overtimeCoefficient: 1.25, basicHourlyRate: 57, doubleHourlyRate: 114, tripleHourlyRate: 170, standardOvertimeRate: 71 },
  { role: 'Stylist', section: 'STYLING_GLAM', minDailyRate: 504, maxDailyRate: 628, overtimeGrade: 'II', overtimeCoefficient: 1.25, basicHourlyRate: 63, doubleHourlyRate: 126, tripleHourlyRate: 188, standardOvertimeRate: 79 },
  { role: 'Props Buyer', section: 'ART_DEPARTMENT', minDailyRate: 479, maxDailyRate: 568, overtimeGrade: 'II', overtimeCoefficient: 1.25, basicHourlyRate: 57, doubleHourlyRate: 114, tripleHourlyRate: 170, standardOvertimeRate: 71 },
  { role: 'Props', section: 'ART_DEPARTMENT', minDailyRate: 331, maxDailyRate: 386, overtimeGrade: 'I', overtimeCoefficient: 1.5, basicHourlyRate: 39, doubleHourlyRate: 77, tripleHourlyRate: 116, standardOvertimeRate: 58 },
  { role: 'Construction Manager', section: 'ART_DEPARTMENT', minDailyRate: 427, maxDailyRate: 532, overtimeGrade: 'II', overtimeCoefficient: 1.25, basicHourlyRate: 53, doubleHourlyRate: 106, tripleHourlyRate: 160, standardOvertimeRate: 67 },
  { role: 'Carpenter', section: 'ART_DEPARTMENT', minDailyRate: 331, maxDailyRate: 386, overtimeGrade: 'I', overtimeCoefficient: 1.5, basicHourlyRate: 39, doubleHourlyRate: 77, tripleHourlyRate: 116, standardOvertimeRate: 58 },
  { role: 'Scenic Artist', section: 'ART_DEPARTMENT', minDailyRate: 537, maxDailyRate: 714, overtimeGrade: 'III', overtimeCoefficient: 1.0, basicHourlyRate: 71, doubleHourlyRate: 143, tripleHourlyRate: 214, standardOvertimeRate: 71 },
  // Digi Tech is the same grade as the camera-department DIT — same published
  // APA rate, listed here too so it can be picked from the Art Department.
  { role: 'Digi Tech / DIT', section: 'ART_DEPARTMENT', minDailyRate: 0, maxDailyRate: 512, overtimeGrade: 'II', overtimeCoefficient: 1.25, basicHourlyRate: 51, doubleHourlyRate: 102, tripleHourlyRate: 154, standardOvertimeRate: 64 },
  // The APA card publishes no rate for Set Designer — 0 means "no reference
  // rate", so the UI shows none and picking the role leaves the unit cost alone.
  { role: 'Set Designer', section: 'ART_DEPARTMENT', minDailyRate: 0, maxDailyRate: 0, overtimeGrade: 'N/A', overtimeCoefficient: 0, basicHourlyRate: 0, doubleHourlyRate: 0, tripleHourlyRate: 0, standardOvertimeRate: 0 },

  // SOUND
  { role: 'Sound Mixer', section: 'CREW', minDailyRate: 525, maxDailyRate: 649, overtimeGrade: 'II', overtimeCoefficient: 1.25, basicHourlyRate: 65, doubleHourlyRate: 130, tripleHourlyRate: 195, standardOvertimeRate: 81 },
  { role: 'Boom Operator', section: 'CREW', minDailyRate: 419, maxDailyRate: 519, overtimeGrade: 'II', overtimeCoefficient: 1.25, basicHourlyRate: 52, doubleHourlyRate: 104, tripleHourlyRate: 156, standardOvertimeRate: 65 },
  { role: 'Sound Maintenance', section: 'CREW', minDailyRate: 346, maxDailyRate: 423, overtimeGrade: 'I', overtimeCoefficient: 1.5, basicHourlyRate: 42, doubleHourlyRate: 85, tripleHourlyRate: 127, standardOvertimeRate: 63 },
  { role: 'Sound Assistant', section: 'CREW', minDailyRate: 324, maxDailyRate: 391, overtimeGrade: 'I', overtimeCoefficient: 1.5, basicHourlyRate: 39, doubleHourlyRate: 78, tripleHourlyRate: 117, standardOvertimeRate: 59 },

  // STYLING & MAKEUP
  { role: 'Costume Designer', section: 'STYLING_GLAM', minDailyRate: 546, maxDailyRate: 674, overtimeGrade: 'II', overtimeCoefficient: 1.25, basicHourlyRate: 67, doubleHourlyRate: 135, tripleHourlyRate: 202, standardOvertimeRate: 84 },
  { role: 'Wardrobe Buyer', section: 'STYLING_GLAM', minDailyRate: 546, maxDailyRate: 674, overtimeGrade: 'II', overtimeCoefficient: 1.25, basicHourlyRate: 67, doubleHourlyRate: 135, tripleHourlyRate: 202, standardOvertimeRate: 84 },
  { role: 'Wardrobe', section: 'STYLING_GLAM', minDailyRate: 331, maxDailyRate: 386, overtimeGrade: 'I', overtimeCoefficient: 1.5, basicHourlyRate: 39, doubleHourlyRate: 77, tripleHourlyRate: 116, standardOvertimeRate: 58 },
  { role: 'Chief Make Up Artist', section: 'STYLING_GLAM', minDailyRate: 525, maxDailyRate: 649, overtimeGrade: 'II', overtimeCoefficient: 1.25, basicHourlyRate: 65, doubleHourlyRate: 130, tripleHourlyRate: 195, standardOvertimeRate: 81 },
  { role: 'Make Up', section: 'STYLING_GLAM', minDailyRate: 331, maxDailyRate: 386, overtimeGrade: 'I', overtimeCoefficient: 1.5, basicHourlyRate: 39, doubleHourlyRate: 77, tripleHourlyRate: 116, standardOvertimeRate: 58 },
  { role: 'Chief Hair Designer', section: 'STYLING_GLAM', minDailyRate: 525, maxDailyRate: 649, overtimeGrade: 'II', overtimeCoefficient: 1.25, basicHourlyRate: 65, doubleHourlyRate: 130, tripleHourlyRate: 195, standardOvertimeRate: 81 },
  { role: 'Hairdresser', section: 'STYLING_GLAM', minDailyRate: 331, maxDailyRate: 386, overtimeGrade: 'I', overtimeCoefficient: 1.5, basicHourlyRate: 39, doubleHourlyRate: 77, tripleHourlyRate: 116, standardOvertimeRate: 58 },

  // SFX
  { role: 'SFX Supervisor', section: 'CREW', minDailyRate: 935, maxDailyRate: 1516, overtimeGrade: 'III', overtimeCoefficient: 1.0, basicHourlyRate: 152, doubleHourlyRate: 303, tripleHourlyRate: 455, standardOvertimeRate: 152 },
  { role: 'SFX Technician', section: 'CREW', minDailyRate: 418, maxDailyRate: 519, overtimeGrade: 'II', overtimeCoefficient: 1.25, basicHourlyRate: 52, doubleHourlyRate: 104, tripleHourlyRate: 156, standardOvertimeRate: 65 },

  // TRANSPORT
  { role: 'Driver', section: 'TRANSPORT', minDailyRate: 249, maxDailyRate: 299, overtimeGrade: 'I', overtimeCoefficient: 1.5, basicHourlyRate: 30, doubleHourlyRate: 60, tripleHourlyRate: 90, standardOvertimeRate: 45 },

  // HOME ECONOMIST
  { role: 'Home Economist', section: 'ART_DEPARTMENT', minDailyRate: 525, maxDailyRate: 649, overtimeGrade: 'II', overtimeCoefficient: 1.25, basicHourlyRate: 65, doubleHourlyRate: 130, tripleHourlyRate: 195, standardOvertimeRate: 81 },
];

// Helper to get rate by role name
export function getAPARate(role: string): APARate | undefined {
  return APA_CREW_RATES.find(r => r.role.toLowerCase() === role.toLowerCase());
}

// Helper to get all roles for a section
export function getAPARatesForSection(section: string): APARate[] {
  return APA_CREW_RATES.filter(r => r.section === section);
}

// The budget template uses friendly, generic role names; these aliases point
// them at the canonical APA rate-card role. Shared with the seed route so both
// the server and the budget UI resolve the same reference rate.
export const TEMPLATE_ROLE_ALIASES: Record<string, string> = {
  "DOP / Videographer": "Director of Photography",
  "Camera Assistant": "Focus Puller (1st AC)",
  "Sound Recordist": "Sound Mixer",
  "Wardrobe Stylist": "Stylist",
  "Hair Stylist": "Hairdresser",
  MUA: "Make Up",
};

// The APA standard day rate to show as a greyed-out *reference* next to a line's
// Unit Cost. Resolves friendly template names via the alias table. Returns
// undefined for custom roles with no APA rate (nothing is shown for those).
export function getReferenceRate(role: string | null | undefined): number | undefined {
  if (!role) return undefined;
  const rate = getAPARate(role) ?? getAPARate(TEMPLATE_ROLE_ALIASES[role] ?? "");
  // A maxDailyRate of 0 means the APA card publishes no rate for the role (e.g.
  // Set Designer) — show no reference rather than a misleading "APA £0".
  return rate?.maxDailyRate || undefined;
}
