const TRELLO_API_BASE = "https://api.trello.com/1";

const API_KEY = process.env.TRELLO_API_KEY ?? "";
const TOKEN = process.env.TRELLO_TOKEN ?? "";
const BOARD_ID = process.env.TRELLO_BOARD_ID ?? "";

export interface TrelloLabel {
  id: string;
  name: string;
  color: string | null;
}

export interface TrelloMember {
  id: string;
  fullName: string;
  username: string;
  initials?: string;
  avatarUrl?: string | null;
}

export interface TrelloRawCard {
  id: string;
  name: string;
  desc: string;
  due: string | null;
  labels: TrelloLabel[];
  idMembers: string[];
  idLabels?: string[];
  dateLastActivity: string;
  url: string;
  shortUrl: string;
  idList?: string;
}

export interface TrelloRawList {
  id: string;
  name: string;
  closed: boolean;
  pos: number;
  cards: TrelloRawCard[];
}

export interface TrelloComment {
  id: string;
  text: string;
  date: string;
  memberCreator: {
    id: string;
    fullName: string;
    initials?: string;
    avatarUrl?: string | null;
  };
}

export interface TrelloCheckItem {
  id: string;
  name: string;
  state: "complete" | "incomplete";
  pos: number;
  idChecklist: string;
}

export interface TrelloChecklist {
  id: string;
  name: string;
  pos: number;
  checkItems: TrelloCheckItem[];
}

export interface PipelineCard {
  id: string;
  name: string;
  client: string;
  description: string;
  budget: number | null;
  budgetLabel: string;
  dueDate: string | null;
  lastActivity: string;
  labels: TrelloLabel[];
  members: TrelloMember[];
  url: string;
  listId: string;
}

export interface PipelineStage {
  id: string;
  name: string;
  position: number;
  cards: PipelineCard[];
}

export interface PipelineSnapshot {
  boardId: string;
  boardUrl: string;
  fetchedAt: string;
  stages: PipelineStage[];
  members: TrelloMember[];
  labels: TrelloLabel[];
}

function authParams(): string {
  return `key=${API_KEY}&token=${TOKEN}`;
}

function ensureCreds(): void {
  if (!API_KEY || !TOKEN || !BOARD_ID) {
    throw new Error(
      "Trello credentials missing. Set TRELLO_API_KEY, TRELLO_TOKEN, and TRELLO_BOARD_ID."
    );
  }
}

