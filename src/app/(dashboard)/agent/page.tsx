"use client";

import { useState, useRef, useEffect } from "react";
import { cn } from "@/lib/utils";
import {
  Send,
  Bot,
  ChevronRight,
  ChevronLeft,
  CheckCircle2,
  Circle,
  Clock,
} from "lucide-react";

interface Message {
  id: string;
  role: "user" | "agent";
  content: string;
  timestamp: Date;
}

const GREETING_KEYWORDS = ["hi", "hello", "hey", "greetings", "sup", "yo"];

function getPlaceholderResponse(userMessage: string): string {
  const lower = userMessage.toLowerCase().trim();
  if (GREETING_KEYWORDS.some((k) => lower === k || lower.startsWith(k + " "))) {
    return "Hey Joe. I'm your OutlanderOS agent. Once I'm connected to the operations@ account, I'll be able to help with billing, emails, scheduling, and team coordination. What would you like to set up first?";
  }
  return "I've noted that. Once my integrations are live, I'll be able to action this directly. For now, you can manage this through the Finance or Email tabs.";
}

type ServiceStatus = "connected" | "disconnected" | "pending";

const CONNECTED_SERVICES: Array<{ name: string; status: ServiceStatus }> = [
  { name: "Google (operations@)", status: "pending" },
  { name: "Slack", status: "disconnected" },
  { name: "Xero", status: "disconnected" },
  { name: "Billing Tracker", status: "disconnected" },
];

const CAPABILITIES = [
  "Monitor billing emails",
  "Generate task lists",
  "Send reminders",
  "Track invoice status",
  "Manage calendar",
  "Report on revenue",
];

function StatusDot({ status }: { status: "connected" | "disconnected" | "pending" }) {
  if (status === "connected") return <span className="h-2 w-2 rounded-full bg-emerald-400" />;
  if (status === "pending") return <span className="h-2 w-2 rounded-full bg-[#D4A853]" />;
  return <span className="h-2 w-2 rounded-full bg-neutral-600" />;
}

