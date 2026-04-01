// ============================================================
// OUTLANDER OS — CENTRALIZED MOCK DATA
// ============================================================
// All mock data lives here so swapping to real data sources
// (e.g. "2026 MASTER BILLING TRACKER" Google Sheet) is trivial.
// Field names mirror what a billing tracker spreadsheet would contain.
// ============================================================

// ---- TYPES ----

export type RevenueCategory =
  | "Paid Partnerships"
  | "Production Fees"
  | "Brand Collaborations"
  | "Editorial"
  | "Events";

export type InvoiceStatus = "paid" | "pending" | "overdue" | "draft";

export type ProjectStatus = "active" | "completed" | "on-hold" | "in-review";

export type ContentType = "reel" | "carousel" | "single";

// ---- BILLING TRACKER ----
// Mirrors columns from "2026 MASTER BILLING TRACKER" Google Sheet

export interface BillingEntry {
  id: string;
  invoiceNumber: string;
  clientName: string;
  campaignName: string;
  revenueCategory: RevenueCategory;
  amountInvoiced: number;       // £ GBP
  amountPaid: number;           // £ GBP
  invoiceDate: string;          // ISO date
  dueDate: string;              // ISO date
  paymentStatus: InvoiceStatus;
  daysOutstanding: number | null;
  notes: string;
}

