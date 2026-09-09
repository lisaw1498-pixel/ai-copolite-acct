import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/current-user";
import { db } from "@/db/client";
import { employers, experiences } from "@/db/schema";
import { and, eq } from "drizzle-orm";

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const kind = new URL(req.url).searchParams.get("kind");
  const table = kind === "experience" ? experiences : employers;
  db.delete(table).where(and(eq(table.id, id), eq(table.userId, user.id))).run();
  return NextResponse.json({ ok: true });
}
