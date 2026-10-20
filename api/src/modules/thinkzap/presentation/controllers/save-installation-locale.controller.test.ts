import { describe, expect, it, vi } from 'vitest'

vi.mock('@/config/env', () => ({
  env: { logLevel: 'silent', nodeEnv: 'test', lokiUrl: '' },
}))

import { Request } from 'express'
import { SaveInstallationLocaleController } from './save-installation-locale.controller'

const req = (body: unknown) =>
  ({
    body,
    domainId: 'domain-1',
    appId: 'app-code-thinkzap',
  }) as unknown as Request

const makeSut = (saved = true) => {
  const save = vi.fn().mockResolvedValue(saved)
  const controller = new SaveInstallationLocaleController({
    save,
    byAppId: vi.fn(),
    byInstallation: vi.fn(),
  })
  return { controller, save }
}

describe('SaveInstallationLocaleController', () => {
  it('grava o idioma para a instalação do JWT', async () => {
    const { controller, save } = makeSut()

    const response = await controller.perform(req({ locale: 'en' }))

    expect(response.status).toBe(200)
    expect(response.result).toEqual({ locale: 'en' })
    expect(save).toHaveBeenCalledWith('domain-1', 'app-code-thinkzap', 'en')
  })

  it.each([{ locale: 'fr' }, {}, { locale: 'en', domainId: 'outro' }])(
    'recusa corpo %j sem gravar',
    async body => {
      const { controller, save } = makeSut()

      const response = await controller.perform(req(body))

      expect(response.status).toBe(400)
      expect(save).not.toHaveBeenCalled()
    },
  )

  it('instalação inexistente responde 404', async () => {
    const { controller } = makeSut(false)

    const response = await controller.perform(req({ locale: 'es' }))

    expect(response.status).toBe(404)
  })
})
