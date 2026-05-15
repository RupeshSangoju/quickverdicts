import { NextRequest, NextResponse } from "next/server";

const CENSUS_BASE = "https://api.census.gov/data/2020/dec/pl";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const stateCode = req.nextUrl.searchParams.get("stateCode");
  const stateName = req.nextUrl.searchParams.get("stateName") ?? "";
  if (!stateCode) {
    return NextResponse.json({ error: "stateCode is required" }, { status: 400 });
  }
  const key = process.env.CENSUS_API_KEY ?? "";
  try {
    const code = stateCode.padStart(2, "0");
    const res = await fetch(
      `${CENSUS_BASE}?get=NAME&for=county:*&in=state:${code}&key=${key}`,
      { next: { revalidate: 86400 } }
    );
    if (!res.ok) throw new Error(`Census API ${res.status}`);
    const data: string[][] = await res.json();
    const counties = data
      .slice(1)
      .map((r, idx) => ({
        label: r[0],
        // Census format: "Barnstable County, Massachusetts"
        // 1) strip ", StateName" suffix  2) strip trailing " County"/" Parish"/etc.
        value: r[0]
          .replace(/,.*$/, "")
          .replace(/ (County|Parish|Borough|City and Borough|Census Area|Municipality)$/i, "")
          .trim() || r[0],
        code: `${stateCode}-${r[2] ?? idx}`,
      }))
      .sort((a, b) => a.label.localeCompare(b.label));
    return NextResponse.json({ counties });
  } catch (err) {
    console.error("[/api/location/counties]", err);
    return NextResponse.json({ error: "Failed to fetch counties" }, { status: 502 });
  }
}
