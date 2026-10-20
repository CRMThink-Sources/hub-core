import { describe, expect, it, vi } from 'vitest'
import { PutObjectCommand, type S3Client } from '@aws-sdk/client-s3'
import { TemplateImageStorageUnavailableError } from '@/modules/thinkzap/domain/ports/template-image-storage.port'
import { R2TemplateImageStorage } from './r2-template-image-storage.adapter'

function makeSut(send = vi.fn().mockResolvedValue({})) {
  const s3 = { send } as unknown as S3Client
  const storage = new R2TemplateImageStorage(
    s3,
    {
      bucket: 'thinkzap-template-images-staging',
      publicBaseUrl: 'https://imagens.loja.com/',
    },
    () => new Date('2026-10-20T12:00:00Z'),
  )
  return { storage, send }
}

const png = Buffer.from([0x89, 0x50, 0x4e, 0x47])

describe('R2TemplateImageStorage', () => {
  it('grava no bucket com chave por domínio e mês e devolve a URL pública', async () => {
    const { storage, send } = makeSut()

    const stored = await storage.store({
      data: png,
      contentType: 'image/png',
      scope: { domainId: 'domain-1' },
    })

    expect(stored.key).toMatch(
      /^template-headers\/domain-1\/2026-10\/[0-9a-f-]{36}\.png$/,
    )
    expect(stored.url).toBe(`https://imagens.loja.com/${stored.key}`)

    const [command] = send.mock.calls[0] as [PutObjectCommand]
    expect(command).toBeInstanceOf(PutObjectCommand)
    expect(command.input).toMatchObject({
      Bucket: 'thinkzap-template-images-staging',
      Key: stored.key,
      Body: png,
      ContentType: 'image/png',
      ContentLength: 4,
    })
  })

  it('usa .jpg para JPEG e chaves diferentes a cada upload', async () => {
    const { storage } = makeSut()
    const input = {
      data: Buffer.from([0xff, 0xd8, 0xff]),
      contentType: 'image/jpeg' as const,
      scope: { domainId: 'domain-1' },
    }

    const first = await storage.store(input)
    const second = await storage.store(input)

    expect(first.key).toMatch(/\.jpg$/)
    expect(first.key).not.toBe(second.key)
  })

  it('traduz falha do R2 em armazenamento indisponível', async () => {
    const { storage } = makeSut(
      vi.fn().mockRejectedValue(new Error('AccessDenied')),
    )

    const error: unknown = await storage
      .store({ data: png, contentType: 'image/png', scope: { domainId: 'd' } })
      .catch((e: unknown) => e)

    expect(error).toBeInstanceOf(TemplateImageStorageUnavailableError)
    expect((error as TemplateImageStorageUnavailableError).detail).toBe(
      'AccessDenied',
    )
  })
})
