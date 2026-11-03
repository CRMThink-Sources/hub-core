import { describe, expect, it } from 'vitest'
import {
  resolveDeploymentApiError,
  resolveMessageEventsMessage,
} from './admin-deployment.helpers'
import pt from '@/messages/pt/admin/app-settings.json'
import en from '@/messages/en/admin/app-settings.json'
import es from '@/messages/es/admin/app-settings.json'

const t = (key: string) => key

describe('resolveMessageEventsMessage', () => {
  it('registro aplicado: mensagem de sucesso', () => {
    expect(resolveMessageEventsMessage('updated', t, 'messageEvents')).toBe(
      'messageEventsResultBound',
    )
    expect(resolveMessageEventsMessage('created', t, 'messageEvents')).toBe(
      'messageEventsResultBound',
    )
  })

  it('registro pulado: aviso, não sucesso liso', () => {
    expect(resolveMessageEventsMessage('skipped', t, 'messageEvents')).toBe(
      'messageEventsResultSkipped',
    )
  })
})

describe('erros da ação de religar eventos', () => {
  const err = (error: string) => ({ response: { data: { result: { error } } } })

  it('instalação inexistente e credencial ausente têm texto próprio', () => {
    expect(
      resolveDeploymentApiError(
        err('ThinkZap is not installed on this domain'),
        t,
        'messageEvents',
      ),
    ).toBe('messageEventsErrorNotInstalled')
    expect(
      resolveDeploymentApiError(
        err('Domain credential is missing'),
        t,
        'messageEvents',
      ),
    ).toBe('messageEventsErrorCredential')
    expect(resolveDeploymentApiError(new Error('x'), t, 'messageEvents')).toBe(
      'messageEventsErrorGeneric',
    )
  })
})

describe('textos da ação nos três idiomas', () => {
  it.each([
    ['pt', pt],
    ['en', en],
    ['es', es],
  ])('%s tem todas as chaves usadas pelo componente', (_lang, messages) => {
    const dict = messages as unknown as Record<string, string>
    for (const key of [
      'messageEventsTitle',
      'messageEventsDescription',
      'messageEventsBind',
      'messageEventsBinding',
      'messageEventsResultBound',
      'messageEventsResultSkipped',
      'messageEventsErrorNotInstalled',
      'messageEventsErrorCredential',
      'messageEventsErrorGeneric',
    ]) {
      expect(dict[key], key).toBeTruthy()
    }
  })
})
