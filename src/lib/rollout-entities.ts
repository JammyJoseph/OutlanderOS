import prisma from '@/lib/prisma'

// Editable child collections of a rollout plan, keyed by the URL segment.
//
// An explicit allow-list, not a lookup on the segment. `prisma[segment]` would
// let a crafted URL reach any model in the schema — the mapping has to be
// closed, and each entry names exactly which fields a client may write.
export const ROLLOUT_ENTITIES = {
  covers: {
    model: 'rolloutCover',
    fields: ['name', 'sku', 'sharePct', 'isBalancer', 'notes', 'sortOrder'],
    numeric: ['sharePct', 'sortOrder'],
    boolean: ['isBalancer'],
  },
  profiles: {
    model: 'coverProfile',
    fields: ['name', 'splits', 'isDefault', 'notes', 'sortOrder'],
    numeric: ['sortOrder'],
    boolean: ['isDefault'],
    json: ['splits'],
  },
  hubs: {
    model: 'fulfilmentHub',
    fields: ['name', 'location', 'serves', 'isDirect', 'sortOrder'],
    numeric: ['sortOrder'],
    boolean: ['isDirect'],
  },
  channels: {
    model: 'rolloutChannel',
    fields: ['name', 'units', 'purpose', 'hubId', 'kind', 'sortOrder'],
    numeric: ['units', 'sortOrder'],
  },
  territories: {
    model: 'rolloutTerritory',
    fields: ['name', 'hubId', 'phase1', 'phase2', 'seedingVip', 'sortOrder'],
    numeric: ['phase1', 'phase2', 'seedingVip', 'sortOrder'],
  },
  stockists: {
    model: 'stockist',
    fields: ['name', 'city', 'market', 'hubId', 'profileId', 'units', 'contactId', 'notes', 'sortOrder'],
    numeric: ['units', 'sortOrder'],
  },
  events: {
    model: 'rolloutEvent',
    fields: ['city', 'hubId', 'units', 'eventDate', 'notes', 'sortOrder'],
    numeric: ['units', 'sortOrder'],
    date: ['eventDate'],
  },
  lanes: {
    model: 'shippingLane',
    fields: ['name', 'ratePerOrder', 'currency', 'volume', 'quoteStatus', 'isBaseline', 'sortOrder'],
    numeric: ['ratePerOrder', 'volume', 'sortOrder'],
    boolean: ['isBaseline'],
  },
  milestones: {
    model: 'rolloutMilestone',
    fields: ['seq', 'window', 'date', 'action', 'owner', 'criticalPath', 'status', 'notes'],
    numeric: ['seq'],
    boolean: ['criticalPath'],
    date: ['date'],
  },
} as const

export type RolloutEntity = keyof typeof ROLLOUT_ENTITIES

export function isRolloutEntity(v: string): v is RolloutEntity {
  return Object.prototype.hasOwnProperty.call(ROLLOUT_ENTITIES, v)
}

// Coerces a request body to the shape the model expects, dropping anything not
// on the field list. Empty string means "cleared" for nullable columns rather
// than 0 or the string "", which is what a naive Number() would produce.
export function coerceBody(entity: RolloutEntity, body: Record<string, unknown>) {
  const def = ROLLOUT_ENTITIES[entity] as {
    fields: readonly string[]
    numeric?: readonly string[]
    boolean?: readonly string[]
    date?: readonly string[]
    json?: readonly string[]
  }
  const out: Record<string, unknown> = {}
  for (const f of def.fields) {
    if (!(f in body)) continue
    const raw = body[f]
    if (def.numeric?.includes(f)) {
      out[f] = raw === '' || raw === null || raw === undefined ? null : Number(raw)
      if (Number.isNaN(out[f] as number)) out[f] = null
    } else if (def.boolean?.includes(f)) {
      out[f] = Boolean(raw)
    } else if (def.date?.includes(f)) {
      out[f] = raw ? new Date(String(raw)) : null
    } else if (def.json?.includes(f)) {
      out[f] = raw ?? {}
    } else {
      out[f] = raw === '' ? null : raw
    }
  }
  return out
}

// Non-null columns can't take the null a cleared field produces. Applied only
// on create, where a missing value would otherwise fail at the database.
export function withCreateDefaults(entity: RolloutEntity, data: Record<string, unknown>) {
  const d = { ...data }
  const requireNumber = (k: string) => {
    if (d[k] === null || d[k] === undefined) d[k] = 0
  }
  switch (entity) {
    case 'covers':
      d.name ??= 'New cover'
      d.sku ??= ''
      requireNumber('sharePct')
      break
    case 'profiles':
      d.name ??= 'New profile'
      d.splits ??= {}
      break
    case 'hubs':
      d.name ??= 'New hub'
      break
    case 'channels':
      d.name ??= 'New channel'
      d.kind ??= 'B2C'
      requireNumber('units')
      break
    case 'territories':
      d.name ??= 'New territory'
      requireNumber('phase1')
      requireNumber('phase2')
      requireNumber('seedingVip')
      break
    case 'stockists':
      d.name ??= 'New stockist'
      requireNumber('units')
      break
    case 'events':
      d.city ??= 'New city'
      requireNumber('units')
      break
    case 'lanes':
      d.name ??= 'New lane'
      d.currency ??= 'GBP'
      requireNumber('volume')
      break
    case 'milestones':
      d.action ??= 'New milestone'
      d.status ??= 'NOT_STARTED'
      requireNumber('seq')
      break
  }
  return d
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function delegateFor(entity: RolloutEntity): any {
  // Safe: `model` comes from the closed map above, never from user input.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (prisma as any)[ROLLOUT_ENTITIES[entity].model]
}