export const billingEntries: BillingEntry[] = [
  { id: "b001", invoiceNumber: "INV-2026-001", clientName: "Nike", campaignName: "Air Max Spring '26 Campaign", revenueCategory: "Paid Partnerships", amountInvoiced: 48000, amountPaid: 48000, invoiceDate: "2026-01-05", dueDate: "2026-01-26", paymentStatus: "paid", daysOutstanding: null, notes: "Full shoot + social package" },
  { id: "b002", invoiceNumber: "INV-2026-002", clientName: "Adidas", campaignName: "Originals SS26 Editorial", revenueCategory: "Brand Collaborations", amountInvoiced: 32000, amountPaid: 32000, invoiceDate: "2026-01-12", dueDate: "2026-02-02", paymentStatus: "paid", daysOutstanding: null, notes: "" },
  { id: "b003", invoiceNumber: "INV-2026-003", clientName: "BAPE", campaignName: "Shark Hoodie Drop Feature", revenueCategory: "Editorial", amountInvoiced: 8500, amountPaid: 8500, invoiceDate: "2026-01-18", dueDate: "2026-02-08", paymentStatus: "paid", daysOutstanding: null, notes: "Online exclusive" },
  { id: "b004", invoiceNumber: "INV-2026-004", clientName: "New Balance", campaignName: "1906R Launch Shoot", revenueCategory: "Production Fees", amountInvoiced: 22000, amountPaid: 22000, invoiceDate: "2026-01-22", dueDate: "2026-02-12", paymentStatus: "paid", daysOutstanding: null, notes: "Studio + 3 day shoot" },
  { id: "b005", invoiceNumber: "INV-2026-005", clientName: "Carhartt WIP", campaignName: "AW26 Lookbook Production", revenueCategory: "Production Fees", amountInvoiced: 18500, amountPaid: 18500, invoiceDate: "2026-02-03", dueDate: "2026-02-24", paymentStatus: "paid", daysOutstanding: null, notes: "" },
  { id: "b006", invoiceNumber: "INV-2026-006", clientName: "Palace", campaignName: "Summer '26 Campaign", revenueCategory: "Paid Partnerships", amountInvoiced: 35000, amountPaid: 35000, invoiceDate: "2026-02-10", dueDate: "2026-03-03", paymentStatus: "paid", daysOutstanding: null, notes: "Includes 4 x IG story sets" },
  { id: "b007", invoiceNumber: "INV-2026-007", clientName: "The North Face", campaignName: "Summit Series Feature", revenueCategory: "Editorial", amountInvoiced: 7200, amountPaid: 7200, invoiceDate: "2026-02-14", dueDate: "2026-03-07", paymentStatus: "paid", daysOutstanding: null, notes: "" },
  { id: "b008", invoiceNumber: "INV-2026-008", clientName: "Stüssy", campaignName: "Chapter Store London Event", revenueCategory: "Events", amountInvoiced: 15000, amountPaid: 15000, invoiceDate: "2026-02-20", dueDate: "2026-03-13", paymentStatus: "paid", daysOutstanding: null, notes: "" },
  { id: "b009", invoiceNumber: "INV-2026-009", clientName: "Nike", campaignName: "Jordan x Outlander Special", revenueCategory: "Brand Collaborations", amountInvoiced: 42000, amountPaid: 42000, invoiceDate: "2026-03-01", dueDate: "2026-03-22", paymentStatus: "paid", daysOutstanding: null, notes: "" },
  { id: "b010", invoiceNumber: "INV-2026-010", clientName: "Adidas", campaignName: "Samba Micro Feature", revenueCategory: "Editorial", amountInvoiced: 6800, amountPaid: 6800, invoiceDate: "2026-03-08", dueDate: "2026-03-29", paymentStatus: "paid", daysOutstanding: null, notes: "" },
  { id: "b011", invoiceNumber: "INV-2026-011", clientName: "New Balance", campaignName: "990v6 Digital Campaign", revenueCategory: "Paid Partnerships", amountInvoiced: 28000, amountPaid: 14000, invoiceDate: "2026-03-15", dueDate: "2026-04-05", paymentStatus: "pending", daysOutstanding: 4, notes: "50% deposit received" },
  { id: "b012", invoiceNumber: "INV-2026-012", clientName: "Carhartt WIP", campaignName: "SS26 Brand Awareness Push", revenueCategory: "Paid Partnerships", amountInvoiced: 21000, amountPaid: 0, invoiceDate: "2026-03-18", dueDate: "2026-04-08", paymentStatus: "pending", daysOutstanding: 7, notes: "" },
  { id: "b013", invoiceNumber: "INV-2026-013", clientName: "BAPE", campaignName: "Tokyo Collection Editorial", revenueCategory: "Editorial", amountInvoiced: 9500, amountPaid: 0, invoiceDate: "2026-03-10", dueDate: "2026-03-24", paymentStatus: "overdue", daysOutstanding: 8, notes: "Chased x2" },
  { id: "b014", invoiceNumber: "INV-2026-014", clientName: "Palace", campaignName: "Tri-Ferg Capsule Feature", revenueCategory: "Brand Collaborations", amountInvoiced: 14000, amountPaid: 0, invoiceDate: "2026-03-12", dueDate: "2026-03-26", paymentStatus: "overdue", daysOutstanding: 6, notes: "" },
  { id: "b015", invoiceNumber: "INV-2026-015", clientName: "The North Face", campaignName: "Black Series Campaign", revenueCategory: "Paid Partnerships", amountInvoiced: 38000, amountPaid: 0, invoiceDate: "2026-03-25", dueDate: "2026-04-15", paymentStatus: "pending", daysOutstanding: 14, notes: "In production" },
  { id: "b016", invoiceNumber: "INV-2026-016", clientName: "Stüssy", campaignName: "SS26 Drop Coverage", revenueCategory: "Editorial", amountInvoiced: 5500, amountPaid: 0, invoiceDate: "2026-03-28", dueDate: "2026-04-18", paymentStatus: "draft", daysOutstanding: null, notes: "Awaiting sign-off" },
  { id: "b017", invoiceNumber: "INV-2026-017", clientName: "Nike", campaignName: "SB Dunk x Outlander Collab", revenueCategory: "Brand Collaborations", amountInvoiced: 55000, amountPaid: 0, invoiceDate: "2026-03-30", dueDate: "2026-04-20", paymentStatus: "draft", daysOutstanding: null, notes: "Contract pending" },
];

// ---- MONTHLY REVENUE (12 months) ----

