import type { ProductUpdateLocale } from '../entities/product-update-content'

/** `404`. */
export class ProductUpdateNotFoundError extends Error {
  constructor() {
    super('Novidade não encontrada')
    this.name = 'ProductUpdateNotFoundError'
  }
}

/**
 * `422`: o corpo não é um conteúdo de novidade válido (tipo errado, texto longo
 * demais). `issues` vai para o operador como está.
 */
export class InvalidProductUpdateContentError extends Error {
  constructor(readonly issues: string[]) {
    super(`Conteúdo da novidade inválido: ${issues.join('; ')}`)
    this.name = 'InvalidProductUpdateContentError'
  }
}

/**
 * `422`: publicar (em breve, como disponível ou as alterações) exige título e
 * descrição nos três idiomas. `missingLocales` diz quais faltam — a tela marca as abas.
 */
export class ProductUpdateIncompleteError extends Error {
  readonly reason = 'missing-locales'

  constructor(readonly missingLocales: ProductUpdateLocale[]) {
    super(`Idiomas incompletos: ${missingLocales.join(', ')}`)
    this.name = 'ProductUpdateIncompleteError'
  }
}

export type ProductUpdateActionRefusal =
  /** Publicar (em breve) uma novidade já publicada. */
  | 'already-published'
  /**
   * Publicar (em breve) um rascunho que já foi disponível: com `availableAt`
   * preenchido ele voltaria direto em "Já disponível". O caminho é "Publicar como
   * disponível", que mantém a data original.
   */
  | 'previously-available'
  /** Publicar como disponível sem a novidade estar concluída. */
  | 'not-done'
  | 'already-available'
  /** Publicar/descartar alterações ou despublicar um rascunho. */
  | 'not-published'
  | 'no-pending-changes'
  /** Excluir uma novidade que já foi publicada alguma vez. */
  | 'published-before'

/** `409` com o motivo: a ação não cabe na situação atual, e nada foi gravado. */
export class ProductUpdateActionRefusedError extends Error {
  constructor(readonly reason: ProductUpdateActionRefusal) {
    super(`Ação na novidade recusada: ${reason}`)
    this.name = 'ProductUpdateActionRefusedError'
  }
}

/**
 * `409`: a tarefa já está vinculada a outra novidade (índice único de
 * `bitrix_task_id`). `productUpdateId` é a dona, quando foi possível descobrir.
 */
export class TaskAlreadyLinkedError extends Error {
  readonly reason = 'task-already-linked'

  constructor(
    readonly taskId: number,
    readonly productUpdateId: string | null,
  ) {
    super(`A tarefa ${taskId} já está vinculada a outra novidade`)
    this.name = 'TaskAlreadyLinkedError'
  }
}

/** `422`: arquivo que não é PNG/JPEG ou passa de 5 MB. Nada é gravado. */
export class InvalidProductUpdateImageError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'InvalidProductUpdateImageError'
  }
}

/** `503`: R2 não configurado ou fora do ar. O resto da novidade segue funcionando. */
export class ProductUpdateImageStorageUnavailableError extends Error {
  constructor(readonly detail?: string) {
    super('O envio de imagem está indisponível no momento')
    this.name = 'ProductUpdateImageStorageUnavailableError'
  }
}
