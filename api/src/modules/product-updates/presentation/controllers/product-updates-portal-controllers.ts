import { Request } from 'express'
import { httpResponse } from '@/shared/helpers/http'
import { apiLogger } from '@/shared/infra/logger'
import { Controller } from '@/shared/presentation/controller'
import type { ProductUpdate } from '../../domain/entities/product-update'
import { isProductUpdateSituation } from '../../domain/entities/product-update'
import type { ProductUpdateActionInput } from '../../application/helpers/product-update-actions'
import {
  ProductUpdateImageUrlResolver,
  toProductUpdateView,
} from '../../application/product-update-view'
import type { CompleteProductUpdate } from '../../application/complete-product-update'
import type { CreateCrmthinkTaskForUpdate } from '../../application/create-crmthink-task-for-update'
import type { CreateProductUpdate } from '../../application/create-product-update'
import type { DeleteProductUpdate } from '../../application/delete-product-update'
import type { ListCrmthinkTaskMessages } from '../../application/list-crmthink-task-messages'
import type { SendCrmthinkTaskMessage } from '../../application/send-crmthink-task-message'
import type { LinkCrmthinkTask } from '../../application/link-crmthink-task'
import type { ListProductUpdates } from '../../application/list-product-updates'
import type { SearchCrmthinkTasks } from '../../application/search-crmthink-tasks'
import type { SearchCrmthinkUsers } from '../../application/search-crmthink-users'
import type { UpdateProductUpdateContent } from '../../application/update-product-update-content'
import type { UploadProductUpdateImage } from '../../application/upload-product-update-image'
import { mapProductUpdateError } from '../map-product-update-error'

/** Quem age: a sessão do portal. O middleware garante; sem ela, `401`. */
type Actor = { portalUserId: string }

type Body = Record<string, unknown>

const bodyOf = (req: Request): Body =>
  req.body && typeof req.body === 'object' ? (req.body as Body) : {}

/** Inteiro positivo vindo do JSON (número ou string numérica); senão `null`. */
const positiveInt = (value: unknown): number | null => {
  const number =
    typeof value === 'number'
      ? value
      : typeof value === 'string' && /^\d+$/.test(value.trim())
        ? Number(value)
        : NaN
  return Number.isInteger(number) && number > 0 ? number : null
}

const queryTerm = (req: Request): string =>
  typeof req.query.q === 'string' ? req.query.q : ''

/**
 * Base das rotas de novidades do backoffice (`/api/portal/novidades`): exige a
 * sessão do portal e traduz os erros do módulo (`mapProductUpdateError`). Erro fora
 * da família segue para o `handle` (500).
 */
abstract class ProductUpdatePortalController extends Controller {
  protected abstract run(req: Request, actor: Actor): Promise<httpResponse>

  async perform(req: Request): Promise<httpResponse> {
    const portalUserId = req.portalUserId
    if (!portalUserId) {
      return this.unauthorized(new Error('Sessão do portal ausente'))
    }

    try {
      return await this.run(req, { portalUserId })
    } catch (error) {
      const mapped = mapProductUpdateError(error)
      if (!mapped) throw error
      if (mapped.status >= 500) {
        apiLogger.warn(
          { err: error, app: 'product-updates', status: mapped.status },
          'Ação em novidade indisponível',
        )
      }
      return mapped
    }
  }

  protected actionInput(req: Request, actor: Actor): ProductUpdateActionInput {
    return { id: String(req.params.id), portalUserId: actor.portalUserId }
  }
}

/** `GET /` — lista, com `?situation=draft|soon|awaiting-review|available`. */
export class ListProductUpdatesController extends ProductUpdatePortalController {
  constructor(private readonly list: Pick<ListProductUpdates, 'execute'>) {
    super()
  }

  protected async run(req: Request): Promise<httpResponse> {
    const { situation } = req.query
    if (situation === undefined || situation === '') {
      return this.ok(await this.list.execute())
    }
    if (!isProductUpdateSituation(situation)) {
      return this.badRequest(new Error('Situação inválida'))
    }
    return this.ok(await this.list.execute({ situation }))
  }
}

/**
 * Ações que recebem só a novidade e quem age e devolvem a novidade: detalhe,
 * publicar, publicar como disponível, publicar/descartar alterações, despublicar,
 * reabrir, remover imagem e desvincular tarefa. A resposta é sempre a view.
 */
export class ProductUpdateActionController extends ProductUpdatePortalController {
  constructor(
    private readonly action: (
      input: ProductUpdateActionInput,
    ) => Promise<ProductUpdate>,
    private readonly imageUrl: ProductUpdateImageUrlResolver,
  ) {
    super()
  }

  protected async run(req: Request, actor: Actor): Promise<httpResponse> {
    const update = await this.action(this.actionInput(req, actor))
    return this.ok(toProductUpdateView(update, this.imageUrl))
  }
}

/** `POST /` — body `{ texts? }`; nasce rascunho. */
export class CreateProductUpdateController extends ProductUpdatePortalController {
  constructor(
    private readonly create: Pick<CreateProductUpdate, 'execute'>,
    private readonly imageUrl: ProductUpdateImageUrlResolver,
  ) {
    super()
  }

  protected async run(req: Request, actor: Actor): Promise<httpResponse> {
    const update = await this.create.execute({
      portalUserId: actor.portalUserId,
      texts: bodyOf(req).texts,
    })
    return this.ok(toProductUpdateView(update, this.imageUrl))
  }
}

/** `PATCH /:id` — body `{ texts }`, os três idiomas substituídos por inteiro. */
export class UpdateProductUpdateContentController extends ProductUpdatePortalController {
  constructor(
    private readonly updateContent: Pick<UpdateProductUpdateContent, 'execute'>,
    private readonly imageUrl: ProductUpdateImageUrlResolver,
  ) {
    super()
  }

