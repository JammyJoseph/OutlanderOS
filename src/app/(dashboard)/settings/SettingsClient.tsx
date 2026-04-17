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
  Hash,
  ExternalLink,
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
    const xeroConnected = searchParams.get("xero_connected");
    const error = searchParams.get("error");
    const xeroError = searchParams.get("xero_error");
    if (connected) {
      onConnected(connected);
      router.replace("/settings");
    } else if (xeroConnected) {
      onConnected("xero");
      router.replace("/settings");
    } else if (error) {
      onError(
        error === "no_code"
          ? "Authorization cancelled."
          : "Connection failed. Please try again."
      );
      router.replace("/settings");
    } else if (xeroError) {
      onError("Xero connection failed. Please try again.");
      router.replace("/settings");
    }
  }, [searchParams, router, onConnected, onError]);

  return null;
}

interface SettingsClientProps {
  initialPrimary: boolean;
  initialBilling: boolean;
  initialXeroConnected?: boolean;
}

export default function SettingsClient({ initialPrimary, initialBilling, initialXeroConnected = false }: SettingsClientProps) {
  const router = useRouter();

  useEffect(() => {
    fetch('/api/xero/data')
      .then(r => r.json())
      .then(d => setXeroConnected(d.connected === true))
      .catch(() => {})
  }, []);

  const [connectedAccounts, setConnectedAccounts] = useState<Record<string, boolean>>({
    primary: initialPrimary,
    billing: initialBilling,
  });
  const [xeroConnected, setXeroConnected] = useState(initialXeroConnected);
  const [slackToken, setSlackToken] = useState("");
  const [slackStatus, setSlackStatus] = useState<"idle" | "connecting" | "connected" | "error">("idle");
  const [slackWorkspace, setSlackWorkspace] = useState<string | null>(null);
  const [slackChannels, setSlackChannels] = useState<Array<{ id: string; name: string }>>([]);
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

  async function handleConnectSlack() {
    if (!slackToken.trim()) return;
    setSlackStatus("connecting");
    try {
      const res = await fetch("/api/slack/channels", {
        headers: { Authorization: `Bearer ${slackToken}` },
      });
      if (res.ok) {
        const data = await res.json();
        setSlackChannels(
          (data.channels || []).slice(0, 10).map((c: { id: string; name: string }) => ({
            id: c.id,
            name: c.name,
          }))
        );
        setSlackWorkspace("Connected workspace");
        setSlackStatus("connected");
      } else {
        setSlackStatus("error");
      }
    } catch {
      setSlackStatus("error");
    }
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
      <h1 className="text-xl font-semibold text-gray-900">Settings</h1>

      <Suspense fallback={null}>
        <OAuthHandler
          onConnected={(label) => {
            if (label === "xero") {
              setXeroConnected(true);
              setBanner({ type: "success", message: "Xero connected successfully." });
            } else {
              setConnectedAccounts((prev) => ({ ...prev, [label]: true }));
              setBanner({ type: "success", message: `${label} account connected successfully.` });
            }
          }}
          onError={(msg) => setBanner({ type: "error", message: msg })}
        />
      </Suspense>

      {/* Banner */}
      {banner && (
        <div
          className={`flex items-center justify-between rounded-lg border px-4 py-3 text-sm ${
            banner.type === "success"
              ? "border-emerald-200 bg-emerald-50 text-emerald-700"
              : "border-red-200 bg-red-50 text-red-600"
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
          <h2 className="text-sm font-semibold text-gray-800">Connected Accounts</h2>
        </div>
        <div className="space-y-3">
          {accountCards.map((account) => {
            const connected = connectedAccounts[account.id];
            return (
              <div
                key={account.id}
                className={`flex items-center justify-between rounded-lg border p-4 transition-colors ${
                  connected
                    ? "border-emerald-200 bg-emerald-50"
                    : "border-gray-200 bg-gray-50"
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className={`flex h-9 w-9 items-center justify-center rounded-md text-sm font-bold ${
                    connected ? "bg-emerald-100 text-emerald-600" : "bg-gray-100 text-gray-700"
                  }`}>
                    G
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-900">{account.label}</p>
                    <p className="text-xs text-gray-500">
                      {account.email} · {account.description}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {connected ? (
                    <>
                      <div className="flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-100 px-2.5 py-1">
                        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                        <span className="text-[11px] font-medium text-emerald-600">Connected</span>
                      </div>
                      <button
                        onClick={() =>
                          setConnectedAccounts((prev) => ({ ...prev, [account.id]: false }))
                        }
                        className="text-xs text-gray-400 hover:text-red-500 transition-colors"
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
          <h2 className="text-sm font-semibold text-gray-800">Google Sheets</h2>
        </div>

        {connectedSheets.length > 0 && (
          <div className="mb-3 space-y-2">
            {connectedSheets.map((sheet) => (
              <div
                key={sheet.id}
                className="flex items-center justify-between rounded-lg border border-gray-200 bg-white p-3"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" />
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-800">{sheet.name}</p>
                    <p className="truncate text-[11px] text-gray-400">{sheet.url}</p>
                  </div>
                </div>
                <button
                  onClick={() =>
                    setConnectedSheets((prev) => prev.filter((s) => s.id !== sheet.id))
                  }
                  className="ml-4 shrink-0 text-xs text-gray-400 hover:text-red-500 transition-colors"
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 space-y-3">
          <p className="text-xs text-gray-500">
            Paste a Google Sheets URL to link your billing tracker or other spreadsheets.
          </p>
          <div className="space-y-1.5">
            <label className="text-xs text-gray-600">Sheet label</label>
            <Input
              placeholder="e.g. 2026 MASTER BILLING TRACKER"
              value={sheetLabel}
              onChange={(e) => setSheetLabel(e.target.value)}
              className="border-gray-200 bg-white text-sm font-mono"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs text-gray-600">Google Sheets URL</label>
            <Input
              placeholder="https://docs.google.com/spreadsheets/d/..."
              value={sheetUrl}
              onChange={(e) => {
                setSheetUrl(e.target.value);
                setTestStatus("idle");
              }}
              className="border-gray-200 bg-white text-sm font-mono"
            />
          </div>

          {testStatus !== "idle" && (
            <div
              className={`flex items-center gap-2 rounded-md px-3 py-2 text-xs ${
                testStatus === "testing"
                  ? "bg-gray-100 text-gray-500"
                  : testStatus === "ok"
                  ? "bg-emerald-50 text-emerald-600"
                  : "bg-red-50 text-red-600"
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
              className="border-gray-200 text-gray-700 hover:bg-gray-100"
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

      {/* Slack */}
      <section>
        <div className="mb-3 flex items-center gap-2">
          <Hash className="h-4 w-4 text-[#D4A853]" />
          <h2 className="text-sm font-semibold text-gray-800">Slack</h2>
        </div>
        <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 space-y-3">
          {slackStatus === "connected" ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-emerald-500" />
                  <span className="text-sm text-gray-800 font-medium">{slackWorkspace}</span>
                </div>
                <button
                  onClick={() => {
                    setSlackStatus("idle");
                    setSlackToken("");
                    setSlackWorkspace(null);
                    setSlackChannels([]);
                  }}
                  className="text-xs text-gray-400 hover:text-red-500 transition-colors"
                >
                  Disconnect
                </button>
              </div>
              {slackChannels.length > 0 && (
                <div className="space-y-1">
                  <p className="text-[11px] text-gray-500">Bot is in {slackChannels.length} channel{slackChannels.length !== 1 ? "s" : ""}:</p>
                  <ul className="space-y-1">
                    {slackChannels.map((ch) => (
                      <li key={ch.id} className="flex items-center gap-1.5 text-xs text-gray-600">
                        <Hash className="h-3 w-3 text-gray-400" />
                        {ch.name}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          ) : (
            <>
              <p className="text-xs text-gray-500">
                Connect your Slack workspace so the OutlanderOS Agent can read channels and send messages.
              </p>
              <div className="space-y-1.5">
                <label className="text-xs text-gray-600">Slack Bot Token</label>
                <Input
                  type="password"
                  placeholder="xoxb-…"
                  value={slackToken}
                  onChange={(e) => {
                    setSlackToken(e.target.value);
                    setSlackStatus("idle");
                  }}
                  className="border-gray-200 bg-white text-sm font-mono"
                />
              </div>
              {slackStatus === "error" && (
                <div className="flex items-center gap-2 rounded-md bg-red-50 px-3 py-2 text-xs text-red-600">
                  <AlertCircle className="h-3.5 w-3.5" />
                  <span>Connection failed. Check your token and try again.</span>
                </div>
              )}
              <Button
                size="sm"
                onClick={handleConnectSlack}
                disabled={!slackToken.trim() || slackStatus === "connecting"}
                className="bg-[#D4A853] text-zinc-900 hover:bg-[#C49843] disabled:opacity-40"
              >
                {slackStatus === "connecting" && <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />}
                Connect Slack
              </Button>
            </>
          )}
        </div>
      </section>

      {/* Integrations */}
      <section>
        <div className="mb-3 flex items-center gap-2">
          <Plug className="h-4 w-4 text-[#D4A853]" />
          <h2 className="text-sm font-semibold text-gray-800">Integrations</h2>
        </div>
        <div className="space-y-2">
          {/* Xero */}
          <div
            className={`flex items-center justify-between rounded-lg border p-3 transition-colors ${
              xeroConnected ? "border-emerald-200 bg-emerald-50" : "border-gray-200 bg-gray-50"
            }`}
          >
            <div className="flex items-center gap-3">
              <div className={`flex h-9 w-9 items-center justify-center rounded-md text-xs font-bold ${
                xeroConnected ? "bg-emerald-100 text-emerald-600" : "bg-gray-100 text-gray-500"
              }`}>
                X
              </div>
              <div>
                <p className="text-sm font-medium text-gray-800">Xero</p>
                <p className="text-xs text-gray-500">Accounting, P&amp;L &amp; invoices</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {xeroConnected ? (
                <>
                  <div className="flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-100 px-2.5 py-1">
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                    <span className="text-[11px] font-medium text-emerald-600">Connected</span>
                  </div>
                  <button
                    onClick={() => setXeroConnected(false)}
                    className="text-xs text-gray-400 hover:text-red-500 transition-colors"
                  >
                    Disconnect
                  </button>
                </>
              ) : (
                <Button
                  size="sm"
                  onClick={() => router.push('/api/xero/connect')}
                  className="bg-[#D4A853] text-zinc-900 hover:bg-[#C49843]"
                >
                  <ExternalLink className="mr-1.5 h-3.5 w-3.5" />
                  Connect
                </Button>
              )}
            </div>
          </div>

          {/* Instagram */}
          <div className="flex items-center justify-between rounded-lg border border-gray-200 bg-gray-50 p-3">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-md bg-gray-100 text-xs font-bold text-gray-500">
                IG
              </div>
              <div>
                <p className="text-sm font-medium text-gray-800">Instagram</p>
                <p className="text-xs text-gray-500">@outlandermagazine analytics — coming soon</p>
              </div>
            </div>
            <Badge className="bg-gray-100 text-[10px] text-gray-500">Coming soon</Badge>
          </div>

          {/* Claude AI Agent */}
          <div className="p-4 border border-gray-200 bg-white rounded-lg">
            <h3 className="text-sm font-semibold text-gray-900 mb-1">AI Agent (Claude)</h3>
            <p className="text-xs text-gray-500 mb-2">Powers the Agent Office group chat with real reasoning</p>
            <div className="text-xs text-amber-600">Configure ANTHROPIC_API_KEY in server environment</div>
          </div>
        </div>
      </section>
    </div>
  );
}
