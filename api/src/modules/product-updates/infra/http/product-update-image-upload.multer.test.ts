import type { AddressInfo } from 'node:net'
import express from 'express'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { productUpdateImageUpload } from './product-update-image-upload.multer'

/**
 * Servidor de verdade (porta aleatória): o que importa é o multer real lendo o
 * multipart — mock não diria se a recusa sai antes do handler.
 */
let baseUrl = ''
let close: () => void = () => undefined

beforeAll(async () => {
  const app = express()
  app.post('/image', productUpdateImageUpload, (req, res) => {
    res.json({ fileSize: req.file?.size ?? null })
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

function upload(size: number | null, type = 'image/png', name = 'a.png') {
  const form = new FormData()
  if (size !== null) {
    form.append('image', new Blob([new Uint8Array(size)], { type }), name)
  }
  return fetch(`${baseUrl}/image`, { method: 'POST', body: form })
}

describe('productUpdateImageUpload', () => {
  it.each([
    ['PNG', 'image/png', 'a.png'],
    ['JPEG', 'image/jpeg', 'a.jpg'],
  ])('entrega %s ao handler', async (_, type, name) => {
    const res = await upload(2048, type, name)

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ fileSize: 2048 })
  })

  it('GIF: 422 antes do handler', async () => {
    const res = await upload(2048, 'image/gif', 'a.gif')

    expect(res.status).toBe(422)
    expect(await res.json()).toEqual({
      error: 'A imagem precisa ser um arquivo PNG ou JPEG',
      reason: 'invalid-image-type',
    })
  })

  it('passa de 5 MB: 422', async () => {
    const res = await upload(5 * 1024 * 1024 + 1)

    expect(res.status).toBe(422)
    expect(await res.json()).toEqual({
      error: 'A imagem passa de 5 MB',
      reason: 'image-too-large',
    })
  })

  it('sem arquivo chega ao handler sem file', async () => {
    const res = await upload(null)

    expect(await res.json()).toEqual({ fileSize: null })
  })
})
