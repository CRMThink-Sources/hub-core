import type { Request, Response } from 'express'
import { describe, expect, it } from 'vitest'
import { GetThinkbotConnectorStatusController } from './get-thinkbot-connector-status.controller'

const req = {} as Request
const res = {} as Response

describe('GetThinkbotConnectorStatusController', () => {
  it('devolve ativo com conector', async () => {
    const out = await new GetThinkbotConnectorStatusController(() =>
      Promise.resolve(true),
    ).perform(req, res)

    expect(out).toMatchObject({ status: 200, result: { active: true } })
  })

  it('devolve inativo sem conector', async () => {
    const out = await new GetThinkbotConnectorStatusController(() =>
      Promise.resolve(false),
    ).perform(req, res)

    expect(out).toMatchObject({ status: 200, result: { active: false } })
  })
})
