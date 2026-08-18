// ═══════════════════════════════════════════════════════════════════════════
// Production workflows — the step-by-step for every person on a shoot.
//
// The idea: someone who knows nothing about production should be able to open
// a project, see who's attached, and be walked through exactly what to do next
// for each of them — what the step is for, what information to collect, and a
// ready-to-send email for the stages that are an email.
//
// The shape follows the house rule: TEMPLATES LIVE IN CODE (reviewable,
// versioned, one voice), PROGRESS LIVES IN THE DATABASE (which steps are done,
// per person, per production), and everything else is derived — the current
// step is simply the first one not done.
//
// Emails are copy-paste, not auto-send, on purpose. These are relationships:
// a producer reads the draft, adjusts a line, and sends it from their own
// address. The system's job is that nobody ever stares at a blank compose
// window not knowing what this stage of the conversation is supposed to say.
//
// Placeholders use {{key}}. Known keys are filled from the production and the
// person; anything unfillable renders as a visible [key needed] marker rather
// than vanishing, so a missing unit base reads as "go find the unit base",
// never as a finished email.
// ═══════════════════════════════════════════════════════════════════════════

export interface WorkflowStep {
  id: string
  title: string
  // What this step is for, written for someone doing it for the first time.
  guide: string
  // Information to have in hand before the step can be called done.
  collect?: string[]
  email?: { subject: string; body: string }
}

export interface WorkflowTrack {
  id: string
  label: string
  appliesTo: string
  steps: WorkflowStep[]
}

// ── The talent conversation ─────────────────────────────────────────────────

