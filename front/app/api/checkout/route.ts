import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const token = req.headers.get("authorization");

  const response = await fetch(
    `${process.env.API_URL}/thinkerszap/connector/create`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: token } : {}),
      },
      body: JSON.stringify(await req.json()),
    }
  );

  const data = await response.json();
  return NextResponse.json(data);
}
