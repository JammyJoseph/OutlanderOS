"use client";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  CheckCircle2,
  AlertCircle,
  Loader2,
  Link2,
  TableProperties,
  Plug,
  X,
} from "lucide-react";
import { useState, useEffect, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";

interface ConnectedSheet {
  id: string;
  name: string;
  url: string;
  addedAt: string;
}

function OAuthHandler({
  onConnected,
  onError,
}: {
  onConnected: (label: string) => void;
  onError: (msg: string) => void;
}) {
  const searchParams = useSearchParams();
  const router = useRouter();

  useEffect(() => {
    const connected = searchParams.get("connected");
    const error = searchParams.get("error");
    if (connected) {
      onConnected(connected);
      router.replace("/settings");
    } else if (error) {
      onError(
        error === "no_code"
          ? "Authorization cancelled."
          : "Connection failed. Please try again."
      );
      router.replace("/settings");
    }
  }, [searchParams, router, onConnected, onError]);

  return null;
}

export default function SettingsPage() {
  const router = useRouter();

  const [connectedAccounts, setConnectedAccounts] = useState<Record<string, boolean>>({
    primary: false,
    billing: false,
  });
  const [connectedSheets, setConnectedSheets] = useState<ConnectedSheet[]>([]);
  const [sheetUrl, setSheetUrl] = useState("");
  const [sheetLabel, setSheetLabel] = useState("");
  const [testStatus, setTestStatus] = useState<"idle" | "testing" | "ok" | "error">("idle");
  const [testMessage, setTestMessage] = useState("");
  const [banner, setBanner] = useState<{ type: "success" | "error"; message: string } | null>(null);

  async function handleTestConnection() {
    if (!sheetUrl) return;
    setTestStatus("testing");
    setTestMessage("");
    await new Promise((r) => setTimeout(r, 900));
    if (sheetUrl.includes("docs.google.com/spreadsheets")) {
      setTestStatus("ok");
      setTestMessage("URL looks valid — save to link this sheet.");
    } else {
      setTestStatus("error");
      setTestMessage("Invalid Google Sheets URL. Paste the full URL from your browser.");
    }
  }

  function handleAddSheet() {
    if (!sheetUrl || testStatus !== "ok") return;
    setConnectedSheets((prev) => [
      ...prev,
      {
        id: Date.now().toString(),
        name: sheetLabel || "Untitled Sheet",
        url: sheetUrl,
        addedAt: new Date().toLocaleString(),
      },
    ]);
    setSheetUrl("");
    setSheetLabel("");
    setTestStatus("idle");
  }

  const accountCards = [
    {
      id: "primary",
      label: "Primary Account",
      email: "q@outlandermag.com",
      description: "Gmail, Calendar, Drive",
    },
    {
      id: "billing",
      label: "Billing Account",
      email: "billing@outlandermag.com",
      description: "Gmail, invoices, finance emails",
    },
  ];

  return (
    <div className="max-w-2xl space-y-6">
      <h1 className="text-xl font-semibold text-zinc-100">Settings</h1>

      {/* Handles OAuth return params — wrapped in Suspense to satisfy Next.js build */}
      <Suspense fallback={null}>
        <OAuthHandler
          onConnected={(label) => {
            setConnectedAccounts((prev) => ({ ...prev, [label]: true }));
            setBanner({ type: "success", message: `${label} account connected successfully.` });
          }}
          onError={(msg) => setBanner({ type: "error", message: msg })}
        />
      </Suspense>

      {/* Banner */}
      {banner && (
        <div
          className={`flex items-center justify-between rounded-lg border px-4 py-3 text-sm ${
            banner.type === "success"
              ? "border-emerald-800/40 bg-emerald-900/10 text-emerald-400"
              : "border-red-800/40 bg-red-900/10 text-red-400"
          }`}
        >
          <span>{banner.message}</span>
          <button onClick={() => setBanner(null)}>
            <X className="h-4 w-4 opacity-60 hover:opacity-100" />
          </button>
        </div>
      )}

      {/* Connected Accounts */}
      <section>
        <div className="mb-3 flex items-center gap-2">
          <Link2 className="h-4 w-4 text-[#D4A853]" />
          <h2 className="text-sm font-semibold text-zinc-200">Connected Accounts</h2>
        </div>
        <div className="space-y-3">
          {accountCards.map((account) => {
            const connected = connectedAccounts[account.id];
            return (
              <div
                key={account.id}
                className="flex items-center justify-between rounded-lg border border-zinc-800 bg-zinc-900 p-4"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-md bg-zinc-800 text-sm font-bold text-white">
                    G
                  </div>
                  <div>
                    <p className="text-sm font-medium text-zinc-100">{account.label}</p>
                    <p className="text-xs text-zinc-500">
                      {account.email} · {account.description}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {connected ? (
                    <>
                      <Badge className="bg-emerald-500/20 text-[10px] text-emerald-400">
                        Connected
                      </Badge>
                      <button
                        onClick={() =>
                          setConnectedAccounts((prev) => ({ ...prev, [account.id]: false }))
                        }
                        className="text-xs text-zinc-500 hover:text-red-400 transition-colors"
                      >
                        Disconnect
                      </button>
                    </>
                  ) : (
                    <Button
                      size="sm"
                      onClick={() =>
                        router.push(`/api/google/connect?label=${account.id}`)
                      }
                      className="bg-[#D4A853] text-zinc-900 hover:bg-[#C49843]"
                    >
                      Connect
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Google Sheets */}
      <section>
        <div className="mb-3 flex items-center gap-2">
          <TableProperties className="h-4 w-4 text-[#D4A853]" />
          <h2 className="text-sm font-semibold text-zinc-200">Google Sheets</h2>
        </div>

        {connectedSheets.length > 0 && (
          <div className="mb-3 space-y-2">
            {connectedSheets.map((sheet) => (
              <div
                key={sheet.id}
                className="flex items-center justify-between rounded-lg border border-zinc-800 bg-zinc-950 p-3"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-zinc-200">{sheet.name}</p>
                    <p className="truncate text-[11px] text-zinc-600">{sheet.url}</p>
                  </div>
                </div>
                <button
                  onClick={() =>
                    setConnectedSheets((prev) => prev.filter((s) => s.id !== sheet.id))
                  }
                  className="ml-4 shrink-0 text-xs text-zinc-600 hover:text-red-400 transition-colors"
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-4 space-y-3">
          <p className="text-xs text-zinc-500">
            Paste a Google Sheets URL to link your billing tracker or other spreadsheets.
          </p>
          <div className="space-y-1.5">
            <label className="text-xs text-zinc-400">Sheet label</label>
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
              onChange={(e) => {
                setSheetUrl(e.target.value);
                setTestStatus("idle");
              }}
              className="border-zinc-700 bg-zinc-800 text-sm font-mono"
            />
          </div>

          {testStatus !== "idle" && (
            <div
              className={`flex items-center gap-2 rounded-md px-3 py-2 text-xs ${
                testStatus === "testing"
                  ? "bg-zinc-800 text-zinc-400"
                  : testStatus === "ok"
                  ? "bg-emerald-500/10 text-emerald-400"
                  : "bg-red-500/10 text-red-400"
              }`}
            >
              {testStatus === "testing" && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              {testStatus === "ok" && <CheckCircle2 className="h-3.5 w-3.5" />}
              {testStatus === "error" && <AlertCircle className="h-3.5 w-3.5" />}
              <span>{testStatus === "testing" ? "Testing…" : testMessage}</span>
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
              {testStatus === "testing" && (
                <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
              )}
              Test URL
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
      </section>

      {/* Integrations */}
      <section>
        <div className="mb-3 flex items-center gap-2">
          <Plug className="h-4 w-4 text-[#D4A853]" />
          <h2 className="text-sm font-semibold text-zinc-200">Integrations</h2>
        </div>
        <div className="space-y-2">
          {[
            { icon: "X", name: "Xero", description: "Accounting & P&L — coming soon" },
            {
              icon: "IG",
              name: "Instagram",
              description: "@outlandermagazine analytics — coming soon",
            },
          ].map((int) => (
            <div
              key={int.name}
              className="flex items-center justify-between rounded-lg border border-zinc-800 bg-zinc-900 p-3"
            >
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-md bg-zinc-800 text-xs font-bold text-zinc-400">
                  {int.icon}
                </div>
                <div>
                  <p className="text-sm font-medium text-zinc-300">{int.name}</p>
                  <p className="text-xs text-zinc-600">{int.description}</p>
                </div>
              </div>
              <Badge className="bg-zinc-800 text-[10px] text-zinc-500">Coming soon</Badge>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