async function trelloFetch<T>(path: string, init?: RequestInit): Promise<T> {
  ensureCreds();
  const sep = path.includes("?") ? "&" : "?";
  const url = `${TRELLO_API_BASE}${path}${sep}${authParams()}`;
  const res = await fetch(url, { cache: "no-store", ...init });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Trello ${res.status} ${res.statusText}: ${body.slice(0, 200)}`);
  }
  return (await res.json()) as T;
}

export async function fetchBoard() {
  return trelloFetch<{ id: string; name: string; url: string; shortUrl: string }>(
    `/boards/${BOARD_ID}?fields=name,url,shortUrl`
  );
}

export async function fetchLists(): Promise<TrelloRawList[]> {
  return trelloFetch<TrelloRawList[]>(
    `/boards/${BOARD_ID}/lists?cards=open&card_fields=name,desc,due,labels,idLabels,idMembers,dateLastActivity,url,shortUrl,idList&filter=open`
  );
}

export async function fetchCards(): Promise<TrelloRawCard[]> {
  return trelloFetch<TrelloRawCard[]>(
    `/boards/${BOARD_ID}/cards?fields=name,desc,due,labels,idLabels,idMembers,dateLastActivity,url,shortUrl,idList`
  );
}

export async function fetchCard(id: string): Promise<TrelloRawCard> {
  return trelloFetch<TrelloRawCard>(
    `/cards/${id}?fields=name,desc,due,labels,idLabels,idMembers,dateLastActivity,url,shortUrl,idList`
  );
}

export async function fetchMembers(): Promise<TrelloMember[]> {
  const raw = await trelloFetch<
    Array<{ id: string; fullName: string; username: string; initials?: string; avatarUrl?: string | null }>
  >(`/boards/${BOARD_ID}/members?fields=fullName,username,initials,avatarUrl`);
  return raw.map((m) => ({
    id: m.id,
    fullName: m.fullName,
    username: m.username,
    initials: m.initials,
    avatarUrl: m.avatarUrl ? `${m.avatarUrl}/50.png` : null,
  }));
}

export async function fetchBoardLabels(): Promise<TrelloLabel[]> {
  const raw = await trelloFetch<Array<{ id: string; name: string; color: string | null }>>(
    `/boards/${BOARD_ID}/labels?fields=name,color`
  );
  return raw.map((l) => ({ id: l.id, name: l.name, color: l.color }));
}

const BUDGET_REGEX =
  /budget\s*[:\-–]\s*([£$€])\s*([\d]{1,3}(?:[,\s]\d{3})*(?:\.\d+)?|\d+(?:\.\d+)?)/i;

export function parseBudget(desc: string): { value: number | null; label: string } {
  if (!desc) return { value: null, label: "N/A" };
  const m = desc.match(BUDGET_REGEX);
  if (!m) return { value: null, label: "N/A" };
  const symbol = m[1];
  const numeric = Number(m[2].replace(/[,\s]/g, ""));
  if (!Number.isFinite(numeric)) return { value: null, label: "N/A" };
  return { value: numeric, label: `${symbol}${numeric.toLocaleString("en-GB")}` };
}

function deriveClient(cardName: string, labels: TrelloLabel[]): string {
  const brandLabel = labels.find(
    (l) =>
      l.name &&
      !["template", "new brief", "priority", "urgent", "live", "booked", "brief sent", "paid", "print"].includes(
        l.name.toLowerCase()
      )
  );
  if (brandLabel?.name) return brandLabel.name;

  const sepMatch = cardName.match(/^([A-Z0-9 &']+?)(?:\s+[-–—:|]\s+|\s+x\s+)/i);
  if (sepMatch) return sepMatch[1].trim();

  return cardName.split(/[-–—:|]/)[0].trim();
}

export function toPipelineCard(
  raw: TrelloRawCard,
  memberLookup: Map<string, TrelloMember>,
  listId: string
): PipelineCard {
  const members = (raw.idMembers ?? [])
    .map((id) => memberLookup.get(id))
    .filter((m): m is TrelloMember => Boolean(m));

  const budget = parseBudget(raw.desc ?? "");

  return {
    id: raw.id,
    name: raw.name,
    client: deriveClient(raw.name, raw.labels ?? []),
    description: raw.desc ?? "",
    budget: budget.value,
    budgetLabel: budget.label,
    dueDate: raw.due,
    lastActivity: raw.dateLastActivity,
    labels: raw.labels ?? [],
    members,
    url: raw.url || raw.shortUrl,
    listId,
  };
}

export async function buildSnapshot(): Promise<PipelineSnapshot> {
  ensureCreds();
  const [board, lists, members, labels] = await Promise.all([
    fetchBoard(),
    fetchLists(),
    fetchMembers(),
    fetchBoardLabels(),
  ]);

  const memberLookup = new Map<string, TrelloMember>(members.map((m) => [m.id, m]));

  const stages: PipelineStage[] = (lists ?? [])
    .filter((l) => !l.closed)
    .sort((a, b) => a.pos - b.pos)
    .map((list) => ({
      id: list.id,
      name: list.name,
      position: list.pos,
      cards: (list.cards ?? []).map((c) => toPipelineCard(c, memberLookup, list.id)),
    }));

  return {
    boardId: board.id,
    boardUrl: board.shortUrl || board.url,
    fetchedAt: new Date().toISOString(),
    stages,
    members,
    labels,
  };
}

// ---------- Write operations ----------

export interface UpdateCardInput {
  name?: string;
  desc?: string;
  due?: string | null;
  idList?: string;
  idLabels?: string[];
  idMembers?: string[];
  closed?: boolean;
  pos?: number | "top" | "bottom";
}

function buildQuery(input: Record<string, unknown>): string {
  const parts: string[] = [];
  for (const [k, v] of Object.entries(input)) {
    if (v === undefined) continue;
    if (Array.isArray(v)) {
      parts.push(`${encodeURIComponent(k)}=${encodeURIComponent(v.join(","))}`);
    } else if (v === null) {
      parts.push(`${encodeURIComponent(k)}=`);
    } else {
      parts.push(`${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`);
    }
  }
  return parts.join("&");
}

export async function updateCard(cardId: string, input: UpdateCardInput): Promise<TrelloRawCard> {
  const qs = buildQuery(input as Record<string, unknown>);
  const sep = qs ? `?${qs}` : "";
  return trelloFetch<TrelloRawCard>(`/cards/${cardId}${sep}`, { method: "PUT" });
}

export async function moveCard(cardId: string, listId: string, pos?: number | "top" | "bottom"): Promise<TrelloRawCard> {
  return updateCard(cardId, { idList: listId, pos: pos ?? "bottom" });
}

export interface CreateCardInput {
  name: string;
  desc?: string;
  idList: string;
  due?: string | null;
  idLabels?: string[];
  idMembers?: string[];
  pos?: number | "top" | "bottom";
}

export async function createCard(input: CreateCardInput): Promise<TrelloRawCard> {
  const qs = buildQuery({ ...input, pos: input.pos ?? "top" } as Record<string, unknown>);
  return trelloFetch<TrelloRawCard>(`/cards?${qs}`, { method: "POST" });
}

export async function archiveCard(cardId: string): Promise<TrelloRawCard> {
  return updateCard(cardId, { closed: true });
}

export async function addComment(cardId: string, text: string): Promise<TrelloComment> {
  const qs = buildQuery({ text });
  const raw = await trelloFetch<{
    id: string;
    date: string;
    data: { text: string };
    memberCreator: { id: string; fullName: string; initials?: string; avatarUrl?: string | null };
  }>(`/cards/${cardId}/actions/comments?${qs}`, { method: "POST" });
  return {
    id: raw.id,
    text: raw.data.text,
    date: raw.date,
    memberCreator: {
      id: raw.memberCreator.id,
      fullName: raw.memberCreator.fullName,
      initials: raw.memberCreator.initials,
      avatarUrl: raw.memberCreator.avatarUrl ? `${raw.memberCreator.avatarUrl}/50.png` : null,
    },
  };
}

export async function getComments(cardId: string): Promise<TrelloComment[]> {
  const raw = await trelloFetch<
    Array<{
      id: string;
      date: string;
      data: { text: string };
      memberCreator: { id: string; fullName: string; initials?: string; avatarUrl?: string | null };
    }>
  >(`/cards/${cardId}/actions?filter=commentCard&limit=50`);
  return (raw ?? []).map((r) => ({
    id: r.id,
    text: r.data.text,
    date: r.date,
    memberCreator: {
      id: r.memberCreator.id,
      fullName: r.memberCreator.fullName,
      initials: r.memberCreator.initials,
      avatarUrl: r.memberCreator.avatarUrl ? `${r.memberCreator.avatarUrl}/50.png` : null,
    },
  }));
}

export async function getChecklists(cardId: string): Promise<TrelloChecklist[]> {
  const raw = await trelloFetch<
    Array<{
      id: string;
      name: string;
      pos: number;
      checkItems: Array<{ id: string; name: string; state: string; pos: number; idChecklist: string }>;
    }>
  >(`/cards/${cardId}/checklists`);
  return (raw ?? [])
    .sort((a, b) => a.pos - b.pos)
    .map((c) => ({
      id: c.id,
      name: c.name,
      pos: c.pos,
      checkItems: (c.checkItems ?? [])
        .sort((a, b) => a.pos - b.pos)
        .map((it) => ({
          id: it.id,
          name: it.name,
          state: it.state === "complete" ? "complete" : "incomplete",
          pos: it.pos,
          idChecklist: it.idChecklist,
        })),
    }));
}

export async function updateCheckItem(
  cardId: string,
  checkItemId: string,
  state: "complete" | "incomplete"
): Promise<TrelloCheckItem> {
  const qs = buildQuery({ state });
  const raw = await trelloFetch<{ id: string; name: string; state: string; pos: number; idChecklist: string }>(
    `/cards/${cardId}/checkItem/${checkItemId}?${qs}`,
    { method: "PUT" }
  );
  return {
    id: raw.id,
    name: raw.name,
    state: raw.state === "complete" ? "complete" : "incomplete",
    pos: raw.pos,
    idChecklist: raw.idChecklist,
  };
}

export async function getCustomFields(boardId: string = BOARD_ID) {
  return trelloFetch<unknown[]>(`/boards/${boardId}/customFields`);
}

export async function getCardCustomFields(cardId: string) {
  return trelloFetch<unknown[]>(`/cards/${cardId}/customFieldItems`);
}