  protected async run(req: Request, actor: Actor): Promise<httpResponse> {
    const update = await this.updateContent.execute({
      ...this.actionInput(req, actor),
      texts: bodyOf(req).texts,
    })
    return this.ok(toProductUpdateView(update, this.imageUrl))
  }
}

/** `DELETE /:id` — só rascunho nunca publicado. */
export class DeleteProductUpdateController extends ProductUpdatePortalController {
  constructor(private readonly remove: Pick<DeleteProductUpdate, 'execute'>) {
    super()
  }

  protected async run(req: Request, actor: Actor): Promise<httpResponse> {
    const input = this.actionInput(req, actor)
    await this.remove.execute(input)
    return this.ok({ id: input.id })
  }
}

/** `PUT /:id/image` — multipart, arquivo no campo `image` (multer antes). */
export class UploadProductUpdateImageController extends ProductUpdatePortalController {
  constructor(
    private readonly upload: Pick<UploadProductUpdateImage, 'execute'>,
    private readonly imageUrl: ProductUpdateImageUrlResolver,
  ) {
    super()
  }

  protected async run(req: Request, actor: Actor): Promise<httpResponse> {
    const update = await this.upload.execute({
      ...this.actionInput(req, actor),
      data: req.file?.buffer,
    })
    return this.ok(toProductUpdateView(update, this.imageUrl))
  }
}

/** `POST /:id/complete` — `{ update, awaitingApproval }`. */
export class CompleteProductUpdateController extends ProductUpdatePortalController {
  constructor(
    private readonly complete: Pick<CompleteProductUpdate, 'execute'>,
    private readonly imageUrl: ProductUpdateImageUrlResolver,
  ) {
    super()
  }

  protected async run(req: Request, actor: Actor): Promise<httpResponse> {
    const { update, awaitingApproval } = await this.complete.execute(
      this.actionInput(req, actor),
    )
    return this.ok({
      update: toProductUpdateView(update, this.imageUrl),
      awaitingApproval,
    })
  }
}

/** `PUT /:id/task` — body `{ taskId }`. */
export class LinkCrmthinkTaskController extends ProductUpdatePortalController {
  constructor(
    private readonly link: Pick<LinkCrmthinkTask, 'execute'>,
    private readonly imageUrl: ProductUpdateImageUrlResolver,
  ) {
    super()
  }

  protected async run(req: Request, actor: Actor): Promise<httpResponse> {
    const taskId = positiveInt(bodyOf(req).taskId)
    if (taskId === null) {
      return this.badRequest(new Error('Informe o ID da tarefa'))
    }
    const update = await this.link.execute({
      ...this.actionInput(req, actor),
      taskId,
    })
    return this.ok(toProductUpdateView(update, this.imageUrl))
  }
}

/**
 * `POST /:id/task` — body `{ responsibleId }`. Responsável ausente ou inválido segue
 * como `null` para o caso de uso, que recusa com `422 responsible-required`.
 */
export class CreateCrmthinkTaskForUpdateController extends ProductUpdatePortalController {
  constructor(
    private readonly createTask: Pick<CreateCrmthinkTaskForUpdate, 'execute'>,
    private readonly imageUrl: ProductUpdateImageUrlResolver,
  ) {
    super()
  }

  protected async run(req: Request, actor: Actor): Promise<httpResponse> {
    const update = await this.createTask.execute({
      ...this.actionInput(req, actor),
      responsibleId: positiveInt(bodyOf(req).responsibleId),
    })
    return this.ok(toProductUpdateView(update, this.imageUrl))
  }
}

/** `GET /bitrix/tasks?q=` — `{ items }`. */
export class SearchCrmthinkTasksController extends ProductUpdatePortalController {
  constructor(private readonly search: Pick<SearchCrmthinkTasks, 'execute'>) {
    super()
  }

  protected async run(req: Request): Promise<httpResponse> {
    return this.ok({ items: await this.search.execute(queryTerm(req)) })
  }
}

/** `GET /bitrix/users?q=` — `{ items }`. */
export class SearchCrmthinkUsersController extends ProductUpdatePortalController {
  constructor(private readonly search: Pick<SearchCrmthinkUsers, 'execute'>) {
    super()
  }

  protected async run(req: Request): Promise<httpResponse> {
    return this.ok({ items: await this.search.execute(queryTerm(req)) })
  }
}

/** `GET /:id/task/messages` — `{ mode, messages }`. */
export class ListCrmthinkTaskMessagesController extends ProductUpdatePortalController {
  constructor(
    private readonly list: Pick<ListCrmthinkTaskMessages, 'execute'>,
  ) {
    super()
  }

  protected async run(req: Request, actor: Actor): Promise<httpResponse> {
    return this.ok(await this.list.execute(this.actionInput(req, actor)))
  }
}

/**
 * `POST /:id/task/messages` — body `{ text }`, resposta `{ sent: true }`. Texto
 * ausente ou que não é string segue como está para o caso de uso, que recusa com
 * `422 invalid-message` (mesmo critério do `responsibleId`).
 */
export class SendCrmthinkTaskMessageController extends ProductUpdatePortalController {
  constructor(private readonly send: Pick<SendCrmthinkTaskMessage, 'execute'>) {
    super()
  }

  protected async run(req: Request, actor: Actor): Promise<httpResponse> {
    await this.send.execute({
      ...this.actionInput(req, actor),
      text: bodyOf(req).text,
    })
    return this.ok({ sent: true })
  }
}
