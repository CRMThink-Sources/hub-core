import { describe, expect, it, vi } from 'vitest'
import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  type S3Client,
} from '@aws-sdk/client-s3'
import {
  OutboundMediaNotFoundError,
  OutboundMediaStorageUnavailableError,
} from '@/modules/thinkzap/domain/ports/outbound-media-storage.port'
import { makeOutboundMediaStorage } from '@/modules/thinkzap/main/make-outbound-media-storage'
import { R2OutboundMediaStorage } from './r2-outbound-media-storage.adapter'

function makeSut(send = vi.fn().mockResolvedValue({})) {
  const s3 = { send } as unknown as S3Client
  const storage = new R2OutboundMediaStorage(
    s3,
    'thinkzap-outbound-media',
    () => new Date('2026-10-21T12:00:00Z'),
  )
  return { storage, send }
}

describe('R2OutboundMediaStorage', () => {
  it('grava no bucket privado com chave por domínio e mês, sem URL pública', async () => {
    const { storage, send } = makeSut()

    const stored = await storage.store({
      data: Buffer.from('pdf'),
      contentType: 'application/pdf',
      scope: { domainId: 'domain-1' },
    })

    // Só a chave volta: não existe URL pública do anexo.
    expect(Object.keys(stored)).toEqual(['key'])
    expect(stored.key).toMatch(
      /^outbound-media\/domain-1\/2026-10\/[0-9a-f-]{36}$/,
    )
    const [command] = send.mock.calls[0] as [PutObjectCommand]
    expect(command).toBeInstanceOf(PutObjectCommand)
    expect(command.input).toMatchObject({
      Bucket: 'thinkzap-outbound-media',
      ContentType: 'application/pdf',
    })
  })

  it('falha ao gravar vira indisponível', async () => {
    const { storage } = makeSut(vi.fn().mockRejectedValue(new Error('503')))

    await expect(
      storage.store({
        data: Buffer.from('x'),
        contentType: 'image/png',
        scope: { domainId: 'd' },
      }),
    ).rejects.toBeInstanceOf(OutboundMediaStorageUnavailableError)
  })

  it('lê os bytes e o tipo', async () => {
    const { storage, send } = makeSut(
      vi.fn().mockResolvedValue({
        Body: {
          transformToByteArray: () => Promise.resolve(new Uint8Array([1, 2])),
        },
        ContentType: 'image/png',
      }),
    )

    const loaded = await storage.load('k')

    expect(send.mock.calls[0]![0]).toBeInstanceOf(GetObjectCommand)
    expect(loaded).toEqual({
      data: Buffer.from([1, 2]),
      contentType: 'image/png',
    })

    return Promise.resolve()
  })

  it('arquivo expirado vira não encontrado', async () => {
    const { storage } = makeSut(
      vi
        .fn()
        .mockRejectedValue(
          Object.assign(new Error('x'), { name: 'NoSuchKey' }),
        ),
    )

    await expect(storage.load('k')).rejects.toBeInstanceOf(
      OutboundMediaNotFoundError,
    )
  })

  it('remove apaga a chave', async () => {
    const { storage, send } = makeSut()

    await storage.remove('k')

    expect(send.mock.calls[0]![0]).toBeInstanceOf(DeleteObjectCommand)
  })
})

describe('makeOutboundMediaStorage', () => {
  const base = { accountId: 'a', accessKeyId: 'b', secretAccessKey: 'c' }

  it('sem bucket próprio devolve null (anexo segue síncrono)', () => {
    expect(
      makeOutboundMediaStorage({ ...base, outboundMediaBucket: '' }),
    ).toBeNull()
  })

  it('com a conta e o bucket monta o adapter', () => {
    expect(
      makeOutboundMediaStorage({ ...base, outboundMediaBucket: 'bkt' }),
    ).toBeInstanceOf(R2OutboundMediaStorage)
  })
})
