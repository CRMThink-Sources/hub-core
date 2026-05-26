import axios from 'axios'

const BASE_URL =
  'https://api.sonax.net.br/a2billing_v2/admin/Public/dbdial_webapi.php'

const NOT_FOUND_BODY = '404 not found'

function decodeBuffer(buffer: Buffer): string {
  const utf8 = buffer.toString('utf-8')
  // Se decodificação UTF-8 produziu replacement chars, tenta latin1
  return utf8.includes('�') ? buffer.toString('latin1') : utf8
}

function parsePipe(raw: string): string[][] {
  return raw
    .split('<br>')
    .map(l => l.trim())
    .filter(l => l.length > 0)
    .map(l => l.split('|'))
}

function parseCsv(raw: string, expectedCols: number): string[][] {
  return raw
    .split('<br>')
    .map(l => l.trim())
    .filter(l => l.length > 0)
    .map(line => {
      const parts = line.split(',')
      if (parts.length <= expectedCols) return parts
      // Último campo (OBSERVACAO) pode conter vírgulas — une o excesso
      return [
        ...parts.slice(0, expectedCols - 1),
        parts.slice(expectedCols - 1).join(','),
      ]
    })
}

export class SonaxClient {
  constructor(
    private readonly idCliente: string,
    private readonly token: string,
  ) {}

  async request(
    acao: string,
    params: Record<string, string> = {},
  ): Promise<string> {
    const response = await axios.get(BASE_URL, {
      params: {
        acao,
        id_cliente: this.idCliente,
        token: this.token,
        ...params,
      },
      responseType: 'arraybuffer',
      timeout: 30000,
    })

    const raw = decodeBuffer(Buffer.from(response.data as ArrayBuffer)).trim()

    if (raw === NOT_FOUND_BODY) {
      throw new Error(NOT_FOUND_BODY)
    }

    return raw
  }

  async check(): Promise<void> {
    try {
      await this.request('lista_campanha', { id_campanha: 'todas' })
    } catch (err) {
      // body '404 not found' com HTTP 200 = credenciais válidas mas sem dados
      // só rejeita em erro HTTP (AxiosError capturado pelo controller)
      if (err instanceof Error && err.message === NOT_FOUND_BODY) return
      throw err
    }
  }

  parsePipe(raw: string): string[][] {
    return parsePipe(raw)
  }

  parseCsv(raw: string, expectedCols: number): string[][] {
    return parseCsv(raw, expectedCols)
  }
}

export function parseSonaxCredentials(apiKey: string): {
  idCliente: string
  token: string
} {
  const parsed = JSON.parse(apiKey) as { id_cliente: string; token: string }
  return { idCliente: parsed.id_cliente, token: parsed.token }
}