export interface MonthlyRevenue {
  month: string;
  paidPartnerships: number;
  productionFees: number;
  brandCollaborations: number;
  editorial: number;
  events: number;
  total: number;
  target: number;
}

export const monthlyRevenue: MonthlyRevenue[] = [
  { month: "Apr '25", paidPartnerships: 28000, productionFees: 14000, brandCollaborations: 18000, editorial: 6500, events: 5000, total: 71500, target: 65000 },
  { month: "May '25", paidPartnerships: 32000, productionFees: 16000, brandCollaborations: 12000, editorial: 7200, events: 8000, total: 75200, target: 65000 },
  { month: "Jun '25", paidPartnerships: 25000, productionFees: 18000, brandCollaborations: 22000, editorial: 5800, events: 12000, total: 82800, target: 70000 },
  { month: "Jul '25", paidPartnerships: 30000, productionFees: 12000, brandCollaborations: 16000, editorial: 6000, events: 0, total: 64000, target: 65000 },
  { month: "Aug '25", paidPartnerships: 18000, productionFees: 8000, brandCollaborations: 10000, editorial: 4500, events: 0, total: 40500, target: 55000 },
  { month: "Sep '25", paidPartnerships: 42000, productionFees: 20000, brandCollaborations: 28000, editorial: 8200, events: 6000, total: 104200, target: 80000 },
  { month: "Oct '25", paidPartnerships: 38000, productionFees: 22000, brandCollaborations: 24000, editorial: 7500, events: 10000, total: 101500, target: 80000 },
  { month: "Nov '25", paidPartnerships: 45000, productionFees: 18000, brandCollaborations: 32000, editorial: 9000, events: 0, total: 104000, target: 85000 },
  { month: "Dec '25", paidPartnerships: 22000, productionFees: 10000, brandCollaborations: 15000, editorial: 5000, events: 8000, total: 60000, target: 60000 },
  { month: "Jan '26", paidPartnerships: 48000, productionFees: 22000, brandCollaborations: 32000, editorial: 8500, events: 0, total: 110500, target: 90000 },
  { month: "Feb '26", paidPartnerships: 35000, productionFees: 18500, brandCollaborations: 0, editorial: 7200, events: 15000, total: 75700, target: 75000 },
  { month: "Mar '26", paidPartnerships: 70000, productionFees: 0, brandCollaborations: 42000, editorial: 16300, events: 0, total: 128300, target: 100000 },
];

// ---- CLIENT REVENUE SUMMARY ----

export interface ClientRevenueSummary {
  clientName: string;
  totalRevenue: number;
  numCampaigns: number;
  avgMargin: number; // %
}

export const clientRevenue: ClientRevenueSummary[] = [
  { clientName: "Nike", totalRevenue: 145000, numCampaigns: 3, avgMargin: 38 },
  { clientName: "Adidas", totalRevenue: 38800, numCampaigns: 2, avgMargin: 34 },
  { clientName: "Palace", totalRevenue: 49000, numCampaigns: 2, avgMargin: 41 },
  { clientName: "New Balance", totalRevenue: 50000, numCampaigns: 2, avgMargin: 31 },
  { clientName: "The North Face", totalRevenue: 45200, numCampaigns: 2, avgMargin: 27 },
  { clientName: "Carhartt WIP", totalRevenue: 39500, numCampaigns: 2, avgMargin: 29 },
  { clientName: "BAPE", totalRevenue: 18000, numCampaigns: 2, avgMargin: 44 },
  { clientName: "Stüssy", totalRevenue: 20500, numCampaigns: 2, avgMargin: 36 },
];

// ---- ACTIVE PROJECTS ----

export interface Project {
  id: string;
  clientName: string;
  projectName: string;
  type: string;
  budget: number;
  actual: number;
  margin: number; // %
  status: ProjectStatus;
}

