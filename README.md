# OutlanderOS

Internal operating system for **Outlander Magazine** — a unified dashboard for managing email, calendar, finance, projects, tasks, and team operations.

Built for daily use by the Outlander team. Think Linear meets Vercel dashboard, with a warm amber accent and dark-first aesthetic.

---

## Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 14+ (App Router) |
| Language | TypeScript |
| Styling | Tailwind CSS v4 |
| Components | shadcn/ui |
| Database | PostgreSQL + Prisma ORM |
| Auth | NextAuth.js v4 (Google OAuth) |
| Charts | Recharts |
| State | Zustand |
| Validation | Zod |
| Icons | Lucide React |

---

## Getting Started

### Prerequisites

- Node.js 18+
- PostgreSQL (local or hosted)
- Google Cloud project with OAuth credentials

### 1. Clone and install

```bash
git clone https://github.com/your-org/outlanderos.git
cd outlanderos
npm install
```

### 2. Configure environment

```bash
cp .env.example .env
```

Edit `.env` with your values:

```env
# PostgreSQL connection string
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/outlanderos"

# NextAuth — generate with: openssl rand -base64 32
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="your-secret-here"

# Google OAuth — from console.cloud.google.com
GOOGLE_CLIENT_ID="your-client-id.apps.googleusercontent.com"
GOOGLE_CLIENT_SECRET="GOCSPX-your-secret"
```

### 3. Set up the database

```bash
# Push schema to database
npm run db:push

# Seed with sample data (Outlander team)
npm run db:seed
```

### 4. Run the dev server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

---

## Google OAuth Setup

1. Go to [console.cloud.google.com](https://console.cloud.google.com)
2. Create a new project (or use existing)
3. Enable the **Google+ API** and **Gmail API**
4. Create OAuth 2.0 credentials → Web application
5. Add authorised redirect URI: `http://localhost:3000/api/auth/callback/google`
6. Copy Client ID and Secret into `.env`

For production, add your production URL to the authorised origins and redirect URIs.

---

## Project Structure

```
src/
├── app/
│   ├── (dashboard)/          # Main app (all routes with sidebar/topbar)
│   │   ├── layout.tsx        # Dashboard shell (sidebar + topbar)
│   │   ├── page.tsx          # Home dashboard
│   │   ├── email/            # Email overview
│   │   ├── calendar/         # Calendar view
│   │   ├── finance/          # Finance & invoices
│   │   ├── projects/         # Project tracker
│   │   ├── tasks/            # Task board
│   │   ├── team/             # Team management
│   │   ├── agents/           # AI Agents hub (Phase 2)
│   │   └── settings/         # Settings
│   ├── api/
│   │   └── auth/[...nextauth]/ # NextAuth API routes
│   └── auth/signin/          # Sign-in page
├── components/
│   ├── layout/
│   │   ├── sidebar.tsx       # Collapsible sidebar nav
│   │   └── topbar.tsx        # Top bar (search, notifications, user)
│   ├── widgets/              # Dashboard home widgets
│   │   ├── email-summary.tsx
│   │   ├── todays-schedule.tsx
│   │   ├── finance-snapshot.tsx
│   │   ├── active-projects.tsx
│   │   ├── priority-tasks.tsx
│   │   ├── reminders.tsx
│   │   └── team-status.tsx
│   ├── ui/                   # shadcn/ui components
│   └── providers.tsx         # NextAuth SessionProvider
├── lib/
│   ├── prisma.ts             # Prisma singleton
│   ├── auth.ts               # NextAuth config
│   └── utils.ts              # cn() helper
└── types/
    └── next-auth.d.ts        # Session type augmentation
prisma/
├── schema.prisma             # Database models
└── seed.ts                   # Sample data seed
```

---

## Database Models

| Model | Description |
|---|---|
| `User` | Team members (linked to NextAuth) |
| `Project` | Campaigns/productions with budget & actuals |
| `Task` | To-dos with priority, assignee, due date |
| `Reminder` | Recurring & one-off business reminders |
| `EmailThread` | Cached email data |
| `Invoice` | Client invoices (Xero-ready) |
| `Holiday` | Employee time-off records |

---

## Seed Data

Running `npm run db:seed` creates sample data for:

| Name | Role |
|---|---|
| Joe Silver | Admin / Operations |
| Quinn Titsworth | CEO |
| Shreeya Patel | Sales & Partnerships |
| Callum Reid | Content & Social |
| Patricia Chen | Production |

Plus sample projects (April 2025 Issue, ASOS Partnership, Digital Rebrand), tasks, reminders, invoices, and holidays.

---

## Available Scripts

```bash
npm run dev          # Start dev server
npm run build        # Production build
npm run lint         # Run ESLint
npm run db:push      # Push Prisma schema to DB
npm run db:migrate   # Run migrations
npm run db:seed      # Seed sample data
npm run db:studio    # Open Prisma Studio (DB GUI)
```

---

## Roadmap

### Phase 1 — Dashboard Foundation
- [x] Next.js 14 + TypeScript + Tailwind setup
- [x] Dark-themed dashboard UI
- [x] Collapsible sidebar navigation
- [x] Dashboard home with 7 widget cards
- [x] Email, Calendar, Finance, Projects, Tasks, Team, Agents, Settings pages
- [x] Prisma schema + PostgreSQL
- [x] NextAuth Google OAuth
- [x] Database seed with Outlander team data

### Phase 2 — Live Integrations
- [ ] Gmail API integration (real email)
- [ ] Google Calendar API (real events)
- [ ] Xero API (real invoices + P&L)
- [ ] AI Agents (Claude-powered automations)
- [ ] Push notifications / Slack alerts
- [ ] Holiday approval workflow

### Phase 3 — Intelligence Layer
- [ ] Email triage agent
- [ ] Finance anomaly detection
- [ ] Project risk alerts
- [ ] Automated reporting

---

## Design System

- **Background**: `#0a0a0a` (near-black)
- **Surface**: `#141414` / `#1a1a1a`
- **Border**: `#262626`
- **Accent**: `#D4A853` (warm amber — Outlander gold)
- **Text**: `#f5f5f5` primary, `#737373` muted
- **Font**: Geist Sans + Geist Mono (numbers/stats)

---

## Contributing

This is an internal tool. For access, contact Joe Silver at joe@outlandermag.com.

---

*OutlanderOS — Built for Outlander Magazine*
