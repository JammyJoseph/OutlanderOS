import { PrismaClient, UserRole, ProjectStatus, TaskStatus, TaskPriority, InvoiceStatus, HolidayStatus } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import "dotenv/config";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log("🌱 Seeding OutlanderOS...");

  // ─── Users ───────────────────────────────────────────────────────────────

  const joe = await prisma.user.upsert({
    where: { email: "joe@outlandermag.com" },
    update: {},
    create: {
      name: "Joe Silver",
      email: "joe@outlandermag.com",
      role: UserRole.ADMIN,
      title: "Operations & Admin",
      department: "Operations",
    },
  });

  const quinn = await prisma.user.upsert({
    where: { email: "quinn@outlandermag.com" },
    update: {},
    create: {
      name: "Quinn Titsworth",
      email: "quinn@outlandermag.com",
      role: UserRole.MANAGER,
      title: "Chief Executive Officer",
      department: "Executive",
    },
  });

  const shreeya = await prisma.user.upsert({
    where: { email: "shreeya@outlandermag.com" },
    update: {},
    create: {
      name: "Shreeya Patel",
      email: "shreeya@outlandermag.com",
      role: UserRole.MEMBER,
      title: "Head of Sales & Partnerships",
      department: "Commercial",
    },
  });

  const callum = await prisma.user.upsert({
    where: { email: "callum@outlandermag.com" },
    update: {},
    create: {
      name: "Callum Reid",
      email: "callum@outlandermag.com",
      role: UserRole.MEMBER,
      title: "Content & Social Media Manager",
      department: "Content",
    },
  });

  const patricia = await prisma.user.upsert({
    where: { email: "patricia@outlandermag.com" },
    update: {},
    create: {
      name: "Patricia Chen",
      email: "patricia@outlandermag.com",
      role: UserRole.MEMBER,
      title: "Production Manager",
      department: "Production",
    },
  });

  console.log("✅ Users created");

  // ─── Projects ────────────────────────────────────────────────────────────

  const aprilIssue = await prisma.project.upsert({
    where: { id: "proj-april-2025" },
    update: {},
    create: {
      id: "proj-april-2025",
      name: "April 2025 Issue",
      client: "In-house",
      description: "Monthly flagship print and digital issue. Cover feature: sustainable fashion in 2025.",
      status: ProjectStatus.ACTIVE,
      budget: 45000,
      actuals: 38200,
      startDate: new Date("2025-02-01"),
      endDate: new Date("2025-04-03"),
      members: { connect: [{ id: joe.id }, { id: quinn.id }, { id: patricia.id }, { id: callum.id }] },
    },
  });

  const asosPartnership = await prisma.project.upsert({
    where: { id: "proj-asos-2025" },
    update: {},
    create: {
      id: "proj-asos-2025",
      name: "ASOS Brand Partnership",
      client: "ASOS",
      description: "Sponsored editorial and social content package for ASOS spring collection launch.",
      status: ProjectStatus.ACTIVE,
      budget: 22000,
      actuals: 14100,
      startDate: new Date("2025-03-10"),
      endDate: new Date("2025-04-12"),
      members: { connect: [{ id: joe.id }, { id: shreeya.id }, { id: callum.id }] },
    },
  });

  const digitalRebrand = await prisma.project.upsert({
    where: { id: "proj-rebrand-2025" },
    update: {},
    create: {
      id: "proj-rebrand-2025",
      name: "Digital Rebrand",
      client: "Internal",
      description: "Website redesign and new digital design system for outlandermag.com.",
      status: ProjectStatus.ACTIVE,
      budget: 8000,
      actuals: 9200,
      startDate: new Date("2025-01-15"),
      endDate: new Date("2025-04-30"),
      members: { connect: [{ id: joe.id }, { id: quinn.id }] },
    },
  });

  console.log("✅ Projects created");

  // ─── Tasks ───────────────────────────────────────────────────────────────

  await prisma.task.createMany({
    data: [
      {
        title: "Approve April cover proofs",
        status: TaskStatus.TODO,
        priority: TaskPriority.URGENT,
        dueDate: new Date("2025-04-01"),
        assigneeId: joe.id,
        projectId: aprilIssue.id,
      },
      {
        title: "Send ASOS brief to Patricia",
        status: TaskStatus.TODO,
        priority: TaskPriority.HIGH,
        dueDate: new Date("2025-04-02"),
        assigneeId: joe.id,
        projectId: asosPartnership.id,
      },
      {
        title: "VAT return prep – send to accountant",
        status: TaskStatus.TODO,
        priority: TaskPriority.URGENT,
        dueDate: new Date("2025-04-07"),
        assigneeId: joe.id,
      },
      {
        title: "Update contributor contracts",
        status: TaskStatus.IN_PROGRESS,
        priority: TaskPriority.MEDIUM,
        dueDate: new Date("2025-04-05"),
        assigneeId: joe.id,
      },
      {
        title: "Review Q1 P&L with Quinn",
        status: TaskStatus.DONE,
        priority: TaskPriority.HIGH,
        dueDate: new Date("2025-03-31"),
        completedAt: new Date("2025-03-31"),
        assigneeId: joe.id,
      },
      {
        title: "Brief Callum on Instagram strategy",
        status: TaskStatus.IN_PROGRESS,
        priority: TaskPriority.MEDIUM,
        dueDate: new Date("2025-04-03"),
        assigneeId: callum.id,
        projectId: asosPartnership.id,
      },
      {
        title: "Shoot call sheet – final version",
        status: TaskStatus.TODO,
        priority: TaskPriority.URGENT,
        dueDate: new Date("2025-04-02"),
        assigneeId: patricia.id,
        projectId: aprilIssue.id,
      },
      {
        title: "Book Hackney Wick studio",
        status: TaskStatus.DONE,
        priority: TaskPriority.HIGH,
        dueDate: new Date("2025-03-25"),
        completedAt: new Date("2025-03-22"),
        assigneeId: patricia.id,
        projectId: aprilIssue.id,
      },
      {
        title: "Outreach to 5 new partnership prospects",
        status: TaskStatus.IN_PROGRESS,
        priority: TaskPriority.MEDIUM,
        dueDate: new Date("2025-04-10"),
        assigneeId: shreeya.id,
      },
      {
        title: "Domain renewal check",
        status: TaskStatus.TODO,
        priority: TaskPriority.LOW,
        dueDate: new Date("2025-04-22"),
        assigneeId: joe.id,
      },
    ],
    skipDuplicates: true,
  });

  console.log("✅ Tasks created");

  // ─── Reminders ───────────────────────────────────────────────────────────

  await prisma.reminder.createMany({
    data: [
      {
        title: "VAT Return Deadline",
        description: "Q1 VAT return must be submitted via HMRC online by midnight",
        dueDate: new Date("2025-04-07"),
        recurring: true,
        recurrence: "quarterly",
        category: "compliance",
      },
      {
        title: "Monthly Payroll",
        description: "Process monthly payroll for all 5 team members via payroll provider",
        dueDate: new Date("2025-04-15"),
        recurring: true,
        recurrence: "monthly",
        category: "payroll",
      },
      {
        title: "Callum probation review",
        description: "6-month probation review meeting with Callum – book room and prepare feedback",
        dueDate: new Date("2025-04-10"),
        recurring: false,
        category: "hr",
      },
      {
        title: "Domain renewals",
        description: "outlandermag.com and outlander.co.uk renewals due – check registrar",
        dueDate: new Date("2025-04-22"),
        recurring: true,
        recurrence: "annually",
        category: "ops",
      },
      {
        title: "Q2 Budget Planning",
        description: "Prepare Q2 budget forecast with Quinn ahead of board meeting",
        dueDate: new Date("2025-04-30"),
        recurring: false,
        category: "finance",
      },
    ],
    skipDuplicates: true,
  });

  console.log("✅ Reminders created");

  // ─── Invoices ────────────────────────────────────────────────────────────

  await prisma.invoice.createMany({
    data: [
      {
        number: "INV-2025-041",
        client: "ASOS UK",
        amount: 18500,
        currency: "GBP",
        status: InvoiceStatus.PAID,
        issuedDate: new Date("2025-02-28"),
        dueDate: new Date("2025-03-15"),
        paidDate: new Date("2025-03-14"),
      },
      {
        number: "INV-2025-042",
        client: "H&M Group",
        amount: 12000,
        currency: "GBP",
        status: InvoiceStatus.SENT,
        issuedDate: new Date("2025-03-15"),
        dueDate: new Date("2025-04-05"),
      },
      {
        number: "INV-2025-043",
        client: "Vogue Licensing",
        amount: 7500,
        currency: "GBP",
        status: InvoiceStatus.OVERDUE,
        issuedDate: new Date("2025-02-28"),
        dueDate: new Date("2025-03-28"),
      },
      {
        number: "INV-2025-044",
        client: "NET-A-PORTER",
        amount: 22000,
        currency: "GBP",
        status: InvoiceStatus.DRAFT,
        issuedDate: new Date("2025-03-31"),
        dueDate: new Date("2025-04-20"),
      },
      {
        number: "INV-2025-045",
        client: "Matches Fashion",
        amount: 9800,
        currency: "GBP",
        status: InvoiceStatus.SENT,
        issuedDate: new Date("2025-03-20"),
        dueDate: new Date("2025-04-12"),
      },
    ],
    skipDuplicates: true,
  });

  console.log("✅ Invoices created");

  // ─── Holidays ────────────────────────────────────────────────────────────

  await prisma.holiday.create({
    data: {
      userId: patricia.id,
      startDate: new Date("2025-03-31"),
      endDate: new Date("2025-04-04"),
      status: HolidayStatus.APPROVED,
      notes: "Easter break",
    },
  });

  console.log("✅ Holidays created");

  // ─── Email threads (sample cache) ────────────────────────────────────────

  await prisma.emailThread.createMany({
    data: [
      {
        subject: "Re: Spring collaboration brief",
        snippet: "Thanks for sending over the mood board — we love the direction...",
        from: "Vogue UK",
        fromEmail: "partnerships@vogue.co.uk",
        unread: true,
        flagged: true,
        labels: ["partnerships"],
        receivedAt: new Date("2025-03-31T09:14:00Z"),
      },
      {
        subject: "Q1 invoice approval needed",
        snippet: "Hi Joe, please review and approve the attached invoice...",
        from: "Condé Nast Finance",
        fromEmail: "finance@condenast.co.uk",
        unread: true,
        flagged: false,
        labels: ["finance"],
        receivedAt: new Date("2025-03-31T08:50:00Z"),
      },
      {
        subject: "VAT return reminder – period ending 31 Mar 2025",
        snippet: "This is a reminder that your VAT return is due by 7 April 2025.",
        from: "HMRC",
        fromEmail: "noreply@hmrc.gov.uk",
        unread: false,
        flagged: true,
        labels: ["compliance"],
        receivedAt: new Date("2025-03-28T10:00:00Z"),
      },
    ],
    skipDuplicates: true,
  });

  console.log("✅ Email threads created");
  console.log("\n🎉 Seed complete! OutlanderOS is ready.");
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
