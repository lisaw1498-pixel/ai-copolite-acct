import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/current-user";
import { db } from "@/db/client";
import { skills, technologies } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const skillRows = db.select().from(skills).where(eq(skills.userId, user.id)).all();
  const techRows = db.select().from(technologies).where(eq(technologies.userId, user.id)).all();
  return NextResponse.json({ skills: skillRows, technologies: techRows });
}

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await req.json();

  if (body.kind === "technology") {
    const row = db
      .insert(technologies)
      .values({
        userId: user.id,
        technologyName: body.name,
        category: body.category,
        experienceLevel: body.experienceLevel || "working_knowledge",
        yearsExperience: body.yearsExperience,
        lastUsed: body.lastUsed,
        verificationStatus: "verified_user",
        evidenceJson: { source: "user_added", note: body.example },
      })
      .returning()
      .get();
    return NextResponse.json({ technology: row });
  }

  const row = db
    .insert(skills)
    .values({
      userId: user.id,
      skillName: body.name,
      category: body.category,
      yearsExperience: body.yearsExperience,
      proficiency: body.proficiency,
      verified: true,
      evidenceJson: { source: "user_added", note: body.example },
    })
    .returning()
    .get();
  return NextResponse.json({ skill: row });
}
