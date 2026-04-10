import { NextRequest, NextResponse } from 'next/server'

const backendAudioUpload = () => {
  const base = process.env.API_URL?.replace(/\/$/, '') ?? ''
  if (!base) return null
  return `${base}/audio/upload`
}

export async function POST(req: NextRequest) {
  const url = backendAudioUpload()
  if (!url) {
    return NextResponse.json(
      { message: 'API_URL não configurada no servidor' },
      { status: 500 },
    )
  }

  let formData: FormData
  try {
    formData = await req.formData()
  } catch {
    return NextResponse.json(
      { message: 'Corpo da requisição inválido' },
      { status: 400 },
    )
  }

  const backendRes = await fetch(url, {
    method: 'POST',
    body: formData,
  })

  const text = await backendRes.text()
  let payload: unknown
  try {
    payload = text ? JSON.parse(text) : {}
  } catch {
    payload = { message: text || 'Resposta sem JSON do backend' }
  }

  return NextResponse.json(payload, { status: backendRes.status })
}
