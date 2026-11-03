import { describe, expect, it, vi } from 'vitest'
import { BindMessageEventsAppController } from './bind-message-events-app-controller'
import { bindMessageEventsForApp } from '../../application/bind-message-events-for-app'
import {
  DomainCredentialMissingError,
  PortalAppNotFoundError,
  ThinkzapNotInstalledError,
} from '../../domain/errors/portal-domain.errors'

vi.mock('../../application/bind-message-events-for-app', () => ({
  bindMessageEventsForApp: vi.fn(),
}))

const call = () =>
  new BindMessageEventsAppController().perform(
    { params: { appId: 'app-1' } } as never,
    {} as never,
  )

describe('BindMessageEventsAppController', () => {
  it('200 com o resultado', async () => {
    vi.mocked(bindMessageEventsForApp).mockResolvedValue({
      connectorResult: 'updated',
    })

    const res = await call()

    expect(res.status).toBe(200)
    expect(res.result).toEqual({ connectorResult: 'updated' })
  })

  it('404 quando a aplicação não existe', async () => {
    vi.mocked(bindMessageEventsForApp).mockRejectedValue(
      new PortalAppNotFoundError(),
    )
    expect((await call()).status).toBe(404)
  })

  it('422 quando não é uma instalação do ThinkZap', async () => {
    vi.mocked(bindMessageEventsForApp).mockRejectedValue(
      new ThinkzapNotInstalledError(),
    )
    expect((await call()).status).toBe(422)
  })

  it('422 sem credencial utilizável', async () => {
    vi.mocked(bindMessageEventsForApp).mockRejectedValue(
      new DomainCredentialMissingError(),
    )
    expect((await call()).status).toBe(422)
  })
})