export const activeProjects: Project[] = [
  { id: "p001", clientName: "Nike", projectName: "SB Dunk x Outlander Collab", type: "Brand Collab", budget: 55000, actual: 12000, margin: 42, status: "active" },
  { id: "p002", clientName: "The North Face", projectName: "Black Series Campaign", type: "Paid Partnership", budget: 38000, actual: 24000, margin: 31, status: "active" },
  { id: "p003", clientName: "New Balance", projectName: "990v6 Digital Campaign", type: "Paid Partnership", budget: 28000, actual: 18500, margin: 24, status: "in-review" },
  { id: "p004", clientName: "Carhartt WIP", projectName: "SS26 Brand Awareness Push", type: "Paid Partnership", budget: 21000, actual: 9800, margin: 18, status: "active" },
  { id: "p005", clientName: "Palace", projectName: "Tri-Ferg Capsule Feature", type: "Brand Collab", budget: 14000, actual: 11200, margin: 8, status: "in-review" },
  { id: "p006", clientName: "Stüssy", projectName: "SS26 Drop Coverage", type: "Editorial", budget: 5500, actual: 1200, margin: 52, status: "active" },
  { id: "p007", clientName: "BAPE", projectName: "Tokyo Collection Editorial", type: "Editorial", budget: 9500, actual: 8800, margin: 7, status: "in-review" },
];

// ---- EXPENSE BREAKDOWN ----

export interface ExpenseCategory {
  category: string;
  amount: number;
  percentOfRevenue: number;
}

export const expenseBreakdown: ExpenseCategory[] = [
  { category: "Freelancers", amount: 18400, percentOfRevenue: 14 },
  { category: "Studio Hire", amount: 7800, percentOfRevenue: 6 },
  { category: "Travel", amount: 4200, percentOfRevenue: 3 },
  { category: "Equipment", amount: 3500, percentOfRevenue: 3 },
  { category: "Software", amount: 2100, percentOfRevenue: 2 },
  { category: "Marketing", amount: 1800, percentOfRevenue: 1 },
];

// ---- INSTAGRAM POSTS ----

export interface InstagramPost {
  id: string;
  postNumber: number;
  date: string;
  contentType: ContentType;
  caption: string;
  likes: number;
  comments: number;
  saves: number;
  shares: number;
  reach: number;
  impressions: number;
  engagementRate: number; // %
  color: string; // placeholder colour for thumbnail
}

