import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const token = req.headers.get("authorization");

  const response = await fetch(
    `${process.env.API_URL}/thinkerszap/connector/list`,
    {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: token } : {}),
      },
    }
  );

  const data = await response.json();
  return NextResponse.json(data);
}
