import type { AddressInfo } from 'node:net'
import express from 'express'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { templateHeaderImageUpload } from './template-header-image-upload.multer'

/**
 * Servidor de verdade (porta aleatória): o que importa aqui é o multer real lendo
 * o multipart — mock não diria se o `400` de arquivo grande sai antes do handler.
 */
let baseUrl = ''
let close: () => void = () => undefined

beforeAll(async () => {
  const app = express()
  app.use(express.json())
  app.post('/t', templateHeaderImageUpload, (req, res) => {
    res.json({
      body: req.body as unknown,
      fileSize: req.file?.size ?? null,
    })
  })
  await new Promise<void>(resolve => {
    const server = app.listen(0, () => {
      baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`
      close = () => server.close()
      resolve()
    })
  })
})

afterAll(() => close())

function multipart(size: number) {
  const form = new FormData()
  form.append('payload', '{"name":"promo"}')
  form.append(
    'headerImage',
    new Blob([new Uint8Array(size)], { type: 'image/png' }),
    'a.png',
  )
  return fetch(`${baseUrl}/t`, { method: 'POST', body: form })
}

describe('templateHeaderImageUpload', () => {
  it('entrega o arquivo e o payload ao handler', async () => {
    const res = await multipart(1024)

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({
      body: { payload: '{"name":"promo"}' },
      fileSize: 1024,
    })
  })

  it('400 com mensagem quando o arquivo passa de 5 MB', async () => {
    const res = await multipart(5 * 1024 * 1024 + 1)

    expect(res.status).toBe(400)
    expect(await res.json()).toEqual({
      error: 'A imagem de exemplo passa de 5 MB',
    })
  })

  it('pedido JSON passa direto', async () => {
    const res = await fetch(`${baseUrl}/t`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'promo' }),
    })

    expect(await res.json()).toEqual({
      body: { name: 'promo' },
      fileSize: null,
    })
  })
})
