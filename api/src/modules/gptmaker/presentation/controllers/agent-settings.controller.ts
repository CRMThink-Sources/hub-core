import type { Request, Response } from 'express'
import { z } from 'zod'
import { httpResponse } from '@/shared/helpers/http'
import { Controller } from '@/shared/presentation/controller'
import { updateAgentProfile } from '@/modules/gptmaker/application/update-agent-profile'
import { updateAgentSettings } from '@/modules/gptmaker/application/update-agent-settings'
import {
  agentRepository,
  resolveAppId,
  scopeTo,
} from '@/modules/gptmaker/main/make-gptmaker-deps'

/** O `:agentId` da rota — id do agente no vendor, vindo do cliente. */
const agentIdSchema = z.string().min(1, 'Informe o agente')

const profileSchema = z.object({
  name: z.string().min(1).optional(),
  avatar: z.string().url().optional(),
  behavior: z.string().optional(),
  communicationType: z.enum(['FORMAL', 'NORMAL', 'RELAXED']).optional(),
  type: z.enum(['SUPPORT', 'SALE', 'PERSONAL']).optional(),
  jobName: z.string().optional(),
  jobSite: z.string().optional(),
  jobDescription: z.string().optional(),
})

const HOUR = /^([01]\d|2[0-3]):[0-5]\d$/

const settingsSchema = z.object({
  worktime: z
    .object({
      enabled: z.boolean(),
      initHour: z.string().regex(HOUR, 'Use o formato HH:mm').nullable(),
      endHour: z.string().regex(HOUR, 'Use o formato HH:mm').nullable(),
      activeDays: z.array(z.number().int().min(0).max(6)),
      /**
       * Identificador IANA. Validado contra o próprio `Intl` em vez de uma
       * lista nossa: a lista envelhece a cada mudança de regra de fuso, e o
       * runtime já sabe quais zonas conhece.
       */
      timezone: z
        .string()
        .refine(value => {
          try {
            new Intl.DateTimeFormat('en-US', { timeZone: value })
            return true
          } catch {
            return false
          }
        }, 'Fuso horário desconhecido')
        .nullable(),
      respondsOnlyOffHours: z.boolean(),
    })
    .optional(),
  exitOnCollaboratorJoin: z.boolean().optional(),
})

export class UpdateAgentProfileController extends Controller {
  async perform(req: Request, _res: Response): Promise<httpResponse> {
    const appId = await resolveAppId(req)
    const scoped = await scopeTo(appId, agentIdSchema.parse(req.params.agentId))
    const patch = profileSchema.parse(req.body)

    return this.ok(
      await updateAgentProfile({ agents: agentRepository }, scoped, patch),
    )
  }
}

export class UpdateAgentSettingsController extends Controller {
  async perform(req: Request, _res: Response): Promise<httpResponse> {
    const appId = await resolveAppId(req)
    const scoped = await scopeTo(appId, agentIdSchema.parse(req.params.agentId))
    const patch = settingsSchema.parse(req.body)

    return this.ok(
      await updateAgentSettings({ agents: agentRepository }, scoped, patch),
    )
  }
}
