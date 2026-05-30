import { describe, expect, it, vi } from 'vitest'
import { DeleteConversationWidgetAppController } from './delete-conversation-widget-app-controller'
import { deleteConversationWidgetForApp } from '../../application/delete-conversation-widget-for-app'
import { ThinkzapNotInstalledError } from '../../domain/errors/portal-domain.errors'

vi.mock('../../application/delete-conversation-widget-for-app', () => ({
  deleteConversationWidgetForApp: vi.fn(),
}))

describe('DeleteConversationWidgetAppController', () => {
  const controller = new DeleteConversationWidgetAppController()

  it('returns 200 with result', async () => {
    vi.mocked(deleteConversationWidgetForApp).mockResolvedValue({
      result: 'deleted',
    })

    const response = await controller.perform(
      { params: { appId: 'app-1' } } as never,
      {} as never,
    )

    expect(response.status).toBe(200)
    expect(response.result).toEqual({ result: 'deleted' })
  })

  it('returns 422 when thinkzap is not installed', async () => {
    vi.mocked(deleteConversationWidgetForApp).mockRejectedValue(
      new ThinkzapNotInstalledError(),
    )

    const response = await controller.perform(
      { params: { appId: 'app-1' } } as never,
      {} as never,
    )

    expect(response.status).toBe(422)
  })
})
