import { NextResponse } from "next/server";
import { db } from "@/db/client";
import { users, userSettings, candidateProfiles } from "@/db/schema";
import { eq } from "drizzle-orm";
import { hashPassword } from "@/lib/password";
import { z } from "zod";

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(8, "Password must be at least 8 characters"),
  fullName: z.string().min(1).optional(),
});

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message || "Invalid input" },
      { status: 400 }
    );
  }

  const email = parsed.data.email.trim().toLowerCase();
  const existing = db.select().from(users).where(eq(users.email, email)).get();
  if (existing) {
    return NextResponse.json({ error: "An account with that email already exists." }, { status: 409 });
  }

  const passwordHash = await hashPassword(parsed.data.password);
  const user = db
    .insert(users)
    .values({
      email,
      passwordHash,
      fullName: parsed.data.fullName,
    })
    .returning()
    .get();

  db.insert(userSettings).values({ userId: user.id }).run();
  db.insert(candidateProfiles).values({ userId: user.id }).run();

  return NextResponse.json({ ok: true, userId: user.id });
}