export const instagramPosts: InstagramPost[] = [
  { id: "ig001", postNumber: 1, date: "2026-03-28", contentType: "reel", caption: "BAPE x Outlander — Tokyo Collection", likes: 8420, comments: 312, saves: 1840, shares: 620, reach: 142000, impressions: 198000, engagementRate: 7.9, color: "#B5651D" },
  { id: "ig002", postNumber: 2, date: "2026-03-25", contentType: "carousel", caption: "Nike SB Dunk collab preview 🔥", likes: 11200, comments: 487, saves: 2340, shares: 890, reach: 168000, impressions: 231000, engagementRate: 8.8, color: "#D4A853" },
  { id: "ig003", postNumber: 3, date: "2026-03-22", contentType: "single", caption: "Palace Tri-Ferg — Spring/Summer '26", likes: 5800, comments: 198, saves: 920, shares: 310, reach: 98000, impressions: 134000, engagementRate: 5.6, color: "#7C6B3D" },
  { id: "ig004", postNumber: 4, date: "2026-03-20", contentType: "reel", caption: "Behind the scenes — TNF Black Series shoot", likes: 9800, comments: 421, saves: 1980, shares: 740, reach: 154000, impressions: 210000, engagementRate: 8.1, color: "#4A5568" },
  { id: "ig005", postNumber: 5, date: "2026-03-18", contentType: "carousel", caption: "New Balance 990v6 — 5 ways to style", likes: 7200, comments: 263, saves: 3100, shares: 480, reach: 122000, impressions: 167000, engagementRate: 7.2, color: "#C0A080" },
  { id: "ig006", postNumber: 6, date: "2026-03-15", contentType: "reel", caption: "Adidas Originals SS26 — first look", likes: 13400, comments: 592, saves: 2800, shares: 1120, reach: 188000, impressions: 264000, engagementRate: 9.6, color: "#3B82F6" },
  { id: "ig007", postNumber: 7, date: "2026-03-12", contentType: "single", caption: "Carhartt WIP AW26 Lookbook", likes: 4900, comments: 142, saves: 780, shares: 210, reach: 84000, impressions: 112000, engagementRate: 4.8, color: "#92400E" },
  { id: "ig008", postNumber: 8, date: "2026-03-10", contentType: "carousel", caption: "Stüssy Chapter London — Recap", likes: 6400, comments: 234, saves: 1240, shares: 380, reach: 108000, impressions: 148000, engagementRate: 6.3, color: "#1F2937" },
  { id: "ig009", postNumber: 9, date: "2026-03-07", contentType: "reel", caption: "Outlander x London Fashion Week", likes: 15800, comments: 724, saves: 3400, shares: 1380, reach: 198000, impressions: 276000, engagementRate: 11.2, color: "#6B21A8" },
  { id: "ig010", postNumber: 10, date: "2026-03-05", contentType: "single", caption: "Editorial: Concrete Jungle AW26", likes: 5200, comments: 176, saves: 840, shares: 240, reach: 92000, impressions: 124000, engagementRate: 5.1, color: "#374151" },
  { id: "ig011", postNumber: 11, date: "2026-03-02", contentType: "carousel", caption: "Palace Summer drop — everything you need to know", likes: 8900, comments: 345, saves: 2200, shares: 560, reach: 138000, impressions: 189000, engagementRate: 7.6, color: "#D97706" },
  { id: "ig012", postNumber: 12, date: "2026-02-28", contentType: "reel", caption: "New Balance × Outlander: The Story", likes: 10200, comments: 448, saves: 2680, shares: 820, reach: 162000, impressions: 224000, engagementRate: 8.5, color: "#64748B" },
  { id: "ig013", postNumber: 13, date: "2026-02-25", contentType: "single", caption: "Nike Air Max '26 — drop day", likes: 7800, comments: 312, saves: 1560, shares: 480, reach: 128000, impressions: 174000, engagementRate: 7.0, color: "#DC2626" },
  { id: "ig014", postNumber: 14, date: "2026-02-22", contentType: "carousel", caption: "Styling BAPE: 5 fits for spring", likes: 6100, comments: 218, saves: 1820, shares: 320, reach: 102000, impressions: 140000, engagementRate: 6.4, color: "#16A34A" },
  { id: "ig015", postNumber: 15, date: "2026-02-18", contentType: "reel", caption: "Carhartt WIP: Built for the city", likes: 9400, comments: 387, saves: 1920, shares: 680, reach: 148000, impressions: 204000, engagementRate: 8.0, color: "#78350F" },
  { id: "ig016", postNumber: 16, date: "2026-02-15", contentType: "single", caption: "Adidas Samba Micro — under the radar", likes: 4600, comments: 132, saves: 740, shares: 190, reach: 78000, impressions: 106000, engagementRate: 4.5, color: "#1D4ED8" },
];

// ---- INSTAGRAM ACCOUNT METRICS (monthly) ----

export interface InstagramMonthlyMetrics {
  month: string;
  followers: number;
  weeklyReach: number;
  avgEngagementRate: number;
  profileVisits: number;
  websiteClicks: number;
  impressions: number;
}

