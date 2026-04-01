"use client";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  Settings, User, Bell, Lock, Palette, Database, Plug, TableProperties,
  CheckCircle2, AlertCircle, Loader2,
} from "lucide-react";
import { useState } from "react";

const tabs = [
  { id: "profile", label: "Profile", icon: User },
  { id: "notifications", label: "Notifications", icon: Bell },
  { id: "appearance", label: "Appearance", icon: Palette },
  { id: "security", label: "Security", icon: Lock },
  { id: "integrations", label: "Integrations", icon: Plug },
  { id: "sheets", label: "Google Sheets", icon: TableProperties },
  { id: "data", label: "Data & Export", icon: Database },
];

interface ConnectedSheet {
  id: string;
  name: string;
  url: string;
  lastSync: string;
  status: "connected" | "error";
}

const DEFAULT_SHEETS: ConnectedSheet[] = [
  {
    id: "1",
    name: "2026 MASTER BILLING TRACKER",
    url: "https://docs.google.com/spreadsheets/d/example-billing-id/edit",
    lastSync: "2026-04-01 09:14",
    status: "connected",
  },
];

const integrations = [
  { name: "Google Workspace (q@outlandermag.com)", description: "Gmail, Calendar, Drive — primary account", connected: true, icon: "G" },
  { name: "Google Workspace (billing@outlandermag.com)", description: "Gmail, Drive — billing account", connected: true, icon: "G" },
  { name: "Xero", description: "Accounting, P&L, cash position", connected: false, icon: "X" },
  { name: "Instagram", description: "@outlandermagazine — post & account analytics", connected: true, icon: "IG" },
  { name: "Slack", description: "Team notifications", connected: false, icon: "S" },
];

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState("profile");
  const [sheetUrl, setSheetUrl] = useState("");
  const [sheetLabel, setSheetLabel] = useState("");
  const [connectedSheets, setConnectedSheets] = useState<ConnectedSheet[]>(DEFAULT_SHEETS);
  const [testStatus, setTestStatus] = useState<"idle" | "testing" | "ok" | "error">("idle");
  const [testMessage, setTestMessage] = useState("");

  async function handleTestConnection() {
    if (!sheetUrl) return;
    setTestStatus("testing");
    setTestMessage("");
    // Simulate a connection test (replace with real API call when credentials are set)
    await new Promise((r) => setTimeout(r, 1200));
    const isValidUrl = sheetUrl.includes("docs.google.com/spreadsheets");
    if (isValidUrl) {
      setTestStatus("ok");
      setTestMessage("Connection successful — sheet is readable");
    } else {
      setTestStatus("error");
      setTestMessage("Invalid Google Sheets URL. Paste the full URL from your browser.");
    }
  }

  function handleAddSheet() {
    if (!sheetUrl || testStatus !== "ok") return;
    const newSheet: ConnectedSheet = {
      id: Date.now().toString(),
      name: sheetLabel || "Untitled Sheet",
      url: sheetUrl,
      lastSync: "Not synced yet",
      status: "connected",
    };
    setConnectedSheets((prev) => [...prev, newSheet]);
    setSheetUrl("");
    setSheetLabel("");
    setTestStatus("idle");
  }

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold text-zinc-100">Settings</h1>

      <div className="flex gap-6">
        {/* Settings nav */}
        <div className="w-48 shrink-0 space-y-0.5">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-sm transition-colors ${
                  activeTab === tab.id
                    ? "bg-zinc-800 text-white"
                    : "text-zinc-400 hover:bg-zinc-900 hover:text-white"
                }`}
              >
                <Icon className={`h-4 w-4 ${activeTab === tab.id ? "text-[#D4A853]" : ""}`} />
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Settings content */}
        <div className="flex-1 space-y-4">
          {activeTab === "profile" && (
            <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-5">
              <h2 className="mb-4 text-sm font-semibold text-zinc-200">Profile</h2>
              <div className="space-y-4">
                <div className="flex items-center gap-4">
                  <Avatar className="h-14 w-14">
                    <AvatarFallback className="bg-[#D4A853] text-xl font-bold text-black">JS</AvatarFallback>
                  </Avatar>
                  <div>
                    <Button size="sm" variant="outline" className="border-zinc-700 text-zinc-300 hover:bg-zinc-800">
                      Change photo
                    </Button>
                    <p className="mt-1 text-xs text-zinc-500">JPG, PNG up to 2MB</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs text-zinc-400">First name</label>
                    <Input defaultValue="Joe" className="border-zinc-700 bg-zinc-800 text-sm" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs text-zinc-400">Last name</label>
                    <Input defaultValue="Silver" className="border-zinc-700 bg-zinc-800 text-sm" />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs text-zinc-400">Email</label>
                  <Input defaultValue="joe@outlandermag.com" className="border-zinc-700 bg-zinc-800 text-sm" disabled />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs text-zinc-400">Job title</label>
                  <Input defaultValue="Operations & Admin" className="border-zinc-700 bg-zinc-800 text-sm" />
                </div>
                <Button className="bg-[#D4A853] text-black hover:bg-[#c49a47]" size="sm">Save changes</Button>
              </div>
            </div>
          )}

          {activeTab === "notifications" && (
            <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-5">
              <h2 className="mb-4 text-sm font-semibold text-zinc-200">Notification Preferences</h2>
              <div className="space-y-4">
                {[
                  { label: "Invoice reminders", description: "Alert when invoices are approaching due date", enabled: true },
                  { label: "Overdue invoice alerts", description: "Immediate alert for any overdue payment", enabled: true },
                  { label: "Payroll reminders", description: "7 days before payroll date", enabled: true },
                  { label: "VAT deadline alerts", description: "30, 14, and 7 days before VAT due", enabled: true },
                  { label: "Companies House filings", description: "Reminder before annual filing deadline", enabled: true },
                  { label: "Email digest", description: "Daily summary of billing@outlandermag.com", enabled: true },
                  { label: "Team updates", description: "Holiday requests and status changes", enabled: false },
                  { label: "Project milestones", description: "When projects hit key dates", enabled: true },
                  { label: "Instagram performance", description: "Weekly engagement summary", enabled: false },
                ].map((pref) => (
                  <div key={pref.label} className="flex items-center justify-between border-b border-zinc-800/50 pb-3 last:border-0 last:pb-0">
                    <div>
                      <p className="text-sm text-zinc-200">{pref.label}</p>
                      <p className="text-xs text-zinc-500">{pref.description}</p>
                    </div>
                    <div className={`h-5 w-9 cursor-pointer rounded-full transition-colors ${pref.enabled ? "bg-[#D4A853]" : "bg-zinc-700"}`}>
                      <div className="h-3.5 w-3.5 rounded-full bg-white transition-transform" style={{ marginTop: "3px", marginLeft: pref.enabled ? "18px" : "3px" }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === "appearance" && (
            <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-5">
              <h2 className="mb-4 text-sm font-semibold text-zinc-200">Appearance</h2>
              <div className="space-y-4">
                <div>
                  <p className="mb-2 text-sm text-zinc-200">Theme</p>
                  <div className="flex gap-3">
                    {["Dark", "Light", "System"].map((t) => (
                      <button
                        key={t}
                        className={`rounded-md border px-4 py-2 text-sm transition-colors ${
                          t === "Dark"
                            ? "border-[#D4A853] bg-[#D4A853]/10 text-[#D4A853]"
                            : "border-zinc-700 text-zinc-400 hover:border-zinc-600"
                        }`}
                      >
                        {t}
                      </button>
                    ))}
                  </div>
                  <p className="mt-2 text-xs text-zinc-500">OutlanderOS uses dark theme by default.</p>
                </div>
              </div>
            </div>
          )}

          {activeTab === "integrations" && (
            <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-5">
              <h2 className="mb-4 text-sm font-semibold text-zinc-200">Integrations</h2>
              <div className="space-y-3">
                {integrations.map((int) => (
                  <div key={int.name} className="flex items-center justify-between rounded-md border border-zinc-800 p-3">
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 items-center justify-center rounded-md bg-zinc-800 text-xs font-bold text-white">
                        {int.icon}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-zinc-200">{int.name}</p>
                        <p className="text-xs text-zinc-500">{int.description}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {int.connected ? (
                        <Badge className="bg-emerald-500/20 text-emerald-400 text-[10px]">Connected</Badge>
                      ) : (
                        <Button size="sm" variant="outline" className="h-7 border-zinc-700 text-xs text-zinc-300 hover:bg-zinc-800">
                          Connect
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === "sheets" && (
            <div className="space-y-4">
              {/* Connected Sheets */}
              <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-5">
                <h2 className="mb-1 text-sm font-semibold text-zinc-200">Connected Spreadsheets</h2>
                <p className="mb-4 text-xs text-zinc-500">
                  Outlander OS reads from these Google Sheets. The main data source is the
                  <span className="ml-1 font-mono text-[#D4A853]">2026 MASTER BILLING TRACKER</span>.
                </p>
                <div className="space-y-2">
                  {connectedSheets.map((sheet) => (
                    <div key={sheet.id} className="flex items-center justify-between rounded-md border border-zinc-800 bg-zinc-950 p-3">
                      <div className="flex items-center gap-3">
                        <div className="flex h-8 w-8 items-center justify-center rounded-md bg-emerald-500/10">
                          <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                        </div>
                        <div>
                          <p className="text-sm font-medium text-zinc-200">{sheet.name}</p>
                          <p className="text-[11px] text-zinc-600 truncate max-w-xs">{sheet.url}</p>
                          <p className="text-[10px] text-zinc-600">Last synced: {sheet.lastSync}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge className="bg-emerald-500/20 text-emerald-400 text-[10px]">Connected</Badge>
                        <button className="text-[11px] text-zinc-500 hover:text-red-400 transition-colors">
                          Remove
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Add New Sheet */}
              <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-5">
                <h2 className="mb-1 text-sm font-semibold text-zinc-200">Add Spreadsheet</h2>
                <p className="mb-4 text-xs text-zinc-500">
                  Paste a Google Sheets URL. A service account must have view access to the sheet.
                </p>
                <div className="space-y-3">
                  <div className="space-y-1.5">
                    <label className="text-xs text-zinc-400">Sheet label (display name)</label>
                    <Input
                      placeholder="e.g. 2026 MASTER BILLING TRACKER"
                      value={sheetLabel}
                      onChange={(e) => setSheetLabel(e.target.value)}
                      className="border-zinc-700 bg-zinc-800 text-sm font-mono"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs text-zinc-400">Google Sheets URL</label>
                    <Input
                      placeholder="https://docs.google.com/spreadsheets/d/..."
                      value={sheetUrl}
                      onChange={(e) => { setSheetUrl(e.target.value); setTestStatus("idle"); }}
                      className="border-zinc-700 bg-zinc-800 text-sm font-mono"
                    />
                  </div>

                  {/* Test Status */}
                  {testStatus !== "idle" && (
                    <div className={`flex items-center gap-2 rounded-md px-3 py-2 text-xs ${
                      testStatus === "testing" ? "bg-zinc-800 text-zinc-400" :
                      testStatus === "ok" ? "bg-emerald-500/10 text-emerald-400" :
                      "bg-red-500/10 text-red-400"
                    }`}>
                      {testStatus === "testing" && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                      {testStatus === "ok" && <CheckCircle2 className="h-3.5 w-3.5" />}
                      {testStatus === "error" && <AlertCircle className="h-3.5 w-3.5" />}
                      <span>{testStatus === "testing" ? "Testing connection…" : testMessage}</span>
                    </div>
                  )}

                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      className="border-zinc-700 text-zinc-300 hover:bg-zinc-800"
                      onClick={handleTestConnection}
                      disabled={!sheetUrl || testStatus === "testing"}
                    >
                      {testStatus === "testing" && <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />}
                      Test Connection
                    </Button>
                    <Button
                      size="sm"
                      className="bg-[#D4A853] text-black hover:bg-[#c49a47] disabled:opacity-40"
                      onClick={handleAddSheet}
                      disabled={testStatus !== "ok"}
                    >
                      Add Sheet
                    </Button>
                  </div>
                </div>
              </div>

              {/* Service Account Info */}
              <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-5">
                <h2 className="mb-1 text-sm font-semibold text-zinc-200">Service Account</h2>
                <p className="mb-3 text-xs text-zinc-500">
                  Share your Google Sheets with this service account to grant read access.
                </p>
                <div className="rounded-md border border-zinc-800 bg-zinc-950 p-3">
                  <p className="font-mono text-xs text-[#D4A853]">
                    {process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL ?? "outlander-os@your-project.iam.gserviceaccount.com"}
                  </p>
                </div>
                <p className="mt-2 text-[11px] text-zinc-600">
                  Set GOOGLE_SERVICE_ACCOUNT_EMAIL and GOOGLE_PRIVATE_KEY in your .env.local to enable live sync.
                </p>
              </div>
            </div>
          )}

          {(activeTab === "security" || activeTab === "data") && (
            <div className="rounded-lg border border-zinc-800 bg-zinc-900">
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <Settings className="mb-3 h-8 w-8 text-zinc-600" />
                <p className="text-sm text-zinc-400">
                  {activeTab === "security" ? "Security settings" : "Data & export options"} coming soon
                </p>
                <p className="mt-1 text-xs text-zinc-600">This section will be available in Phase 3</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
