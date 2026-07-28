import {
  makeErrorCatalog,
  type ErrorMeta,
} from '@/shared/domain/errors/error-catalog'

// Fonte única dos errorCode do thinkanalise. Via A (exceção HTTP) usa thinkanaliseError();
// via B/C (callback do BI / OAuth popup / fallback) usa logThinkanaliseError().
// Todo code aqui tem runbook em mcp/kb/runbooks/thinkanalise/** (cruzado por teste).
export const THINKANALISE_ERRORS = {
  // --- Suporte (N2 resolve com o parceiro) ---
  'thinkanalise.credentials.invalid': {
    category: 'auth',
    userCause:
      'A credencial (chave de API ou conta) do parceiro para o sistema externo é inválida ou expirou.',
    remediation:
      'Orientar o parceiro a conferir e atualizar a credencial nas Configurações do conector.',
    retriable: false,
    httpStatus: 400,
  },
  'thinkanalise.token.not_found': {
    category: 'auth',
    userCause:
      'Não há token de acesso salvo para essa conexão — a conta do provedor não está conectada.',
    remediation:
      'Orientar o parceiro a conectar a conta do provedor nas Configurações do conector.',
    retriable: false,
    httpStatus: 401,
  },
  'thinkanalise.token.refresh_failed': {
    category: 'integration',
    userCause:
      'A renovação automática do acesso ao provedor falhou; o acesso expirou ou foi revogado.',
    remediation:
      'Orientar o parceiro a reconectar a conta do provedor nas Configurações.',
    retriable: false,
    httpStatus: 401,
  },
  'thinkanalise.oauth.state_invalid_or_expired': {
    category: 'auth',
    userCause:
      'A janela de conexão com o provedor expirou ou foi reaberta antes de terminar, e a conexão não se completou.',
    remediation:
      'Refazer a conexão nas Configurações, concluindo o popup sem reabri-lo.',
    retriable: false,
    httpStatus: 400,
  },
  'thinkanalise.oauth.code_exchange_failed': {
    category: 'integration',
    userCause:
      'A troca do código de autorização pelo acesso falhou (código expirado ou já usado).',
    remediation: 'Refazer a conexão do provedor nas Configurações.',
    retriable: false,
    httpStatus: 400,
  },
  'thinkanalise.connector.app_not_found': {
    category: 'config',
    userCause:
      'O CRMThink não achou o app instalado no portal, então o conector não abre nem salva.',
    remediation: 'Confirmar que o app está instalado no portal.',
    retriable: false,
    httpStatus: 404,
  },
  'thinkanalise.provider.rate_limited': {
    category: 'integration',
    userCause:
      'O sistema externo limitou as requisições (rate limit) e não entregou os dados agora.',
    remediation:
      'Aguardar alguns minutos e tentar de novo; se recorrente, rever o plano contratado no ERP.',
    retriable: true,
    httpStatus: 429,
  },
  'thinkanalise.provider.blocked': {
    category: 'integration',
    userCause:
      'O sistema externo bloqueou o acesso do app (limite de consumo ou restrição do plano).',
    remediation:
      'Orientar o parceiro a verificar o consumo/plano da conta no ERP e liberar o acesso.',
    retriable: false,
    httpStatus: 502,
  },
  'thinkanalise.provider.data_fetch_failed': {
    category: 'integration',
    userCause:
      'O sistema externo recusou ou falhou ao entregar os dados pedidos pelo BI.',
    remediation:
      'Ler a mensagem no log; conferir se o módulo/escopo necessário está contratado no ERP.',
    retriable: false,
    httpStatus: 502,
  },
  'thinkanalise.provider.check_failed': {
    category: 'integration',
    userCause:
      'O teste de conexão com o sistema externo falhou por um erro do provedor (não credencial).',
    remediation:
      'Tentar de novo em instantes; se persistir, verificar o estado do sistema externo.',
    retriable: true,
    httpStatus: 502,
  },

  // --- Dev / observabilidade (emitidos, escalam pro dev) ---
  'thinkanalise.request.app_context_missing': {
    category: 'validation',
    userCause: 'Requisição autenticada sem contexto de app/domínio.',
    remediation: 'Falha de contexto — acionar a equipe de desenvolvimento.',
    retriable: false,
    httpStatus: 400,
  },
  'thinkanalise.bitrix.connector_write_failed': {
    category: 'integration',
    userCause:
      'Falha ao gravar o conector no Bitrix24 (biconnector.connector.*).',
    remediation:
      'Conferir as permissões do app no Bitrix24; acionar a equipe de desenvolvimento se persistir.',
    retriable: false,
    httpStatus: 502,
  },
  'thinkanalise.bitrix.no_connector_id': {
    category: 'integration',
    userCause: 'O Bitrix24 não retornou o id do conector ao criar.',
    remediation: 'Acionar a equipe de desenvolvimento.',
    retriable: false,
    httpStatus: 502,
  },
  'thinkanalise.bitrix.source_write_failed': {
    category: 'integration',
    userCause: 'Falha ao gravar o source no Bitrix24 (biconnector.source.*).',
    remediation:
      'Conferir as permissões do app no Bitrix24; acionar a equipe de desenvolvimento se persistir.',
    retriable: false,
    httpStatus: 502,
  },
  'thinkanalise.bitrix.dataset_write_failed': {
    category: 'integration',
    userCause: 'Falha ao gravar o dataset no Bitrix24 (biconnector.dataset.*).',
    remediation:
      'Conferir as permissões do app no Bitrix24; acionar a equipe de desenvolvimento se persistir.',
    retriable: false,
    httpStatus: 502,
  },
  'thinkanalise.connector.persist_failed': {
    category: 'internal',
    userCause: 'Falha ao persistir os dados do conector no banco.',
    remediation: 'Acionar a equipe de desenvolvimento.',
    retriable: false,
    httpStatus: 500,
  },
  'thinkanalise.oauth.conta_azul_not_configured': {
    category: 'config',
    userCause:
      'OAuth do Conta Azul sem clientId/authUrl no ambiente do servidor.',
    remediation: 'Acionar a equipe de desenvolvimento (config de ambiente).',
    retriable: false,
    httpStatus: 500,
  },
  'thinkanalise.oauth.bling_not_configured': {
    category: 'config',
    userCause: 'OAuth do Bling sem configuração no ambiente do servidor.',
    remediation: 'Acionar a equipe de desenvolvimento (config de ambiente).',
    retriable: false,
    httpStatus: 500,
  },
  'thinkanalise.oauth.params_invalid': {
    category: 'validation',
    userCause:
      'Parâmetros do início do OAuth inválidos (falta sourceId ou connectorId+title).',
    remediation: 'Falha de contrato — acionar a equipe de desenvolvimento.',
    retriable: false,
    httpStatus: 400,
  },
  'thinkanalise.oauth.callback_missing_params': {
    category: 'validation',
    userCause: 'Callback do OAuth chegou sem code/state.',
    remediation:
      'Refazer a conexão; se recorrente, acionar a equipe de desenvolvimento.',
    retriable: false,
    httpStatus: 400,
  },
  'thinkanalise.oauth.finalize_failed': {
    category: 'integration',
    userCause:
      'A conexão foi autorizada, mas falhou ao finalizar (salvar o token ou atualizar o source).',
    remediation:
      'Tentar reconectar; se persistir, acionar a equipe de desenvolvimento.',
    retriable: false,
    httpStatus: 500,
  },
  'thinkanalise.callback.connection_missing': {
    category: 'validation',
    userCause: 'O callback do BI chegou sem os dados de conexão necessários.',
    remediation: 'Acionar a equipe de desenvolvimento.',
    retriable: false,
    httpStatus: 400,
  },
  'thinkanalise.callback.provider_unsupported': {
    category: 'config',
    userCause: 'O provider informado no callback não é suportado.',
    remediation: 'Acionar a equipe de desenvolvimento.',
    retriable: false,
    httpStatus: 400,
  },
  'thinkanalise.callback.name_missing': {
    category: 'validation',
    userCause: 'O callback de descrição chegou sem o nome da tabela.',
    remediation: 'Acionar a equipe de desenvolvimento.',
    retriable: false,
    httpStatus: 400,
  },
  'thinkanalise.token.no_refresher': {
    category: 'config',
    userCause: 'Provider sem rotina de renovação de token configurada.',
    remediation: 'Acionar a equipe de desenvolvimento.',
    retriable: false,
    httpStatus: 500,
  },
  'thinkanalise.omie.capability_probe_failed': {
    category: 'integration',
    userCause:
      'O teste de módulos disponíveis do Omie falhou; usada a lista completa como fallback.',
    remediation: 'Observabilidade — nenhuma ação de suporte.',
    retriable: false,
  },
  'thinkanalise.sonax.campaigns_unavailable': {
    category: 'integration',
    userCause:
      'A lista de campanhas do Sonax ficou indisponível; retornou vazio.',
    remediation: 'Observabilidade — nenhuma ação de suporte.',
    retriable: false,
  },
  'thinkanalise.sonax.campaign_skipped': {
    category: 'integration',
    userCause: 'O download de uma campanha do Sonax falhou e ela foi pulada.',
    remediation: 'Observabilidade — nenhuma ação de suporte.',
    retriable: false,
  },
} as const satisfies Record<string, ErrorMeta>

export type ThinkanaliseErrorCode = keyof typeof THINKANALISE_ERRORS

const catalog = makeErrorCatalog(THINKANALISE_ERRORS)
// Via A: exceção que borbulha pro funil. Via B/C: desfecho não-exceção logado.
export const thinkanaliseError = catalog.appError
export const logThinkanaliseError = catalog.logError
