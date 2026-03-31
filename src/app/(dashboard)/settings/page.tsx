"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Settings, User, Bell, Lock, Palette, Database, Plug } from "lucide-react";
import { useState } from "react";

const tabs = [
  { id: "profile", label: "Profile", icon: User },
  { id: "notifications", label: "Notifications", icon: Bell },
  { id: "appearance", label: "Appearance", icon: Palette },
  { id: "security", label: "Security", icon: Lock },
  { id: "integrations", label: "Integrations", icon: Plug },
  { id: "data", label: "Data & Export", icon: Database },
];

const integrations = [
  { name: "Google Workspace", description: "Gmail, Calendar, Drive", connected: true, icon: "G" },
  { name: "Xero", description: "Accounting & invoices", connected: false, icon: "X" },
  { name: "Slack", description: "Team notifications", connected: false, icon: "S" },
  { name: "Notion", description: "Docs & wikis", connected: false, icon: "N" },
];

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState("profile");

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold text-neutral-100">Settings</h1>

      <div className="flex gap-6">
        {/* Settings nav */}
        <div className="w-44 shrink-0 space-y-0.5">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-sm transition-colors ${
                  activeTab === tab.id
                    ? "bg-neutral-800 text-white"
                    : "text-neutral-400 hover:bg-neutral-900 hover:text-white"
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
            <>
              <Card className="border-neutral-800 bg-neutral-900">
                <CardHeader>
                  <CardTitle className="text-sm font-semibold text-neutral-200">Profile</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center gap-4">
                    <Avatar className="h-14 w-14">
                      <AvatarFallback className="bg-[#D4A853] text-xl font-bold text-black">JS</AvatarFallback>
                    </Avatar>
                    <div>
                      <Button size="sm" variant="outline" className="border-neutral-700 text-neutral-300 hover:bg-neutral-800">
                        Change photo
                      </Button>
                      <p className="mt-1 text-xs text-neutral-500">JPG, PNG up to 2MB</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-xs text-neutral-400">First name</label>
                      <Input defaultValue="Joe" className="border-neutral-700 bg-neutral-800 text-sm" />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs text-neutral-400">Last name</label>
                      <Input defaultValue="Silver" className="border-neutral-700 bg-neutral-800 text-sm" />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs text-neutral-400">Email</label>
                    <Input defaultValue="joe@outlandermag.com" className="border-neutral-700 bg-neutral-800 text-sm" disabled />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs text-neutral-400">Job title</label>
                    <Input defaultValue="Operations & Admin" className="border-neutral-700 bg-neutral-800 text-sm" />
                  </div>
                  <Button className="bg-[#D4A853] text-black hover:bg-[#c49a47]" size="sm">
                    Save changes
                  </Button>
                </CardContent>
              </Card>
            </>
          )}

          {activeTab === "notifications" && (
            <Card className="border-neutral-800 bg-neutral-900">
              <CardHeader>
                <CardTitle className="text-sm font-semibold text-neutral-200">Notification Preferences</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {[
                  { label: "Email digest", description: "Daily summary of key actions", enabled: true },
                  { label: "Task reminders", description: "Alerts for overdue or urgent tasks", enabled: true },
                  { label: "Finance alerts", description: "Overdue invoices and budget warnings", enabled: true },
                  { label: "Team updates", description: "Holiday requests and status changes", enabled: false },
                  { label: "Project milestones", description: "When projects hit key dates", enabled: true },
                ].map((pref) => (
                  <div key={pref.label} className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-neutral-200">{pref.label}</p>
                      <p className="text-xs text-neutral-500">{pref.description}</p>
                    </div>
                    <div className={`h-5 w-9 rounded-full transition-colors cursor-pointer ${pref.enabled ? "bg-[#D4A853]" : "bg-neutral-700"}`}>
                      <div className={`h-3.5 w-3.5 rounded-full bg-white mt-0.75 transition-transform ${pref.enabled ? "translate-x-4" : "translate-x-0.5"}`} style={{ marginTop: "3px", marginLeft: pref.enabled ? "18px" : "3px" }} />
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {activeTab === "appearance" && (
            <Card className="border-neutral-800 bg-neutral-900">
              <CardHeader>
                <CardTitle className="text-sm font-semibold text-neutral-200">Appearance</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <p className="text-sm text-neutral-200 mb-2">Theme</p>
                  <div className="flex gap-3">
                    {["Dark", "Light", "System"].map((t) => (
                      <button
                        key={t}
                        className={`rounded-md border px-4 py-2 text-sm transition-colors ${
                          t === "Dark"
                            ? "border-[#D4A853] bg-[#D4A853]/10 text-[#D4A853]"
                            : "border-neutral-700 text-neutral-400 hover:border-neutral-600"
                        }`}
                      >
                        {t}
                      </button>
                    ))}
                  </div>
                  <p className="mt-2 text-xs text-neutral-500">OutlanderOS uses dark theme by default.</p>
                </div>
                <div>
                  <p className="text-sm text-neutral-200 mb-2">Accent colour</p>
                  <div className="flex gap-2">
                    {["#D4A853", "#60a5fa", "#34d399", "#f472b6", "#a78bfa"].map((c) => (
                      <button
                        key={c}
                        className={`h-7 w-7 rounded-full border-2 transition-transform hover:scale-110 ${c === "#D4A853" ? "border-white scale-110" : "border-transparent"}`}
                        style={{ background: c }}
                      />
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {activeTab === "integrations" && (
            <Card className="border-neutral-800 bg-neutral-900">
              <CardHeader>
                <CardTitle className="text-sm font-semibold text-neutral-200">Integrations</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {integrations.map((int) => (
                  <div key={int.name} className="flex items-center justify-between rounded-md border border-neutral-800 p-3">
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 items-center justify-center rounded-md bg-neutral-800 font-bold text-sm text-white">
                        {int.icon}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-neutral-200">{int.name}</p>
                        <p className="text-xs text-neutral-500">{int.description}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {int.connected ? (
                        <Badge className="bg-emerald-500/20 text-emerald-400 text-[10px]">Connected</Badge>
                      ) : (
                        <Button size="sm" variant="outline" className="h-7 border-neutral-700 text-xs text-neutral-300 hover:bg-neutral-800">
                          Connect
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {(activeTab === "security" || activeTab === "data") && (
            <Card className="border-neutral-800 bg-neutral-900">
              <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                <Settings className="h-8 w-8 text-neutral-600 mb-3" />
                <p className="text-sm text-neutral-400">
                  {activeTab === "security" ? "Security settings" : "Data & export options"} coming soon
                </p>
                <p className="text-xs text-neutral-600 mt-1">This section will be available in Phase 2</p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
