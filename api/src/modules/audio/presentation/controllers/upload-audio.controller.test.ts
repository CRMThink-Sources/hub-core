import type { Request } from 'express'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  NEED_OPERATOR_OAUTH,
  UploadAudioController,
  type ConvertRecordedAudio,
  type CreateBitrixDiskClient,
  type ResolveOperatorBitrixAccessToken,
} from './upload-audio.controller'
import type { GetDomainRepository } from '@/shared/domain/repositories/domain/get-domain.repository'
import { BitrixError } from '@/shared/infra/clients/errors/bitrix-client.error'
import { createHash } from 'node:crypto'

describe('UploadAudioController', () => {
  const iframeHash = '0e9c40cee01d6f182e9261b38b30b5c3'
  const domain = 'crmthink.bitrix24.com.br'
  const userId = '2'

  const getDomain = vi.fn()
  const getDomainRepository: GetDomainRepository = {
    getDomainById: vi.fn(),
    getDomain,
  }

  const uploadFileToChat = vi.fn()
  const createDiskClient: CreateBitrixDiskClient = vi.fn(() => ({
    uploadFileToChat,
  }))
  const resolveOperatorAccessToken: ResolveOperatorBitrixAccessToken = vi.fn()

  const convertRecordedAudio: ConvertRecordedAudio = vi.fn(
    async (inputBuffer, originalFileName) => ({
      buffer: Buffer.from(`mp3:${inputBuffer.toString()}`),
      fileName: (originalFileName ?? 'audio').replace(/\.[^.]+$/, '') + '.mp3',
    }),
  )

  const controller = new UploadAudioController(
    getDomainRepository,
    createDiskClient,
    resolveOperatorAccessToken,
    iframeHash,
    convertRecordedAudio,
  )

  function makeImbotAuthBody(overrides: Record<string, string> = {}) {
    const domainHash = createHash('md5')
      .update(`${domain}${iframeHash}`)
      .digest('hex')
    const userHash = createHash('md5')
      .update(`${userId}${iframeHash}`)
      .digest('hex')

    return {
      dialogId: 'chat80619',
      domain: `https://${domain}`,
      userId,
      userHash,
      domainHash,
      ...overrides,
    }
  }

  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(convertRecordedAudio).mockImplementation(
      async (inputBuffer, originalFileName) => ({
        buffer: Buffer.from(`mp3:${inputBuffer.toString()}`),
        fileName: (originalFileName ?? 'audio').replace(/\.[^.]+$/, '') + '.mp3',
      }),
    )
    getDomain.mockResolvedValue({
      id: 'domain-1',
      name: domain,
      memberId: 'member-1',
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    uploadFileToChat.mockResolvedValue({
      dialogId: 'chat80619',
      messageId: 99,
      file: { id: 138, name: 'audio.mp3' },
    })
    vi.mocked(resolveOperatorAccessToken).mockResolvedValue('operator-token')
  })

  function makeRequest(
    body: Record<string, string>,
    file?: Express.Multer.File,
  ) {
    return {
      body,
      file,
    } as Request
  }

  it('returns 400 when auth payload is missing', async () => {
    const response = await controller.perform(
      makeRequest({ dialogId: 'chat80619', domain }, {
        buffer: Buffer.from('audio'),
        originalname: 'audio.webm',
        mimetype: 'audio/webm',
      } as Express.Multer.File),
      {} as never,
    )

    expect(response.status).toBe(400)
    expect(createDiskClient).not.toHaveBeenCalled()
  })

  it('returns 400 when audio file is missing', async () => {
    const response = await controller.perform(
      makeRequest({
        dialogId: 'chat80619',
        domain,
        accessToken: 'operator-token',
      }),
      {} as never,
    )

    expect(response.status).toBe(400)
    expect(createDiskClient).not.toHaveBeenCalled()
  })

  it('returns 404 when domain does not exist', async () => {
    getDomain.mockResolvedValue(null)

    const response = await controller.perform(
      makeRequest(
        {
          dialogId: 'chat80619',
          domain: 'unknown.bitrix24.com.br',
          accessToken: 'operator-token',
        },
        {
          buffer: Buffer.from('audio'),
          originalname: 'audio.webm',
          mimetype: 'audio/webm',
        } as Express.Multer.File,
      ),
      {} as never,
    )

    expect(response.status).toBe(404)
    expect(createDiskClient).not.toHaveBeenCalled()
  })

  it('uploads file using operator token via im.v2.File.upload', async () => {
    const response = await controller.perform(
      makeRequest(
        {
          dialogId: 'chat80619',
          domain,
          accessToken: 'operator-token',
        },
        {
          buffer: Buffer.from('audio-bytes'),
          originalname: 'audio.webm',
          mimetype: 'audio/webm',
        } as Express.Multer.File,
      ),
      {} as never,
    )

    expect(createDiskClient).toHaveBeenCalledWith(domain, 'operator-token')
    expect(resolveOperatorAccessToken).not.toHaveBeenCalled()
    expect(convertRecordedAudio).toHaveBeenCalledWith(
      Buffer.from('audio-bytes'),
      'audio.webm',
    )
    expect(uploadFileToChat).toHaveBeenCalledWith({
      dialogId: 'chat80619',
      fileName: 'audio.mp3',
      base64: Buffer.from('mp3:audio-bytes').toString('base64'),
      message: '',
    })
    expect(response.status).toBe(200)
  })

  it('uploads file using resolved operator token after imbot hash validation', async () => {
    const response = await controller.perform(
      makeRequest(makeImbotAuthBody(), {
        buffer: Buffer.from('audio-bytes'),
        originalname: 'audio.webm',
        mimetype: 'audio/webm',
      } as Express.Multer.File),
      {} as never,
    )

    expect(resolveOperatorAccessToken).toHaveBeenCalledWith(domain, userId)
    expect(createDiskClient).toHaveBeenCalledWith(domain, 'operator-token')
    expect(response.status).toBe(200)
  })

  it('returns 401 NEED_OPERATOR_OAUTH when operator token is missing', async () => {
    vi.mocked(resolveOperatorAccessToken).mockResolvedValue(null)

    const response = await controller.perform(
      makeRequest(makeImbotAuthBody(), {
        buffer: Buffer.from('audio'),
        originalname: 'audio.webm',
        mimetype: 'audio/webm',
      } as Express.Multer.File),
      {} as never,
    )

    expect(response.status).toBe(401)
    expect(response.result).toMatchObject({ code: NEED_OPERATOR_OAUTH })
    expect(createDiskClient).not.toHaveBeenCalled()
  })

  it('returns 401 when imbot iframe hash is invalid', async () => {
    const response = await controller.perform(
      makeRequest(makeImbotAuthBody({ userHash: 'invalid' }), {
        buffer: Buffer.from('audio'),
        originalname: 'audio.webm',
        mimetype: 'audio/webm',
      } as Express.Multer.File),
      {} as never,
    )

    expect(response.status).toBe(401)
    expect(resolveOperatorAccessToken).not.toHaveBeenCalled()
  })

  it('propagates conversion errors', async () => {
    vi.mocked(convertRecordedAudio).mockRejectedValue(
      new Error('ffmpeg exited with code 1'),
    )

    await expect(
      controller.perform(
        makeRequest(
          {
            dialogId: 'chat80619',
            domain,
            accessToken: 'operator-token',
          },
          {
            buffer: Buffer.from('audio'),
            originalname: 'audio.webm',
            mimetype: 'audio/webm',
          } as Express.Multer.File,
        ),
        {} as never,
      ),
    ).rejects.toThrow('ffmpeg exited with code 1')

    expect(uploadFileToChat).not.toHaveBeenCalled()
  })

  it('propagates BitrixError from upload', async () => {
    uploadFileToChat.mockRejectedValue(
      new BitrixError('Bitrix error: 403 - {"error":"ACCESS_DENIED"}'),
    )

    await expect(
      controller.perform(
        makeRequest(
          {
            dialogId: 'chat80619',
            domain,
            accessToken: 'operator-token',
          },
          {
            buffer: Buffer.from('audio'),
            originalname: 'audio.webm',
            mimetype: 'audio/webm',
          } as Express.Multer.File,
        ),
        {} as never,
      ),
    ).rejects.toThrow(BitrixError)
  })
})
