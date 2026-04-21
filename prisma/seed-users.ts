import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  const users = [
    { email: 'q@outlandermag.com', name: 'Quinn Titsworth', role: 'ADMIN' as const, password: 'Mercer2024!!' },
    { email: 'silver@outlandermag.com', name: 'Joe Silver', role: 'ADMIN' as const, password: 'OutlanderOS2026!' },
    { email: 'shreeya@outlandermag.com', name: 'Shreeya Patel', role: 'MEMBER' as const, password: 'Outlander2026!' },
    { email: 'callum@outlandermag.com', name: 'Callum', role: 'MEMBER' as const, password: 'Outlander2026!' },
    { email: 'patricia@outlandermag.com', name: 'Patricia', role: 'MEMBER' as const, password: 'Outlander2026!' },
  ]

  for (const u of users) {
    const hash = await bcrypt.hash(u.password, 10)
    await prisma.user.upsert({
      where: { email: u.email },
      update: { name: u.name, role: u.role, password: hash },
      create: { email: u.email, name: u.name, role: u.role, password: hash },
    })
    console.log(`Created/updated user: ${u.email}`)
  }
}

main().catch(console.error).finally(() => prisma.$disconnect())