const TALENT_TRACK: WorkflowTrack = {
  id: 'TALENT',
  label: 'Talent',
  appliesTo: 'Talent, models, cast',
  steps: [
    {
      id: 'reach-out',
      title: 'Reach out',
      guide:
        'First contact, usually via their management or agent. Say who we are, what the shoot is, when it is, and ask about interest and availability. Do not discuss money yet; that comes once they are interested.',
      collect: ['Correct contact (agent or manager, not always the talent)', 'Availability around the shoot dates'],
      email: {
        subject: '{{productionTitle}}, an Outlander Magazine shoot with {{name}}',
        body: `Hi {{firstName}},

I'm {{senderName}} from Outlander Magazine. We're putting together {{productionTitle}}{{clientLine}} and we'd love to feature {{name}}.

The shoot is planned for {{shootDates}}. Before anything else, we wanted to check interest and availability on your side.

If this sounds interesting, I'd be happy to share more about the concept and talk through the details.

Best,
{{senderName}}
Outlander Magazine`,
      },
    },
    {
      id: 'budget',
      title: 'Budget conversation',
      guide:
        'Agree the fee and what it covers: the day, usage (where the images can appear and for how long), and any extras like travel. Get the number they expect in writing before contracting, so the contract holds no surprises.',
      collect: ['Agreed fee', 'Usage terms (media, territory, duration)', 'Who invoices whom, and when'],
      email: {
        subject: '{{productionTitle}}, fee and usage for {{name}}',
        body: `Hi {{firstName}},

Great to hear there's interest. On our side the budget for {{name}}'s involvement is {{rate}}, covering the shoot day and usage as follows: [usage terms].

Could you confirm this works, or let me know where you'd need it to land? Once we're agreed I'll send the paperwork over.

Best,
{{senderName}}`,
      },
    },
    {
      id: 'contracting',
      title: 'Contracting',
      guide:
        'Send the agreement covering fee, usage, and the shoot date. Nothing else moves until this is signed; a shoot without a signed talent agreement is a handshake with a call time.',
      collect: ['Signed agreement on file', 'Invoicing details for finance'],
      email: {
        subject: '{{productionTitle}}, agreement for {{name}}',
        body: `Hi {{firstName}},

As agreed, attached is the agreement for {{name}} on {{productionTitle}}, covering the fee, usage and the shoot date ({{shootDates}}).

Any questions at all, just reply here. Once it's signed we'll move on to the fun parts: styling and the plan for the day.

Best,
{{senderName}}`,
      },
    },
    {
      id: 'sizes',
      title: 'Styling sizes',
      guide:
        'The stylist needs measurements before they can pull a single look. Ask early; samples take days to arrive and come in one size.',
      collect: ['Height', 'Chest / waist / hips', 'Shoe size', 'Any styling notes or preferences'],
      email: {
        subject: '{{productionTitle}}, sizes for styling',
        body: `Hi {{firstName}},

Our stylist is starting to pull looks for {{name}}. Could you share:

- Height
- Chest, waist and hip measurements
- Shoe size
- Anything they love or won't wear

The earlier we have these the better the pull will be.

Thanks,
{{senderName}}`,
      },
    },
    {
      id: 'dietary',
      title: 'Dietary requirements',
      guide:
        'Catering is ordered per head. Ask about dietary requirements and allergies now, not the night before, and pass the answer to whoever books catering.',
      collect: ['Dietary requirements', 'Allergies', 'Passed to catering'],
      email: {
        subject: '{{productionTitle}}, catering for the day',
        body: `Hi {{firstName}},

We'll have catering on set for {{name}}. Any dietary requirements or allergies we should know about? We want the day to run on good food.

Thanks,
{{senderName}}`,
      },
    },
    {
      id: 'schedule',
      title: 'Send the schedule',
      guide:
        'Once the call sheet is published, send it with their personal call time pulled out in the email body, because nobody should have to open an attachment to learn what time to arrive.',
      collect: ['Call sheet published', 'Their call time confirmed on the sheet'],
      email: {
        subject: '{{productionTitle}}, schedule and call time for {{name}}',
        body: `Hi {{firstName}},

The day is locked. {{name}}'s call time is [call time], and the full schedule is here:

{{callSheetLink}}

The sheet has locations, timings and every contact for the day. Anything that looks off, tell me now rather than on the morning.

Best,
{{senderName}}`,
      },
    },
    {
      id: 'logistics',
      title: 'Unit base and looks',
      guide:
        'The final confirmation before the day: where exactly to come, how many looks they are shooting, and who meets them. After this email there should be zero open questions.',
      collect: ['Unit base address confirmed', 'Number of looks', 'Who greets them on arrival'],
      email: {
        subject: '{{productionTitle}}, final details for the day',
        body: `Hi {{firstName}},

Final details for {{shootDates}}:

Unit base: {{unitBase}}
Looks: {{looksCount}}
On arrival, ask for {{producerName}}, who will be expecting you.

Everything else is on the call sheet. See you on the day.

Best,
{{senderName}}`,
      },
    },
  ],
}

// ── The creative-lead conversation ──────────────────────────────────────────

