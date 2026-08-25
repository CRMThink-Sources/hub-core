import {
  makeErrorCatalog,
  type ErrorMeta,
} from '@/shared/domain/errors/error-catalog'

// Fonte única dos errorCode do gptmaker. Via A (exceção que borbulha pro funil
// HTTP) usa gptmakerError(); via B/C (desfecho logado sem exceção) usa
// logGptmakerError(). Todo code aqui tem runbook em
// mcp/kb/runbooks/hubcore/gptmaker/<area>/<causa>.md (cruzado por teste).
// errorCode é contrato — estável, nunca renomear.
//
// Categorias: integration (terceiro falhou) · auth · validation (entrada ruim) ·
// internal (bug/estado nosso) · config (ambiente/instalação incompleta).
export const GPTMAKER_ERRORS = {
  // ── app: resolução da instalação na sessão ──
  'gptmaker.app.context_missing': {
    category: 'validation',
    userCause: 'Não foi possível identificar a instalação na sua sessão.',
    remediation:
      'Recarregar o app dentro do portal; se persistir, reinstalar o app e reabrir.',
    retriable: false,
    httpStatus: 400,
  },

  // ── config: credencial compartilhada do vendor ──
  'gptmaker.config.credentials_missing': {
    category: 'config',
    userCause: 'A integração com o GPT Maker não está configurada.',
    remediation:
      'Definir GPTMAKER_API_TOKEN e GPTMAKER_WORKSPACE_ID no ambiente da API e reiniciar.',
    retriable: false,
    httpStatus: 503,
  },

  // ── agent: ciclo de vida do agente no workspace compartilhado ──
  //
  // `not_found` cobre tanto agente inexistente quanto agente de OUTRA
  // instalação, de propósito: distinguir os dois na resposta confirmaria a
  // existência do agente alheio a quem não é dono dele.
  'gptmaker.agent.not_found': {
    category: 'validation',
    userCause: 'O agente não foi encontrado nesta instalação.',
    remediation:
      'Recarregar a lista de agentes; se o agente sumiu, ele foi excluído ou pertence a outra instalação.',
    retriable: false,
    httpStatus: 404,
  },
  'gptmaker.agent.limit_reached': {
    category: 'validation',
    userCause: 'Esta instalação já atingiu o limite de 5 agentes.',
    remediation:
      'Excluir um agente existente antes de criar outro. O limite vem do Bitrix (5 imbots por aplicação) e não muda por plano.',
    retriable: false,
    httpStatus: 409,
  },
  'gptmaker.agent.create_failed': {
    category: 'integration',
    userCause: 'O GPT Maker não conseguiu criar o agente.',
    remediation:
      'Tentar de novo em instantes; se persistir, verificar status e credenciais do GPT Maker.',
    retriable: true,
    httpStatus: 502,
  },
  'gptmaker.agent.update_failed': {
    category: 'integration',
    userCause: 'O GPT Maker não conseguiu salvar as alterações do agente.',
    remediation:
      'Tentar de novo em instantes; se persistir, verificar status do GPT Maker.',
    retriable: true,
    httpStatus: 502,
  },
  'gptmaker.agent.delete_failed': {
    category: 'integration',
    userCause: 'O GPT Maker não conseguiu excluir o agente.',
    remediation:
      'Tentar de novo em instantes. O agente segue listado até a exclusão concluir — isso é proposital, para ele não sumir da tela continuando vivo no workspace.',
    retriable: true,
    httpStatus: 502,
  },
  'gptmaker.agent.orphaned': {
    category: 'internal',
    userCause:
      'Um agente foi criado no workspace compartilhado e não pôde ser associado a nenhuma instalação.',
    remediation:
      'Rodar a reconciliação para localizar o agente órfão pelo id no log e removê-lo do workspace manualmente.',
    retriable: false,
  },

  // ── bot: imbot no portal do cliente ──
  'gptmaker.bot.limit_reached': {
    category: 'validation',
    userCause: 'Este portal já tem 5 bots desta aplicação.',
    remediation:
      'Remover um bot existente no portal antes de criar outro. O limite é do Bitrix.',
    retriable: false,
    httpStatus: 409,
  },
  'gptmaker.bot.already_bound': {
    category: 'validation',
    userCause: 'Este agente já tem um bot vinculado.',
    remediation:
      'Desvincular o bot atual antes de criar outro — a relação é de um bot por agente.',
    retriable: false,
    httpStatus: 409,
  },
  'gptmaker.bot.create_failed': {
    category: 'integration',
    userCause: 'O Bitrix não conseguiu criar o bot no portal.',
    remediation:
      'Tentar de novo; se persistir, conferir se o app tem escopo de imbot no portal.',
    retriable: true,
    httpStatus: 502,
  },
  'gptmaker.bot.delete_failed': {
    category: 'integration',
    userCause: 'O Bitrix não conseguiu remover o bot do portal.',
    remediation:
      'Tentar de novo; se persistir, remover o bot pelo painel do portal.',
    retriable: true,
    httpStatus: 502,
  },
} as const satisfies Record<string, ErrorMeta>

export type GptmakerErrorCode = keyof typeof GPTMAKER_ERRORS

const catalog = makeErrorCatalog(GPTMAKER_ERRORS)
// Via A: exceção que borbulha pro funil. Via B/C: desfecho não-exceção logado.
export const gptmakerError = catalog.appError
export const logGptmakerError = catalog.logError
