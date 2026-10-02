import {
  makeErrorCatalog,
  type ErrorMeta,
} from '@/shared/domain/errors/error-catalog'

// Todo code aqui precisa de runbook em mcp/kb/runbooks/importsheet/** (validado por teste).
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

  'importsheet.bitrix.field_meta_error': {
    category: 'integration',
    userCause:
      'O CRMThink não conseguiu carregar do Bitrix24 os campos, entidades, categorias ou usuários.',
    remediation:
      'Conferir as permissões do app no Bitrix24 e recarregar a tela de configuração.',
    retriable: true,
    httpStatus: 502,
  },

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
  'importsheet.reprocess.failed': {
    category: 'integration',
    userCause:
      'O reprocessamento das linhas com erro não pôde ser concluído; nenhuma linha foi alterada nesta tentativa.',
    remediation:
      'Tentar reprocessar de novo em instantes; se persistir, ler o erro do log (Bitrix24 recusou ou ficou fora) e acionar o suporte.',
    retriable: true,
  },
  'importsheet.settings.bitrix_error': {
    category: 'integration',
    userCause:
      'O Bitrix24 recusou ler ou salvar as configurações de notificação.',
    remediation:
      'Conferir as permissões do app no portal; ler a mensagem do Bitrix24 no log.',
    retriable: true,
  },
  'importsheet.bitrix.user_lookup_failed': {
    category: 'integration',
    userCause:
      'A busca do responsável da linha no Bitrix24 falhou, então a importação usou o responsável padrão.',
    remediation:
      'Se recorrente, conferir o escopo `user` do app; falha pontual se resolve na próxima execução.',
    retriable: true,
  },
  'importsheet.bitrix.currency_base_failed': {
    category: 'integration',
    userCause:
      'A leitura da moeda base do Bitrix24 falhou e os campos de dinheiro seguiram sem moeda.',
    remediation: 'Conferir a permissão/escopo de moeda do app no Bitrix24.',
    retriable: true,
  },
  'importsheet.bitrix.field_meta_cache_read_failed': {
    category: 'internal',
    userCause:
      'Falha ao ler os dados de campos guardados temporariamente; o app buscou direto no Bitrix24.',
    remediation: 'Nenhuma ação; se recorrente, verificar o Redis.',
    retriable: true,
  },
  'importsheet.bitrix.field_meta_cache_write_failed': {
    category: 'internal',
    userCause:
      'Falha ao guardar temporariamente os dados de campos; o app seguiu buscando direto no Bitrix24.',
    remediation: 'Nenhuma ação; se recorrente, verificar o Redis.',
    retriable: true,
  },
  'importsheet.import.page_marker_degraded': {
    category: 'internal',
    userCause:
      'Falha ao registrar o controle de progresso da importação; há risco de reprocessar a mesma parte da planilha.',
    remediation: 'Verificar a disponibilidade do Redis.',
    retriable: false,
  },
  'importsheet.import.reprocess_marker_degraded': {
    category: 'internal',
    userCause:
      'Falha ao registrar o controle do reprocessamento; há risco de repetir o mesmo trabalho.',
    remediation: 'Verificar a disponibilidade do Redis.',
    retriable: false,
  },
  'importsheet.run.lock_renew_failed': {
    category: 'internal',
    userCause:
      'A trava da importação não foi renovada durante a execução; se expirar, outra execução pode rodar em paralelo.',
    remediation:
      'Verificar a disponibilidade do Redis; se houver linhas duplicadas na janela do log, revisar o lote.',
    retriable: false,
  },
  'importsheet.run.continuation_enqueue_failed': {
    category: 'internal',
    userCause:
      'Falha ao reenfileirar a próxima página da importação; a rodada pode travar no meio.',
    remediation:
      'Verificar fila e Redis; a retomada automática de importações presas resolve em ~20min.',
    retriable: true,
  },
  'importsheet.run.stale_reclaimed': {
    category: 'internal',
    userCause:
      'Importação presa em "running" por muito tempo foi retomada automaticamente pelo cursor.',
    remediation:
      'Nenhuma ação; se recorrente, investigar por que o worker cai no meio da execução.',
    retriable: false,
  },
  'importsheet.notify.failed': {
    category: 'integration',
    userCause:
      'Falha ao notificar os usuários sobre erros da importação; a importação não foi interrompida.',
    remediation:
      'Conferir a configuração de notificação e os usuários alvo; os erros seguem visíveis na tela da importação.',
    retriable: false,
  },
} as const satisfies Record<string, ErrorMeta>

export type ImportsheetErrorCode = keyof typeof IMPORTSHEET_ERRORS

// Emitidos por subclasses de AppError; listados só pro cruzamento com os runbooks.
export const IMPORTSHEET_THROWN_CODES = [
  'importsheet.google.auth_required',
  'importsheet.google.unavailable',
] as const

const catalog = makeErrorCatalog(IMPORTSHEET_ERRORS)
export const importsheetError = catalog.appError
export const logImportsheetError = catalog.logError