const CREATIVE_TRACK: WorkflowTrack = {
  id: 'CREATIVE',
  label: 'Creative lead',
  appliesTo: 'Photographers, directors, videographers, DOPs',
  steps: [
    {
      id: 'reach-out',
      title: 'Reach out',
      guide:
        'First contact. Say what the project is, when it shoots, and why them specifically; creatives say yes to projects that clearly wanted THEM. Ask availability, not price.',
      collect: ['Availability around the shoot dates', 'Interest confirmed'],
      email: {
        subject: '{{productionTitle}}, shooting with Outlander',
        body: `Hi {{firstName}},

I'm {{senderName}} from Outlander Magazine. We're producing {{productionTitle}}{{clientLine}} and your work is exactly the direction we want it to go.

The shoot is planned for {{shootDates}}. Are you around, and is it something you'd want to be part of? If so I'll share the full picture.

Best,
{{senderName}}
Outlander Magazine`,
      },
    },
    {
      id: 'rate',
      title: 'Rate and availability',
      guide:
        'Agree the day rate and what it includes: shoot day, edit or grade if relevant, kit, and usage of the work. Get their standard rate first, then negotiate against the budget line for this role.',
      collect: ['Agreed rate and what it includes', 'Usage of the resulting work', 'Kit included or hired separately'],
      email: {
        subject: '{{productionTitle}}, rate and scope',
        body: `Hi {{firstName}},

Glad you're up for it. Could you share your rate for a day like this, and what it includes on your side (kit, edit, assistants)?

For context: the budget line we're working to is {{rate}}, and usage is [usage terms]. Let's find the shape that works.

Best,
{{senderName}}`,
      },
    },
    {
      id: 'contracting',
      title: 'Contracting',
      guide:
        'Send the agreement covering rate, deliverables ownership and usage, and the shoot date. Signed before any creative work starts.',
      collect: ['Signed agreement on file', 'Invoicing details for finance'],
      email: {
        subject: '{{productionTitle}}, agreement',
        body: `Hi {{firstName}},

Attached is the agreement for {{productionTitle}}: rate, usage and the shoot date ({{shootDates}}) as discussed.

Any questions, reply here. Once signed, I'll send the full creative brief.

Best,
{{senderName}}`,
      },
    },
    {
      id: 'brief',
      title: 'Creative brief',
      guide:
        'Share the creative: concept, references, shot intentions, the mood. This is where the shoot becomes theirs too; leave room for their ideas and ask for a response, not just an acknowledgement.',
      collect: ['Brief shared (deck or Figma link)', 'Their response and additions heard'],
      email: {
        subject: '{{productionTitle}}, the creative',
        body: `Hi {{firstName}},

Here's the creative for {{productionTitle}}: [brief / deck link]

It covers the concept, references and the shots we know we need. Read it as a starting point; where you'd push it somewhere better, we want to hear that.

Can we grab 20 minutes this week to talk it through?

Best,
{{senderName}}`,
      },
    },
    {
      id: 'deliverables',
      title: 'Deliverables and timelines',
      guide:
        'Agree exactly what is delivered and when: counts, formats, crops, edit or grade responsibility, first-selects date, finals date. Vague deliverables are how relationships end; specific ones are how they last.',
      collect: ['Deliverables list agreed (counts and formats)', 'First selects date', 'Final delivery date'],
      email: {
        subject: '{{productionTitle}}, deliverables and dates',
        body: `Hi {{firstName}},

Locking the deliverables for {{productionTitle}}:

- [count] final images / [count] video deliverables, formats: [formats]
- First selects by [date]
- Finals by [date]

Does that timeline work with your schedule after the shoot? Once you confirm, this becomes the plan of record.

Best,
{{senderName}}`,
      },
    },
    {
      id: 'schedule',
      title: 'Shoot schedule',
      guide:
        'Send the published call sheet and walk the day: the looks, the locations, where the time pressure is. The creative lead should never be surprised by the schedule they are meant to be driving.',
      collect: ['Call sheet published and sent', 'Schedule walked through together'],
      email: {
        subject: '{{productionTitle}}, the day',
        body: `Hi {{firstName}},

The call sheet for {{shootDates}} is live:

{{callSheetLink}}

It has the full minute-by-minute: looks, locations and where the day is tight. Have a read and flag anything you'd restructure; you know better than anyone where the time needs to go.

Best,
{{senderName}}`,
      },
    },
    {
      id: 'equipment',
      title: 'Equipment and lighting',
      guide:
        'Final technical confirmation: camera and lens list, lighting plan, what they bring versus what we hire, and who is confirming the hire. After this, the only surprises on the day should be good ones.',
      collect: ['Camera / lens list confirmed', 'Lighting plan and hire list', 'Hire booked and delivery arranged'],
      email: {
        subject: '{{productionTitle}}, kit for the day',
        body: `Hi {{firstName}},

Last technical pass before {{shootDates}}: could you confirm your camera and lens list, and the lighting you want on the day?

Tell me what you're bringing versus what we should hire, and I'll get the hire booked this week.

Best,
{{senderName}}`,
      },
    },
  ],
}

// ── The general crew conversation ───────────────────────────────────────────

