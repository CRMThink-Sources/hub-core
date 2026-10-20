import { describe, expect, it, vi } from 'vitest'
import type { AxiosInstance } from 'axios'
import { TemplateSampleImageError } from '@/modules/thinkzap/domain/ports/template-sample-image-fetcher.port'
import {
  AxiosTemplateSampleImageFetcher,
  guardedLookup,
  isPrivateAddress,
} from './axios-template-sample-image-fetcher.adapter'

type FakeResponse = {
  status: number
  data?: Buffer
  headers?: Record<string, string>
}

function makeSut(...responses: Array<FakeResponse | Error>) {
  const get = vi.fn()
  for (const response of responses) {
    if (response instanceof Error) get.mockRejectedValueOnce(response)
    else
      get.mockResolvedValueOnce({
        data: Buffer.alloc(0),
        headers: {},
        ...response,
      })
  }
  const http = { get } as unknown as AxiosInstance
  return { get, fetcher: new AxiosTemplateSampleImageFetcher(http) }
}

async function reasonOf(promise: Promise<unknown>) {
  const error = await promise.catch((e: unknown) => e)
  expect(error).toBeInstanceOf(TemplateSampleImageError)
  return (error as TemplateSampleImageError).reason
}

describe('AxiosTemplateSampleImageFetcher', () => {
  it('baixa PNG válido com limite de 5 MB e sem redirect automático', async () => {
    const png = Buffer.alloc(300 * 1024)
    const { fetcher, get } = makeSut({
      status: 200,
      data: png,
      headers: { 'content-type': 'image/png' },
    })

    const image = await fetcher.fetch('https://loja.com/banner.png')

    expect(image).toEqual({ data: png, contentType: 'image/png' })
    expect(get).toHaveBeenCalledWith(
      'https://loja.com/banner.png',
      expect.objectContaining({
        maxContentLength: 5 * 1024 * 1024,
        maxRedirects: 0,
      }),
    )
  })

  it('aceita content-type com parâmetros', async () => {
    const { fetcher } = makeSut({
      status: 200,
      data: Buffer.from('jpg'),
      headers: { 'content-type': 'image/jpeg; charset=binary' },
    })

    await expect(fetcher.fetch('https://loja.com/a.jpg')).resolves.toEqual(
      expect.objectContaining({ contentType: 'image/jpeg' }),
    )
  })

  it('too_large com imagem de 8 MB', async () => {
    const { fetcher } = makeSut(
      new Error('maxContentLength size of 5242880 exceeded'),
    )

    expect(await reasonOf(fetcher.fetch('https://loja.com/grande.png'))).toBe(
      'too_large',
    )
  })

  it('too_large quando o corpo passa do limite mesmo sem o erro do axios', async () => {
    const { fetcher } = makeSut({
      status: 200,
      data: Buffer.alloc(8 * 1024 * 1024),
      headers: { 'content-type': 'image/png' },
    })

    expect(await reasonOf(fetcher.fetch('https://loja.com/grande.png'))).toBe(
      'too_large',
    )
  })

  it('invalid_type com text/html', async () => {
    const { fetcher } = makeSut({
      status: 200,
      data: Buffer.from('<html>'),
      headers: { 'content-type': 'text/html' },
    })

    expect(await reasonOf(fetcher.fetch('https://drive.com/view'))).toBe(
      'invalid_type',
    )
  })

  it('meta_cdn com link scontent.whatsapp.net, sem baixar', async () => {
    const { fetcher, get } = makeSut()

    expect(
      await reasonOf(
        fetcher.fetch('https://scontent.whatsapp.net/v/t61/abc.jpg'),
      ),
    ).toBe('meta_cdn')
    expect(get).not.toHaveBeenCalled()
  })

  it('not_https com http://', async () => {
    const { fetcher } = makeSut()

    expect(await reasonOf(fetcher.fetch('http://loja.com/a.png'))).toBe(
      'not_https',
    )
  })

  it('private_host com IP privado literal, sem baixar', async () => {
    const { fetcher, get } = makeSut()

    expect(await reasonOf(fetcher.fetch('https://10.0.0.5/a.png'))).toBe(
      'private_host',
    )
    expect(await reasonOf(fetcher.fetch('https://[::1]/a.png'))).toBe(
      'private_host',
    )
    expect(get).not.toHaveBeenCalled()
  })

  it('private_host quando o redirect aponta para host privado', async () => {
    const { fetcher, get } = makeSut({
      status: 302,
      headers: { location: 'https://127.0.0.1/admin' },
    })

    expect(await reasonOf(fetcher.fetch('https://loja.com/a.png'))).toBe(
      'private_host',
    )
    expect(get).toHaveBeenCalledTimes(1)
  })

  it('private_host vindo do lookup do agente', async () => {
    const { fetcher } = makeSut(
      Object.assign(new Error('connect failed'), {
        cause: new TemplateSampleImageError('private_host', 'interno.local'),
      }),
    )

    expect(await reasonOf(fetcher.fetch('https://interno.local/a.png'))).toBe(
      'private_host',
    )
  })

  it('segue redirect para outro host público', async () => {
    const { fetcher, get } = makeSut(
      { status: 301, headers: { location: '/cdn/a.png' } },
      {
        status: 200,
        data: Buffer.from('png'),
        headers: { 'content-type': 'image/png' },
      },
    )

    await fetcher.fetch('https://loja.com/a.png')

    expect(get).toHaveBeenLastCalledWith(
      'https://loja.com/cdn/a.png',
      expect.anything(),
    )
  })

  it('unreachable com 404', async () => {
    const { fetcher } = makeSut({ status: 404 })

    expect(await reasonOf(fetcher.fetch('https://loja.com/a.png'))).toBe(
      'unreachable',
    )
  })
})

describe('isPrivateAddress', () => {
  it.each([
    '10.1.2.3',
    '127.0.0.1',
    '169.254.169.254',
    '172.20.0.1',
    '192.168.0.10',
    '::1',
    'fd00::1',
    '::ffff:10.0.0.1',
  ])('%s é privado', ip => {
    expect(isPrivateAddress(ip)).toBe(true)
  })

  it.each(['8.8.8.8', '172.32.0.1', '2606:4700::1111'])('%s é público', ip => {
    expect(isPrivateAddress(ip)).toBe(false)
  })
})

describe('guardedLookup', () => {
  it('recusa localhost', async () => {
    const error = await new Promise<unknown>(resolve =>
      guardedLookup('localhost', {}, err => resolve(err)),
    )
    expect(error).toBeInstanceOf(TemplateSampleImageError)
  })
})
