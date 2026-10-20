import https from 'node:https'
import { BlockList, isIP, type LookupFunction } from 'node:net'
import { lookup as dnsLookup } from 'node:dns'
import axios, { type AxiosInstance } from 'axios'
import {
  TEMPLATE_SAMPLE_IMAGE_MAX_BYTES,
  TemplateSampleImage,
  TemplateSampleImageContentType,
  TemplateSampleImageError,
  TemplateSampleImageFetcher,
} from '@/modules/thinkzap/domain/ports/template-sample-image-fetcher.port'
import {
  isHttpsUrl,
  isMetaCdnUrl,
} from '@/modules/thinkzap/domain/template-header'

const ACCEPTED_TYPES: TemplateSampleImageContentType[] = [
  'image/jpeg',
  'image/png',
]
const MAX_REDIRECTS = 3
const TIMEOUT_MS = 10_000

/**
 * Faixas que a URL do cliente nunca pode alcançar: a API roda dentro da nossa rede,
 * e um download "da imagem de exemplo" é a porta clássica de SSRF.
 */
const PRIVATE_RANGES = (() => {
  const list = new BlockList()
  list.addSubnet('0.0.0.0', 8, 'ipv4')
  list.addSubnet('10.0.0.0', 8, 'ipv4')
  list.addSubnet('100.64.0.0', 10, 'ipv4')
  list.addSubnet('127.0.0.0', 8, 'ipv4')
  list.addSubnet('169.254.0.0', 16, 'ipv4')
  list.addSubnet('172.16.0.0', 12, 'ipv4')
  list.addSubnet('192.168.0.0', 16, 'ipv4')
  list.addSubnet('::', 128, 'ipv6')
  list.addSubnet('::1', 128, 'ipv6')
  list.addSubnet('fc00::', 7, 'ipv6')
  list.addSubnet('fe80::', 10, 'ipv6')
  return list
})()

export function isPrivateAddress(address: string): boolean {
  const family = isIP(address)
  if (family === 4) return PRIVATE_RANGES.check(address, 'ipv4')
  if (family === 6) {
    // `::ffff:10.0.0.1`: IPv4 embutido em IPv6 vale pela faixa IPv4.
    const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/i.exec(address)?.[1]
    if (mapped) return PRIVATE_RANGES.check(mapped, 'ipv4')
    return PRIVATE_RANGES.check(address, 'ipv6')
  }
  return false
}

/**
 * `lookup` do agente HTTPS: resolve o host e recusa se **qualquer** endereço for
 * privado. Fica no agente, e não numa checagem antes do GET, para valer também na
 * conexão de verdade — sem janela para o DNS responder outro IP entre a checagem e
 * o connect.
 */
export const guardedLookup: LookupFunction = (hostname, options, callback) => {
  dnsLookup(hostname, { ...options, all: true }, (error, addresses) => {
    if (error) return callback(error, '', 4)
    const list = addresses as unknown as Array<{
      address: string
      family: number
    }>
    const [first] = list
    if (!first || list.some(a => isPrivateAddress(a.address))) {
      return callback(
        new TemplateSampleImageError('private_host', hostname),
        '',
        4,
      )
    }
    if (options.all) return callback(null, list as never)
    callback(null, first.address, first.family)
  })
}

/**
 * Baixa a imagem de exemplo com as travas do design (D2): só `https`, nada do CDN
 * da Meta, nada de host privado (inclusive depois de redirect), timeout curto e
 * no máximo 5 MB, aceitando só JPEG e PNG.
 *
 * Os redirects são seguidos aqui, um a um, para que cada destino passe pelas mesmas
 * checagens de URL.
 */
export class AxiosTemplateSampleImageFetcher implements TemplateSampleImageFetcher {
  constructor(
    private readonly http: AxiosInstance = axios.create({
      httpsAgent: new https.Agent({ lookup: guardedLookup }),
    }),
  ) {}

  async fetch(url: string): Promise<TemplateSampleImage> {
    let current = url.trim()

    for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
      assertAllowedUrl(current)

      const response = await this.get(current)

      if (response.status >= 300 && response.status < 400) {
        const location = header(response.headers.location)
        if (!location) throw new TemplateSampleImageError('unreachable')
        current = new URL(location, current).toString()
        continue
      }
      if (response.status < 200 || response.status >= 300) {
        throw new TemplateSampleImageError(
          'unreachable',
          `status ${response.status}`,
        )
      }

      const data = Buffer.from(response.data)
      if (data.length > TEMPLATE_SAMPLE_IMAGE_MAX_BYTES) {
        throw new TemplateSampleImageError('too_large')
      }
      const contentType = normalizeContentType(response.headers['content-type'])
      if (!contentType) {
        throw new TemplateSampleImageError('invalid_type')
      }
      return { data, contentType }
    }

    throw new TemplateSampleImageError('unreachable', 'too many redirects')
  }

  private async get(url: string) {
    try {
      return await this.http.get<ArrayBuffer>(url, {
        responseType: 'arraybuffer',
        maxContentLength: TEMPLATE_SAMPLE_IMAGE_MAX_BYTES,
        maxRedirects: 0,
        timeout: TIMEOUT_MS,
        validateStatus: () => true,
      })
    } catch (error) {
      throw toSampleImageError(error)
    }
  }
}

function assertAllowedUrl(url: string): void {
  if (!isHttpsUrl(url)) throw new TemplateSampleImageError('not_https')
  if (isMetaCdnUrl(url)) throw new TemplateSampleImageError('meta_cdn')
  // IP literal não passa pelo `lookup` do agente: checa aqui.
  const host = new URL(url).hostname.replace(/^\[|\]$/g, '')
  if (isIP(host) && isPrivateAddress(host)) {
    throw new TemplateSampleImageError('private_host', host)
  }
}

function toSampleImageError(error: unknown): TemplateSampleImageError {
  if (error instanceof TemplateSampleImageError) return error
  const cause = (error as { cause?: unknown }).cause
  if (cause instanceof TemplateSampleImageError) return cause
  const message = error instanceof Error ? error.message : String(error)
  if (message.includes('maxContentLength')) {
    return new TemplateSampleImageError('too_large')
  }
  return new TemplateSampleImageError('unreachable', message)
}

function normalizeContentType(
  value: unknown,
): TemplateSampleImageContentType | null {
  const type = header(value)?.split(';')[0]?.trim().toLowerCase()
  return ACCEPTED_TYPES.find(t => t === type) ?? null
}

function header(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined
}
