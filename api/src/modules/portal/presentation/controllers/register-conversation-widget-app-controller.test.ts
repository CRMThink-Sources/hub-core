import { describe, expect, it, vi } from 'vitest'
import { RegisterConversationWidgetAppController } from './register-conversation-widget-app-controller'
import { registerConversationWidgetForApp } from '../../application/register-conversation-widget-for-app'
import {
  DomainCredentialMissingError,
  ThinkzapNotInstalledError,
} from '../../domain/errors/portal-domain.errors'

vi.mock('../../application/register-conversation-widget-for-app', () => ({
  registerConversationWidgetForApp: vi.fn(),
}))

describe('RegisterConversationWidgetAppController', () => {
  const controller = new RegisterConversationWidgetAppController()

  it('returns 400 for invalid app id', async () => {
    const response = await controller.perform(
      { params: {} } as never,
      {} as never,
    )

    expect(response.status).toBe(400)
  })

  it('returns 200 with result', async () => {
    vi.mocked(registerConversationWidgetForApp).mockResolvedValue({
      result: 'created',
    })

    const response = await controller.perform(
      { params: { appId: 'app-1' } } as never,
      {} as never,
    )

    expect(response.status).toBe(200)
    expect(response.result).toEqual({ result: 'created' })
  })

  it('returns 422 when thinkzap is not installed', async () => {
    vi.mocked(registerConversationWidgetForApp).mockRejectedValue(
      new ThinkzapNotInstalledError(),
    )

    const response = await controller.perform(
      { params: { appId: 'app-1' } } as never,
      {} as never,
    )

    expect(response.status).toBe(422)
  })

  it('returns 422 when credential is missing', async () => {
    vi.mocked(registerConversationWidgetForApp).mockRejectedValue(
      new DomainCredentialMissingError(),
    )

    const response = await controller.perform(
      { params: { appId: 'app-1' } } as never,
      {} as never,
    )

    expect(response.status).toBe(422)
  })
})
