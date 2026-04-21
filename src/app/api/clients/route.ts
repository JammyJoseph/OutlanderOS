import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function GET() {
  try {
    const clients = await prisma.client.findMany({
      select: { id: true, name: true, industry: true },
      orderBy: { name: "asc" },
    });
    return NextResponse.json(clients);
  } catch (err) {
    console.error("GET /api/clients", err);
    return NextResponse.json({ error: "Failed to fetch clients" }, { status: 500 });
  }
}