const CREW_TRACK: WorkflowTrack = {
  id: 'CREW',
  label: 'Crew',
  appliesTo: 'Everyone else on the day',
  steps: [
    {
      id: 'availability',
      title: 'Availability',
      guide: 'Confirm they can do the date before anything else is discussed.',
      collect: ['Date confirmed'],
      email: {
        subject: '{{productionTitle}}, are you free {{shootDates}}?',
        body: `Hi {{firstName}},

We're crewing {{productionTitle}} for {{shootDates}} and would love you on it as {{role}}. Are you free?

Best,
{{senderName}}`,
      },
    },
    {
      id: 'rate',
      title: 'Confirm rate',
      guide: 'Agree the day rate and overtime terms in writing, and log it against the budget line for the role.',
      collect: ['Day rate agreed', 'Logged in the production budget'],
    },
    {
      id: 'details',
      title: 'Collect details',
      guide:
        'Everything the call sheet and catering need: phone number for the sheet, dietary requirements, and any kit they are bringing.',
      collect: ['Phone number for the call sheet', 'Dietary requirements', 'Kit they bring'],
      email: {
        subject: '{{productionTitle}}, a few details for the day',
        body: `Hi {{firstName}},

Ahead of {{shootDates}}, three quick things:

- Best phone number for the call sheet
- Any dietary requirements for catering
- Any kit you're planning to bring

Thanks,
{{senderName}}`,
      },
    },
    {
      id: 'callsheet',
      title: 'Send the call sheet',
      guide: 'Published call sheet out, with their call time in the body of the email.',
      collect: ['Call sheet sent', 'Call time acknowledged'],
      email: {
        subject: '{{productionTitle}}, call sheet and your call time',
        body: `Hi {{firstName}},

Call sheet for {{shootDates}}:

{{callSheetLink}}

Your call time is [call time]. Any problems with it, tell me today.

Best,
{{senderName}}`,
      },
    },
  ],
}

export const WORKFLOW_TRACKS: WorkflowTrack[] = [TALENT_TRACK, CREATIVE_TRACK, CREW_TRACK]

export const trackById = (id: string | null | undefined): WorkflowTrack =>
  WORKFLOW_TRACKS.find((t) => t.id === id) ?? CREW_TRACK

// Which conversation does this role get? Talent family goes to the talent
// track, lead creatives to theirs, everyone else is crew.
export function trackForRole(role: string | null | undefined): string {
  const r = (role || '').toLowerCase()
  if (/\b(talent|model|cast|actor|actress)\b/.test(r)) return 'TALENT'
  if (/\b(photographer|director|videographer|filmmaker|dop|d\.o\.p|cinematographer)\b/.test(r) && !/\bassist/.test(r))
    return 'CREATIVE'
  return 'CREW'
}

// ── Template rendering ──────────────────────────────────────────────────────

export interface WorkflowContext {
  firstName?: string | null
  name?: string | null
  role?: string | null
  productionTitle?: string | null
  clientName?: string | null
  shootDates?: string | null
  producerName?: string | null
  senderName?: string | null
  callSheetLink?: string | null
  unitBase?: string | null
  looksCount?: string | null
  rate?: string | null
}

/**
 * Fills {{key}} placeholders from the context. A key with no value renders as
 * a visible [key needed] marker, never as silence — a missing unit base must
 * read as "go find the unit base", not as a finished email.
 *
 * {{clientLine}} is derived: ", in partnership with X" when a client exists,
 * empty otherwise, so the sentence works either way.
 */
export function renderWorkflowTemplate(text: string, ctx: WorkflowContext): string {
  const values: Record<string, string | null | undefined> = {
    ...ctx,
    clientLine: ctx.clientName ? `, in partnership with ${ctx.clientName}` : '',
  }
  return text.replace(/\{\{(\w+)\}\}/g, (_, key: string) => {
    const v = values[key]
    if (v === '') return ''
    return v != null && String(v).trim() ? String(v).trim() : `[${key} needed]`
  })
}
