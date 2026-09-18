import { NextRequest, NextResponse } from 'next/server'

const backendOpenChannelButtonSend = () => {
  const base = process.env.API_URL?.replace(/\/$/, '') ?? ''
  if (!base) return null
  return `${base}/open-channel-button/send`
}

export async function POST(req: NextRequest) {
  const url = backendOpenChannelButtonSend()
  if (!url) {
    return NextResponse.json(
      { message: 'API_URL não configurada no servidor' },
      { status: 500 },
    )
  }

  let payload: unknown
  try {
    payload = await req.json()
  } catch {
    return NextResponse.json(
      { message: 'Corpo da requisição inválido' },
      { status: 400 },
    )
  }

  const backendRes = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })

  const text = await backendRes.text()
  let responseBody: unknown
  try {
    responseBody = text ? JSON.parse(text) : {}
  } catch {
    responseBody = { message: text || 'Resposta sem JSON do backend' }
  }

  return NextResponse.json(responseBody, { status: backendRes.status })
}
