import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient }

function createPrisma() {
  const connectionString = process.env.DATABASE_URL
  if (!connectionString) {
    throw new Error('DATABASE_URL is not set')
  }
  const adapter = new PrismaPg({ connectionString })
  return new PrismaClient({ adapter })
}

// Use a getter so the client is only instantiated when first accessed,
// not at module load time (which would break builds without DATABASE_URL).
let _prisma: PrismaClient | null = null

const prisma = new Proxy({} as PrismaClient, {
  get(_target, prop) {
    if (!_prisma) {
      if (globalForPrisma.prisma) {
        _prisma = globalForPrisma.prisma
      } else {
        _prisma = createPrisma()
        if (process.env.NODE_ENV !== 'production') {
          globalForPrisma.prisma = _prisma
        }
      }
    }
    const value = (_prisma as unknown as Record<string | symbol, unknown>)[prop]
    return typeof value === 'function' ? value.bind(_prisma) : value
  },
})

export default prisma
