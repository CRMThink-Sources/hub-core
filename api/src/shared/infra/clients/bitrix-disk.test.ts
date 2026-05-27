import { AxiosError } from 'axios'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { BitrixDiskClient } from './bitrix-disk'
import { BitrixError } from './errors/bitrix-client.error'

describe('BitrixDiskClient.uploadFileToChat', () => {
  const post = vi.fn()

  beforeEach(() => {
    post.mockReset()
  })

  it('posts im.v2.File.upload with dialogId and file fields', async () => {
    post.mockResolvedValue({
      data: {
        result: {
          dialogId: 'chat80619',
          messageId: 99,
          file: { id: 138, name: 'audio.webm' },
        },
      },
    })

    const client = BitrixDiskClient.withUserToken(
      'crmthink.bitrix24.com.br',
      'operator-token',
      { post },
    )

    const result = await client.uploadFileToChat({
      dialogId: 'chat80619',
      fileName: 'audio.webm',
      base64: 'dGVzdA==',
      message: '',
    })

    expect(post).toHaveBeenCalledWith('im.v2.File.upload', {
      dialogId: 'chat80619',
      fields: {
        name: 'audio.webm',
        content: 'dGVzdA==',
        message: '',
      },
    })
    expect(result.messageId).toBe(99)
    expect(result.file.id).toBe(138)
  })

  it('throws BitrixError when Bitrix returns 403 ACCESS_DENIED', async () => {
    const axiosError = new AxiosError('Forbidden')
    axiosError.response = {
      status: 403,
      data: { error: 'ACCESS_DENIED', error_description: 'Access denied!' },
    } as AxiosError['response']

    post.mockRejectedValue(axiosError)

    const client = BitrixDiskClient.withUserToken(
      'crmthink.bitrix24.com.br',
      'token',
      {
        post,
      },
    )

    await expect(
      client.uploadFileToChat({
        dialogId: 'chat80619',
        fileName: 'audio.webm',
        base64: 'dGVzdA==',
      }),
    ).rejects.toThrow(BitrixError)

    await expect(
      client.uploadFileToChat({
        dialogId: 'chat80619',
        fileName: 'audio.webm',
        base64: 'dGVzdA==',
      }),
    ).rejects.toThrow(/ACCESS_DENIED/)
  })

  it('throws BitrixError on network failure', async () => {
    post.mockRejectedValue(new Error('Network error'))

    const client = BitrixDiskClient.withUserToken(
      'crmthink.bitrix24.com.br',
      'token',
      {
        post,
      },
    )

    await expect(
      client.uploadFileToChat({
        dialogId: 'chat80619',
        fileName: 'audio.webm',
        base64: 'dGVzdA==',
      }),
    ).rejects.toThrow(BitrixError)

    await expect(
      client.uploadFileToChat({
        dialogId: 'chat80619',
        fileName: 'audio.webm',
        base64: 'dGVzdA==',
      }),
    ).rejects.toThrow(/Failed to upload file to chat/)
  })
})
