// Shared constants for the Directory portal — Outlander's network of contacts,
// collaborators and talent.

export const DIRECTORY_ACCENT = "#64748b";

// Contact categories, in display order. Stored on Contact.category.
export const CONTACT_CATEGORIES = [
  "Brand Contact",
  "PR",
  "Photographer",
  "MUA",
  "Stylist",
  "Creative Director",
  "Videographer",
  "Colorist",
  "Grader",
  "Editor",
  "Model",
  "Talent",
  "Producer",
  "Set Designer",
  "Casting Director",
  "Graphic Designer",
  "Community",
  "Agency",
  "Venue",
  "DJ",
  "Other",
] as const;

export type ContactCategory = (typeof CONTACT_CATEGORIES)[number];

// Radar pipeline — where a "one to watch" is in the scouting flow.
export const RADAR_STATUSES = [
  "WATCHING",
  "REACHED_OUT",
  "CONNECTED",
  "COLLABORATING",
] as const;

export type RadarStatus = (typeof RADAR_STATUSES)[number];

export const RADAR_STATUS_LABELS: Record<string, string> = {
  WATCHING: "Watching",
  REACHED_OUT: "Reached Out",
  CONNECTED: "Connected",
  COLLABORATING: "Collaborating",
};

export function isRadarStatus(value: string): value is RadarStatus {
  return (RADAR_STATUSES as readonly string[]).includes(value);
}
