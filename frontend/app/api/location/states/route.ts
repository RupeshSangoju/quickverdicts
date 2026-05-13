import { NextResponse } from "next/server";

const CENSUS_BASE = "https://api.census.gov/data/2020/dec/pl";

export const dynamic = "force-dynamic";

export async function GET() {
  const key = process.env.CENSUS_API_KEY ?? "";
  try {
    const res = await fetch(`${CENSUS_BASE}?get=NAME&for=state:*&key=${key}`, {
      next: { revalidate: 86400 }, // cache 24 h server-side
    });
    if (!res.ok) throw new Error(`Census API ${res.status}`);
    const data: string[][] = await res.json();
    const states = data
      .slice(1)
      .map((r) => ({ label: r[0], value: r[1] }))
      .sort((a, b) => a.label.localeCompare(b.label));
    return NextResponse.json({ states });
  } catch (err) {
    console.error("[/api/location/states]", err);
    return NextResponse.json({ error: "Failed to fetch states" }, { status: 502 });
  }
}
