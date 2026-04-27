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
  dateLastActivity: string;
  url: string;
  shortUrl: string;
}

export interface TrelloRawList {
  id: string;
  name: string;
  closed: boolean;
  pos: number;
  cards: TrelloRawCard[];
}

export interface PipelineCard {
  id: string;
  name: string;
  client: string;
  description: string;
  dueDate: string | null;
  lastActivity: string;
  labels: TrelloLabel[];
  members: TrelloMember[];
  url: string;
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

async function trelloFetch<T>(path: string): Promise<T> {
  ensureCreds();
  const sep = path.includes("?") ? "&" : "?";
  const url = `${TRELLO_API_BASE}${path}${sep}${authParams()}`;
  const res = await fetch(url, { cache: "no-store" });
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
    `/boards/${BOARD_ID}/lists?cards=open&card_fields=name,desc,due,labels,idMembers,dateLastActivity,url,shortUrl&filter=open`
  );
}

export async function fetchCards(): Promise<TrelloRawCard[]> {
  return trelloFetch<TrelloRawCard[]>(
    `/boards/${BOARD_ID}/cards?fields=name,desc,due,labels,idMembers,dateLastActivity,url,shortUrl,idList`
  );
}

export async function fetchCard(id: string): Promise<TrelloRawCard> {
  return trelloFetch<TrelloRawCard>(
    `/cards/${id}?fields=name,desc,due,labels,idMembers,dateLastActivity,url,shortUrl`
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

function deriveClient(cardName: string, labels: TrelloLabel[]): string {
  const brandLabel = labels.find(
    (l) =>
      l.name &&
      !["template", "new brief", "priority", "urgent"].includes(l.name.toLowerCase())
  );
  if (brandLabel?.name) return brandLabel.name;

  const sepMatch = cardName.match(/^([A-Z0-9 &']+?)(?:\s+[-–—:|]\s+|\s+x\s+)/i);
  if (sepMatch) return sepMatch[1].trim();

  return cardName.split(/[-–—:|]/)[0].trim();
}

export function toPipelineCard(
  raw: TrelloRawCard,
  memberLookup: Map<string, TrelloMember>
): PipelineCard {
  const members = (raw.idMembers ?? [])
    .map((id) => memberLookup.get(id))
    .filter((m): m is TrelloMember => Boolean(m));

  return {
    id: raw.id,
    name: raw.name,
    client: deriveClient(raw.name, raw.labels ?? []),
    description: raw.desc ?? "",
    dueDate: raw.due,
    lastActivity: raw.dateLastActivity,
    labels: raw.labels ?? [],
    members,
    url: raw.url || raw.shortUrl,
  };
}

export async function buildSnapshot(): Promise<PipelineSnapshot> {
  ensureCreds();
  const [board, lists, members] = await Promise.all([
    fetchBoard(),
    fetchLists(),
    fetchMembers(),
  ]);

  const memberLookup = new Map<string, TrelloMember>(members.map((m) => [m.id, m]));

  const stages: PipelineStage[] = (lists ?? [])
    .filter((l) => !l.closed)
    .sort((a, b) => a.pos - b.pos)
    .map((list) => ({
      id: list.id,
      name: list.name,
      position: list.pos,
      cards: (list.cards ?? []).map((c) => toPipelineCard(c, memberLookup)),
    }));

  return {
    boardId: board.id,
    boardUrl: board.shortUrl || board.url,
    fetchedAt: new Date().toISOString(),
    stages,
    members,
  };
}