export const instagramMonthlyMetrics: InstagramMonthlyMetrics[] = [
  { month: "Apr '25", followers: 118000, weeklyReach: 280000, avgEngagementRate: 5.8, profileVisits: 12400, websiteClicks: 3200, impressions: 820000 },
  { month: "May '25", followers: 121000, weeklyReach: 298000, avgEngagementRate: 6.1, profileVisits: 13100, websiteClicks: 3400, impressions: 860000 },
  { month: "Jun '25", followers: 124000, weeklyReach: 312000, avgEngagementRate: 6.4, profileVisits: 14200, websiteClicks: 3700, impressions: 910000 },
  { month: "Jul '25", followers: 126500, weeklyReach: 295000, avgEngagementRate: 5.9, profileVisits: 12800, websiteClicks: 3100, impressions: 880000 },
  { month: "Aug '25", followers: 128000, weeklyReach: 278000, avgEngagementRate: 5.5, profileVisits: 11900, websiteClicks: 2800, impressions: 820000 },
  { month: "Sep '25", followers: 132000, weeklyReach: 340000, avgEngagementRate: 7.2, profileVisits: 16800, websiteClicks: 4400, impressions: 1020000 },
  { month: "Oct '25", followers: 136000, weeklyReach: 358000, avgEngagementRate: 7.6, profileVisits: 18200, websiteClicks: 4800, impressions: 1080000 },
  { month: "Nov '25", followers: 140000, weeklyReach: 372000, avgEngagementRate: 7.9, profileVisits: 19400, websiteClicks: 5100, impressions: 1120000 },
  { month: "Dec '25", followers: 143000, weeklyReach: 342000, avgEngagementRate: 7.1, profileVisits: 16200, websiteClicks: 4200, impressions: 1020000 },
  { month: "Jan '26", followers: 146000, weeklyReach: 388000, avgEngagementRate: 8.2, profileVisits: 21000, websiteClicks: 5600, impressions: 1180000 },
  { month: "Feb '26", followers: 148500, weeklyReach: 368000, avgEngagementRate: 7.8, profileVisits: 19800, websiteClicks: 5200, impressions: 1120000 },
  { month: "Mar '26", followers: 151200, weeklyReach: 412000, avgEngagementRate: 8.6, profileVisits: 23400, websiteClicks: 6100, impressions: 1260000 },
];

// ---- COMPUTED HELPERS ----

export function getTotalRevenueYTD(): number {
  // YTD = Jan + Feb + Mar 2026
  return monthlyRevenue
    .filter(m => m.month.includes("'26"))
    .reduce((sum, m) => sum + m.total, 0);
}

export function getRevenueThisMonth(): number {
  const latest = monthlyRevenue[monthlyRevenue.length - 1];
  return latest.total;
}

export function getOutstandingInvoices(): number {
  return billingEntries
    .filter(b => b.paymentStatus === "pending" || b.paymentStatus === "overdue")
    .reduce((sum, b) => sum + (b.amountInvoiced - b.amountPaid), 0);
}

export function getAvgProjectMargin(): number {
  const margins = activeProjects.map(p => p.margin);
  return Math.round(margins.reduce((a, b) => a + b, 0) / margins.length);
}

export function getAvgEngagementRate(): number {
  const latest = instagramMonthlyMetrics[instagramMonthlyMetrics.length - 1];
  return latest.avgEngagementRate;
}

export function getRevenueByCategory(): { name: RevenueCategory; value: number }[] {
  const ytdMonths = monthlyRevenue.filter(m => m.month.includes("'26"));
  return [
    { name: "Paid Partnerships", value: ytdMonths.reduce((s, m) => s + m.paidPartnerships, 0) },
    { name: "Production Fees", value: ytdMonths.reduce((s, m) => s + m.productionFees, 0) },
    { name: "Brand Collaborations", value: ytdMonths.reduce((s, m) => s + m.brandCollaborations, 0) },
    { name: "Editorial", value: ytdMonths.reduce((s, m) => s + m.editorial, 0) },
    { name: "Events", value: ytdMonths.reduce((s, m) => s + m.events, 0) },
  ];
}

export function getCurrentMonthTarget(): { actual: number; target: number } {
  const latest = monthlyRevenue[monthlyRevenue.length - 1];
  return { actual: latest.total, target: latest.target };
}
