import { Request, Response } from 'express'
import { z } from 'zod'
import { AccessGroupNameTakenError } from '@/modules/thinkzap/domain/errors/access-group-name-taken.error'
import { AccessGroupNotFoundError } from '@/modules/thinkzap/domain/errors/access-group-not-found.error'
import type { AccessGroupRepository } from '@/modules/thinkzap/domain/repositories/access-group/access-group.repository'
import { httpResponse } from '@/shared/helpers/http'
import { Controller } from '@/shared/presentation/controller'

const groupBodySchema = z.object({
  name: z
    .string({ error: 'Informe o nome do grupo.' })
    .trim()
    .min(1, 'Informe o nome do grupo.')
    .max(191, 'O nome do grupo deve ter no máximo 191 caracteres.'),
  memberIds: z.array(z.string().min(1)).default([]),
  lineIds: z.array(z.string().min(1)).default([]),
})

/** Rotas de administração; o `requireThinkzapAdmin` já barrou quem não administra. */
abstract class AccessGroupAdminController extends Controller {
  protected appIdOf(req: Request): string | undefined {
    return req.thinkzapInstalledAppId
  }
}

export class ListAccessGroupsController extends AccessGroupAdminController {
  constructor(private readonly groups: Pick<AccessGroupRepository, 'list'>) {
    super()
  }

  async perform(req: Request, _res: Response): Promise<httpResponse> {
    const appId = this.appIdOf(req)
    if (!appId) return this.badRequest(new Error('App context not found'))
    return this.ok({ groups: await this.groups.list(appId) })
  }
}

export class CreateAccessGroupController extends AccessGroupAdminController {
  constructor(private readonly groups: Pick<AccessGroupRepository, 'create'>) {
    super()
  }

  async perform(req: Request, _res: Response): Promise<httpResponse> {
    const appId = this.appIdOf(req)
    if (!appId) return this.badRequest(new Error('App context not found'))

    const parsed = groupBodySchema.safeParse(req.body)
    if (!parsed.success) {
      return this.badRequest(
        new Error(parsed.error.issues[0]?.message ?? 'Dados inválidos.'),
      )
    }

    try {
      return this.ok({ group: await this.groups.create(appId, parsed.data) })
    } catch (error) {
      if (error instanceof AccessGroupNameTakenError) {
        return this.conflict(error)
      }
      throw error
    }
  }
}

export class UpdateAccessGroupController extends AccessGroupAdminController {
  constructor(private readonly groups: Pick<AccessGroupRepository, 'update'>) {
    super()
  }

  async perform(req: Request, _res: Response): Promise<httpResponse> {
    const appId = this.appIdOf(req)
    if (!appId) return this.badRequest(new Error('App context not found'))

    const parsed = groupBodySchema.safeParse(req.body)
    if (!parsed.success) {
      return this.badRequest(
        new Error(parsed.error.issues[0]?.message ?? 'Dados inválidos.'),
      )
    }

    try {
      const group = await this.groups.update(
        appId,
        String(req.params.groupId),
        parsed.data,
      )
      return this.ok({ group })
    } catch (error) {
      if (error instanceof AccessGroupNameTakenError) {
        return this.conflict(error)
      }
      if (error instanceof AccessGroupNotFoundError) {
        return this.notFound(error)
      }
      throw error
    }
  }
}

export class RemoveAccessGroupController extends AccessGroupAdminController {
  constructor(private readonly groups: Pick<AccessGroupRepository, 'remove'>) {
    super()
  }

  async perform(req: Request, _res: Response): Promise<httpResponse> {
    const appId = this.appIdOf(req)
    if (!appId) return this.badRequest(new Error('App context not found'))

    const groupId = String(req.params.groupId)
    const removed = await this.groups.remove(appId, groupId)
    if (!removed) return this.notFound(new AccessGroupNotFoundError(groupId))
    return this.ok({ removed: true })
  }
}