function TypingIndicator() {
  return (
    <div className="flex items-end gap-3">
      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#D4A853]/20 ring-1 ring-[#D4A853]/30">
        <Bot className="h-4 w-4 text-[#D4A853]" />
      </div>
      <div className="rounded-2xl rounded-bl-sm border border-[#D4A853]/20 bg-neutral-900 px-4 py-3">
        <div className="flex items-center gap-1">
          <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[#D4A853]/60 [animation-delay:0ms]" />
          <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[#D4A853]/60 [animation-delay:150ms]" />
          <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[#D4A853]/60 [animation-delay:300ms]" />
        </div>
      </div>
    </div>
  );
}

function formatTime(date: Date) {
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function renderMarkdown(text: string) {
  // Very lightweight inline markdown: bold, italic, code
  return text
    .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.*?)\*/g, "<em>$1</em>")
    .replace(/`(.*?)`/g, '<code class="rounded bg-neutral-800 px-1 py-0.5 text-xs font-mono text-[#D4A853]">$1</code>');
}

export default function AgentPage() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "init",
      role: "agent",
      content:
        "Hey Joe. I'm your OutlanderOS agent. Once I'm connected to the operations@ account, I'll be able to help with billing, emails, scheduling, and team coordination. What would you like to set up first?",
      timestamp: new Date(),
    },
  ]);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [panelOpen, setPanelOpen] = useState(true);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isTyping]);

  async function handleSend() {
    const text = input.trim();
    if (!text) return;
    setInput("");

    const userMsg: Message = {
      id: crypto.randomUUID(),
      role: "user",
      content: text,
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, userMsg]);
    setIsTyping(true);

    await new Promise((r) => setTimeout(r, 900 + Math.random() * 600));

    const agentMsg: Message = {
      id: crypto.randomUUID(),
      role: "agent",
      content: getPlaceholderResponse(text),
      timestamp: new Date(),
    };
    setIsTyping(false);
    setMessages((prev) => [...prev, agentMsg]);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  return (
    <div className="flex h-full overflow-hidden rounded-xl border border-neutral-800 bg-neutral-950">
      {/* Chat area */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-neutral-800 px-5 py-3">
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#D4A853]/20 ring-1 ring-[#D4A853]/40">
                <Bot className="h-5 w-5 text-[#D4A853]" />
              </div>
              <span className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full border-2 border-neutral-950 bg-[#D4A853]" />
            </div>
            <div>
              <p className="text-sm font-semibold text-white">OutlanderOS Agent</p>
              <p className="text-[11px] text-neutral-500">operations@outlandermag.com</p>
            </div>
          </div>
          <button
            onClick={() => setPanelOpen(!panelOpen)}
            className="rounded-md p-1.5 text-neutral-500 hover:bg-neutral-800 hover:text-white transition-colors"
            title={panelOpen ? "Hide panel" : "Show panel"}
          >
            {panelOpen ? (
              <ChevronRight className="h-4 w-4" />
            ) : (
              <ChevronLeft className="h-4 w-4" />
            )}
          </button>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={cn(
                "flex items-end gap-3",
                msg.role === "user" ? "flex-row-reverse" : "flex-row"
              )}
            >
              {msg.role === "agent" && (
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#D4A853]/20 ring-1 ring-[#D4A853]/30">
                  <Bot className="h-4 w-4 text-[#D4A853]" />
                </div>
              )}
              <div
                className={cn(
                  "max-w-[70%] space-y-1",
                  msg.role === "user" ? "items-end" : "items-start",
                  "flex flex-col"
                )}
              >
                <div
                  className={cn(
                    "rounded-2xl px-4 py-2.5 text-sm leading-relaxed",
                    msg.role === "user"
                      ? "rounded-br-sm bg-neutral-800 text-white"
                      : "rounded-bl-sm border border-[#D4A853]/20 bg-neutral-900 text-neutral-100 shadow-[0_0_12px_rgba(212,168,83,0.06)]"
                  )}
                  dangerouslySetInnerHTML={{ __html: renderMarkdown(msg.content) }}
                />
                <span className="px-1 text-[10px] text-neutral-600">
                  {formatTime(msg.timestamp)}
                </span>
              </div>
            </div>
          ))}
          {isTyping && <TypingIndicator />}
          <div ref={bottomRef} />
        </div>

        {/* Input */}
        <div className="border-t border-neutral-800 p-4">
          <div className="flex items-end gap-3 rounded-xl border border-neutral-700 bg-neutral-900 px-4 py-3 focus-within:border-[#D4A853]/40 transition-colors">
            <textarea
              ref={inputRef}
              rows={1}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Message OutlanderOS Agent…"
              className="flex-1 resize-none bg-transparent text-sm text-white placeholder-neutral-600 outline-none"
              style={{ maxHeight: 120 }}
            />
            <button
              onClick={handleSend}
              disabled={!input.trim()}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#D4A853] text-neutral-950 transition-opacity disabled:opacity-30 hover:bg-[#C49843]"
            >
              <Send className="h-4 w-4" />
            </button>
          </div>
          <p className="mt-1.5 text-center text-[10px] text-neutral-700">
            Shift+Enter for newline · Enter to send
          </p>
        </div>
      </div>

      {/* Right panel */}
      {panelOpen && (
        <aside className="flex w-64 shrink-0 flex-col gap-5 overflow-y-auto border-l border-neutral-800 p-4">
          {/* Connected Services */}
          <div>
            <h3 className="mb-2.5 text-[11px] font-semibold uppercase tracking-wider text-neutral-500">
              Connected Services
            </h3>
            <ul className="space-y-2">
              {CONNECTED_SERVICES.map((svc) => (
                <li
                  key={svc.name}
                  className="flex items-center justify-between rounded-lg border border-neutral-800 bg-neutral-900 px-3 py-2"
                >
                  <span className="text-xs text-neutral-300">{svc.name}</span>
                  <div className="flex items-center gap-1.5">
                    <StatusDot status={svc.status} />
                    <span
                      className={cn(
                        "text-[10px]",
                        svc.status === "connected"
                          ? "text-emerald-400"
                          : svc.status === "pending"
                          ? "text-[#D4A853]"
                          : "text-neutral-600"
                      )}
                    >
                      {svc.status === "connected"
                        ? "Active"
                        : svc.status === "pending"
                        ? "Pending"
                        : "Off"}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          </div>

          {/* Recent Activity */}
          <div>
            <h3 className="mb-2.5 text-[11px] font-semibold uppercase tracking-wider text-neutral-500">
              Recent Activity
            </h3>
            <div className="rounded-lg border border-neutral-800 bg-neutral-900 px-3 py-3">
              <div className="flex items-center gap-2 text-neutral-600">
                <Clock className="h-3.5 w-3.5 shrink-0" />
                <p className="text-xs">No activity yet. Connect an integration to get started.</p>
              </div>
            </div>
          </div>

          {/* Capabilities */}
          <div>
            <h3 className="mb-2.5 text-[11px] font-semibold uppercase tracking-wider text-neutral-500">
              Capabilities
            </h3>
            <ul className="space-y-1.5">
              {CAPABILITIES.map((cap) => (
                <li key={cap} className="flex items-center gap-2">
                  <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-[#D4A853]/60" />
                  <span className="text-xs text-neutral-400">{cap}</span>
                </li>
              ))}
            </ul>
          </div>
        </aside>
      )}
    </div>
  );
}
