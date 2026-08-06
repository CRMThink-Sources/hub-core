import { describe, expect, it } from 'vitest'
import { extractLineBlocked } from './extract-line-blocked'

/** Erro do axios como o `axiosThinkzap` o rejeita: cru, com `response` intacto. */
const axiosError = (status: number, result: unknown) => ({
  response: { status, data: { result, traceId: 't-1', time: 3 } },
  message: 'Request failed with status code ' + String(status),
})

describe('extractLineBlocked', () => {
  it('reconhece trial vencido', () => {
    const err = axiosError(402, {
      error: 'Linha "i1" está com o período de teste encerrado',
      code: 'line-blocked',
      entitlement: 'trial-expired',
    })

    expect(extractLineBlocked(err)).toBe('trial-expired')
  })

  it('reconhece assinatura inativa', () => {
    const err = axiosError(402, {
      error: 'Linha "i1" não tem assinatura ativa',
      code: 'line-blocked',
      entitlement: 'inactive',
    })

    expect(extractLineBlocked(err)).toBe('inactive')
  })

  /**
   * O ponto inteiro deste helper: `403` é falta de permissão, `402` é linha sem
   * direito. Tratar os dois igual manda o cliente falar com o administrador quando o
   * que ele precisa é contratar.
   */
  it('NÃO reconhece 403 de falta de permissão', () => {
    const err = axiosError(403, { error: 'Sem permissão para esta ação' })

    expect(extractLineBlocked(err)).toBeNull()
  })

  it('não reconhece 404 de linha inexistente', () => {
    const err = axiosError(404, { error: 'Linha "i9" não encontrada' })

    expect(extractLineBlocked(err)).toBeNull()
  })

  it('não reconhece 502 de upstream fora', () => {
    const err = axiosError(502, {
      error: 'Falha ao salvar os ajustes da linha',
    })

    expect(extractLineBlocked(err)).toBeNull()
  })

  /**
   * A discriminação é pelo `code`, e um `402` que não o traga não é este caso — a
   * mensagem é interpolada com o id do item, então comparar texto nunca casaria.
   */
  it('exige o code, não só o status', () => {
    const err = axiosError(402, { error: 'Pagamento necessário' })

    expect(extractLineBlocked(err)).toBeNull()
  })

  it('degrada entitlement desconhecido para inactive, sem virar erro genérico', () => {
    const err = axiosError(402, {
      error: 'Linha bloqueada',
      code: 'line-blocked',
      entitlement: 'algo-novo',
    })

    expect(extractLineBlocked(err)).toBe('inactive')
  })

  it.each([
    ['undefined', undefined],
    ['null', null],
    ['Error comum', new Error('Network error')],
    ['objeto sem response', { message: 'boom' }],
    ['response sem data', { response: { status: 402 } }],
  ])('devolve null para %s', (_label, err) => {
    expect(extractLineBlocked(err)).toBeNull()
  })
})
