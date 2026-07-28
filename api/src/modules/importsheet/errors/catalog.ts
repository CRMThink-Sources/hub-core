import {
  makeErrorCatalog,
  type ErrorMeta,
} from '@/shared/domain/errors/error-catalog'

// Fonte única dos errorCode do importsheet. Via A (exceção HTTP/worker) usa
// importsheetError(); via B/C usa logImportsheetError(). httpStatus só importa na via A.
// Todo code aqui tem runbook em mcp/kb/runbooks/importsheet/** (cruzado por teste).
export const IMPORTSHEET_ERRORS = {
  'importsheet.run.fatal': {
    category: 'internal',
    userCause:
      'A importação parou no meio por um erro que interrompeu a execução; se era agendada, foi pausada.',
    remediation:
      'Ler a mensagem do erro fatal e seguir o runbook da causa apontada (planilha/aba/conexão) ou escalar se for técnica.',
    retriable: false,
  },
  'importsheet.run.paused': {
    category: 'validation',
    userCause:
      'Tentaram rodar manualmente uma importação agendada que está pausada.',
    remediation: 'Reativar a importação antes de rodar.',
    retriable: false,
  },

  // --- Via C: pulo por-linha silencioso (1 warn agregada por code/página) ---
  'importsheet.import.status_no_match': {
    category: 'validation',
    userCause:
      'O valor da célula não existe na lista daquele campo no Bitrix24, então o campo ficou em branco.',
    remediation:
      'Igualar o texto da planilha à opção exata do campo (acentos/maiúsculas/espaços); se faltar, criar a opção. Depois reprocessar.',
    retriable: false,
  },
  'importsheet.import.enum_no_match': {
    category: 'validation',
    userCause:
      'O valor da célula não bate com nenhuma opção do campo de seleção no Bitrix24, então o campo ficou em branco.',
    remediation:
      'Igualar o texto da planilha à opção exata do campo de seleção; se faltar, criar a opção. Depois reprocessar.',
    retriable: false,
  },
  'importsheet.import.ambiguous_match': {
    category: 'validation',
    userCause:
      'O identificador da linha bateu com mais de um registro no Bitrix24 e a linha não foi importada.',
    remediation:
      'Ajustar o identificador para um valor único ou tratar os registros duplicados no Bitrix24. Depois reprocessar.',
    retriable: false,
  },
  'importsheet.import.responsible_unresolved': {
    category: 'validation',
    userCause:
      'Não foi possível identificar o responsável indicado na linha, então a importação usou o responsável padrão.',
    remediation:
      'Conferir se o responsável da planilha bate com um usuário do Bitrix24 (nome/e-mail/id).',
    retriable: false,
  },

  // --- Planilha/aba (via A ao configurar; via B no meio da run) ---
  'importsheet.sheet.not_found_or_forbidden': {
    category: 'integration',
    userCause:
      'A planilha não foi encontrada ou a conta Google conectada não tem acesso a ela.',
    remediation:
      'Conferir o link/ID da planilha e compartilhá-la com a conta Google conectada.',
    retriable: false,
    httpStatus: 404,
  },
  'importsheet.sheet.tab_deleted': {
    category: 'integration',
    userCause:
      'A aba (guia) escolhida na configuração não existe mais na planilha.',
    remediation:
      'Selecionar de novo a aba correta na configuração da importação.',
    retriable: false,
    httpStatus: 404,
  },
  'importsheet.sheet.inaccessible': {
    category: 'integration',
    userCause:
      'No meio da importação a planilha ou a aba ficou inacessível para a conta Google conectada.',
    remediation:
      'Conferir se a planilha/aba ainda existe e segue compartilhada com a conta Google; depois rodar de novo.',
    retriable: false,
    httpStatus: 502,
  },
  'importsheet.sheet.range_invalid': {
    category: 'validation',
    userCause:
      'O Google recusou a aba pedida na importação por ela ser inválida.',
    remediation:
      'Selecionar de novo a aba correta na configuração da importação.',
    retriable: false,
    httpStatus: 400,
  },
  'importsheet.sheet.header_empty': {
    category: 'validation',
    userCause:
      'A linha de cabeçalho indicada na planilha está vazia, então não há colunas para mapear.',
    remediation:
      'Preencher a linha de cabeçalho na planilha ou ajustar a linha de cabeçalho na configuração.',
    retriable: false,
    httpStatus: 400,
  },

  // --- OAuth Google (via A no callback) ---
  'importsheet.oauth.state_invalid_or_expired': {
    category: 'auth',
    userCause:
      'A janela de conexão com o Google expirou ou foi reaberta antes de terminar, e a conexão não se completou.',
    remediation:
      'Refazer a conexão do Google nas Configurações, concluindo o popup sem reabri-lo.',
    retriable: false,
    httpStatus: 400,
  },
  'importsheet.oauth.callback_failed': {
    category: 'integration',
    userCause: 'Exceção genérica ao processar o callback do OAuth.',
    remediation:
      'Ler o erro no log; se persistir na reconexão, acionar a equipe de desenvolvimento.',
    retriable: false,
    httpStatus: 500,
  },

  // --- Guards de execução (via A, 409) ---
  'importsheet.run.in_flight': {
    category: 'validation',
    userCause:
      'A importação já está na fila ou em execução; não dá para iniciar outra rodada agora.',
    remediation: 'Aguardar a rodada atual terminar antes de rodar de novo.',
    retriable: false,
    httpStatus: 409,
  },
  'importsheet.reprocess.in_flight': {
    category: 'validation',
    userCause:
      'Tentaram reprocessar linhas enquanto a importação ainda estava em execução.',
    remediation: 'Aguardar a importação terminar antes de reprocessar.',
    retriable: false,
    httpStatus: 409,
  },

  // --- Bitrix meta (via A ao montar a importação) ---
  'importsheet.bitrix.field_meta_error': {
    category: 'integration',
    userCause:
      'O CRMThink não conseguiu carregar do Bitrix24 os campos, entidades, categorias ou usuários.',
    remediation:
      'Conferir as permissões do app no Bitrix24 e recarregar a tela de configuração.',
    retriable: true,
    httpStatus: 502,
  },

  // --- Validações de configuração da importação (via A, 400) ---
  'importsheet.import.mapping_empty': {
    category: 'validation',
    userCause:
      'A importação foi salva ou executada sem nenhuma coluna ligada a um campo do Bitrix24.',
    remediation:
      'Mapear ao menos uma coluna da planilha para um campo do Bitrix24.',
    retriable: false,
    httpStatus: 400,
  },
  'importsheet.import.entity_type_required': {
    category: 'validation',
    userCause:
      'Falta escolher o tipo de entidade de destino da importação no Bitrix24.',
    remediation:
      'Selecionar a entidade de destino (lead, negócio, contato, etc.).',
    retriable: false,
    httpStatus: 400,
  },
  'importsheet.import.column_mapped_twice': {
    category: 'validation',
    userCause: 'A mesma coluna da planilha foi mapeada duas vezes no de-para.',
    remediation: 'Deixar cada coluna da planilha mapeada uma única vez.',
    retriable: false,
    httpStatus: 400,
  },
  'importsheet.import.field_mapped_twice': {
    category: 'validation',
    userCause:
      'O mesmo campo do Bitrix24 está recebendo duas colunas diferentes da planilha.',
    remediation: 'Deixar cada campo do Bitrix24 ligado a uma única coluna.',
    retriable: false,
    httpStatus: 400,
  },
  'importsheet.import.column_mapped_and_excluded': {
    category: 'validation',
    userCause:
      'Uma coluna da planilha está ao mesmo tempo mapeada para um campo e marcada como excluída.',
    remediation:
      'Decidir por coluna: mapear para um campo OU excluir, não os dois.',
    retriable: false,
    httpStatus: 400,
  },
  'importsheet.import.responsible_column_excluded': {
    category: 'validation',
    userCause:
      'A coluna escolhida como responsável está marcada como excluída, o que gera conflito.',
    remediation:
      'Não excluir a coluna usada como responsável, ou escolher outra.',
    retriable: false,
    httpStatus: 400,
  },
} as const satisfies Record<string, ErrorMeta>

export type ImportsheetErrorCode = keyof typeof IMPORTSHEET_ERRORS

// Codes emitidos via subclasse de AppError (metadados na subclasse). Só pro cruzamento.
export const IMPORTSHEET_THROWN_CODES = [
  'importsheet.google.auth_required',
  'importsheet.google.unavailable',
] as const

const catalog = makeErrorCatalog(IMPORTSHEET_ERRORS)
// Via A: exceção que borbulha pro funil. Via B/C: desfecho não-exceção logado
// (via B fatal passa {level:'error', msg} com a mensagem real; via C usa userCause).
export const importsheetError = catalog.appError
export const logImportsheetError = catalog.logError
