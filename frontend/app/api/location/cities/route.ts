import { NextRequest, NextResponse } from "next/server";

const CENSUS_BASE = "https://api.census.gov/data/2020/dec/pl";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const stateCode = req.nextUrl.searchParams.get("stateCode");
  if (!stateCode) {
    return NextResponse.json({ error: "stateCode is required" }, { status: 400 });
  }
  const key = process.env.CENSUS_API_KEY ?? "";
  try {
    const code = stateCode.padStart(2, "0");
    const res = await fetch(
      `${CENSUS_BASE}?get=NAME&for=place:*&in=state:${code}&key=${key}`,
      { next: { revalidate: 86400 } }
    );
    if (!res.ok) throw new Error(`Census API ${res.status}`);
    const data: string[][] = await res.json();
    const cities = data
      .slice(1)
      .map((r, idx) => ({
        label: r[0]
          .replace(/, [^,]+$/, "")
          .replace(/\s+(city|town|village|borough|CDP|township|municipality)\s*$/i, "")
          .trim(),
        value: `${stateCode}-${r[2] ?? idx}`,
      }))
      .sort((a, b) => a.label.localeCompare(b.label));
    return NextResponse.json({ cities });
  } catch (err) {
    console.error("[/api/location/cities]", err);
    return NextResponse.json({ error: "Failed to fetch cities" }, { status: 502 });
  }
}
