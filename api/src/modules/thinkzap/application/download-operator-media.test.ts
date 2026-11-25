import { createServer, type Server } from 'node:http'
import type { AddressInfo } from 'node:net'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { downloadOperatorMedia } from './download-operator-media'
import { RobotFileTooLargeError } from './robot-files/fetch-robot-files'

const MB = 1024 * 1024

describe('downloadOperatorMedia', () => {
  let server: Server
  let baseUrl: string

  // Servidor local: `/<bytes>` devolve um arquivo daquele tamanho.
  beforeAll(async () => {
    server = createServer((req, res) => {
      const size = Number(req.url?.slice(1))
      res.writeHead(200, {
        'content-type': 'video/mp4',
        'content-length': size,
      })
      res.end(Buffer.alloc(size))
    })
    await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve))
    baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`
  })

  afterAll(() => {
    server.closeAllConnections()
    server.close()
  })

  it.each([34 * MB, 64 * MB])(
    'baixa o vídeo do operador de %i bytes',
    async size => {
      const file = await downloadOperatorMedia(`${baseUrl}/${size}`)

      expect(file.data.length).toBe(size)
      expect(file.contentType).toBe('video/mp4')
    },
  )

  it('recusa acima de 64 MB', async () => {
    await expect(
      downloadOperatorMedia(`${baseUrl}/${64 * MB + 1}`),
    ).rejects.toThrow(RobotFileTooLargeError)
  })
})
