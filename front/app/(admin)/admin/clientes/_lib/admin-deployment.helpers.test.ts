import { describe, expect, it } from 'vitest'
import {
  resolveDeleteMessage,
  resolveDeploymentApiError,
  resolveListApiError,
  resolveRegisterMessage,
} from '@/components/layouts/admin/admin-deployment.helpers'

describe('admin deployment helpers', () => {
  const t = (key: string) => key

  it('resolves register messages', () => {
    expect(resolveRegisterMessage('created', t, 'imbot')).toBe(
      'imbotResultCreated',
    )
    expect(resolveRegisterMessage('updated', t, 'imbot')).toBe(
      'imbotResultUpdated',
    )
    expect(resolveRegisterMessage('skipped', t, 'imbot')).toBe(
      'imbotResultSkipped',
    )
  })

  it('resolves delete messages', () => {
    expect(resolveDeleteMessage('deleted', t, 'imbot')).toBe(
      'imbotResultDeleted',
    )
    expect(resolveDeleteMessage('not_found', t, 'imbot')).toBe(
      'imbotResultNotFound',
    )
  })

  it('resolves deployment api errors', () => {
    expect(
      resolveDeploymentApiError(
        { response: { data: { result: { error: 'ThinkZap not installed' } } } },
        t,
        'imbot',
      ),
    ).toBe('imbotErrorNotInstalled')

    expect(
      resolveDeploymentApiError(
        { response: { data: { result: { error: 'credential missing' } } } },
        t,
        'imbot',
      ),
    ).toBe('imbotErrorCredential')

    expect(resolveDeploymentApiError(new Error('fail'), t, 'imbot')).toBe(
      'imbotErrorGeneric',
    )
  })

  it('resolves list api errors', () => {
    expect(
      resolveListApiError(
        { response: { data: { error: 'certificate verify failed' } } },
        t,
        'placements',
      ),
    ).toBe('placementsErrorTls')

    expect(resolveListApiError(new Error('fail'), t, 'bizprocRobots')).toBe(
      'bizprocRobotsErrorGeneric',
    )
  })
})
