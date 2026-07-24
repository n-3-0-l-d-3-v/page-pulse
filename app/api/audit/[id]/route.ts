import { NextRequest, NextResponse } from "next/server";
import { getReport } from "@/lib/redis";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const report = await getReport(id);
  if (!report) {
    return NextResponse.json(
      { error: { code: "NOT_FOUND", message: "No report found for that id (it may have expired)." } },
      { status: 404 }
    );
  }
  return NextResponse.json({ id, report });
}
