import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/current-user";
import { db } from "@/db/client";
import { employers, experiences } from "@/db/schema";
import { desc, eq } from "drizzle-orm";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const employerRows = db
    .select()
    .from(employers)
    .where(eq(employers.userId, user.id))
    .orderBy(desc(employers.createdAt))
    .all();
  const experienceRows = db
    .select()
    .from(experiences)
    .where(eq(experiences.userId, user.id))
    .orderBy(desc(experiences.createdAt))
    .all();
  return NextResponse.json({ employers: employerRows, experiences: experienceRows });
}

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await req.json();

  if (body.kind === "experience") {
    const row = db
      .insert(experiences)
      .values({
        userId: user.id,
        employerId: body.employerId || null,
        experienceType: body.experienceType || "project",
        title: body.title,
        description: body.description,
        metricsJson: body.metrics ?? [],
        technologiesJson: body.technologies ?? [],
        skillsJson: body.skills ?? [],
        verified: true,
        source: "user",
      })
      .returning()
      .get();
    return NextResponse.json({ experience: row });
  }

  const row = db
    .insert(employers)
    .values({
      userId: user.id,
      companyName: body.companyName,
      jobTitle: body.jobTitle,
      startDate: body.startDate,
      endDate: body.endDate,
      description: body.description,
    })
    .returning()
    .get();
  return NextResponse.json({ employer: row });
}
