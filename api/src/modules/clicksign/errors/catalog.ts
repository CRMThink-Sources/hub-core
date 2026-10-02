import {
  makeErrorCatalog,
  type ErrorMeta,
} from '@/shared/domain/errors/error-catalog'

// Todo code aqui precisa ter runbook (cruzado por teste).
export const CLICKSIGN_ERRORS = {
  'clicksign.api.request_failed': {
    category: 'integration',
    userCause:
      'A Clicksign respondeu com erro a um pedido do CRMThink e a operação não foi concluída.',
    remediation:
      'Ler o status/mensagem da Clicksign no log; conferir a credencial e o estado da conta nas Configurações.',
    retriable: false,
    httpStatus: 502,
  },
  'clicksign.cancel.app_not_found': {
    category: 'config',
    userCause:
      'O portal foi reconhecido, mas não há app Clicksign instalado nele pra cancelar.',
    remediation: 'Confirmar que o app Clicksign está instalado no portal.',
    retriable: false,
    httpStatus: 404,
  },
  'clicksign.cancel.domain_missing': {
    category: 'validation',
    userCause:
      'O pedido de cancelar o documento chegou sem dizer de qual portal ele é.',
    remediation:
      'Falha na origem do pedido — acionar a equipe de desenvolvimento se recorrente.',
    retriable: false,
    httpStatus: 400,
  },
  'clicksign.cancel.domain_not_found': {
    category: 'config',
    userCause:
      'O portal do cancelamento veio certo, mas não está cadastrado na nossa base.',
    remediation:
      'Verificar a instalação do app no portal; acionar dev se o portal deveria existir.',
    retriable: false,
    httpStatus: 404,
  },
  'clicksign.cancel.settings_not_found': {
    category: 'config',
    userCause:
      'O app está instalado, mas ninguém preencheu a tela de Configurações da integração.',
    remediation:
      'Orientar o parceiro a preencher as Configurações da integração.',
    retriable: false,
    httpStatus: 404,
  },
  'clicksign.document.cancel_failed': {
    category: 'integration',
    userCause:
      'O pedido chegou até a Clicksign, mas ela respondeu com erro e não cancelou.',
    remediation:
      'Ler a mensagem da Clicksign no log; conferir o estado do documento e tentar de novo.',
    retriable: false,
    httpStatus: 502,
  },
  'clicksign.document.cancel_not_confirmed': {
    category: 'integration',
    userCause:
      'A Clicksign aceitou o pedido sem erro, mas o documento não ficou como cancelado.',
    remediation:
      'Conferir no painel da Clicksign o estado do documento; tentar cancelar de novo.',
    retriable: false,
    httpStatus: 502,
  },
  'clicksign.document.signed_file_download_failed': {
    category: 'integration',
    userCause:
      'O documento foi assinado, mas o CRMThink não conseguiu baixar o arquivo final.',
    remediation:
      'Tentar novamente; conferir na Clicksign se o arquivo assinado está disponível.',
    retriable: true,
    httpStatus: 502,
  },
  'clicksign.envelope.company_token_not_found': {
    category: 'config',
    userCause:
      'A conta Clicksign escolhida no envio não bate com nenhuma cadastrada.',
    remediation:
      'Selecionar no envio uma conta Clicksign cadastrada nas Configurações.',
    retriable: false,
    httpStatus: 400,
  },
  'clicksign.envelope.create_failed': {
    category: 'integration',
    userCause:
      'A Clicksign recebeu o pedido de envio, mas recusou criar o documento.',
    remediation:
      'Ler a mensagem da Clicksign no log; conferir os dados do documento e dos assinantes.',
    retriable: false,
    httpStatus: 502,
  },
  'clicksign.envelope.file_download_failed': {
    category: 'integration',
    userCause:
      'O arquivo estava anexado, mas o sistema não conseguiu baixá-lo para enviar.',
    remediation:
      'Conferir se o anexo está acessível no Bitrix24 e tentar de novo.',
    retriable: true,
    httpStatus: 502,
  },
  'clicksign.envelope.file_missing': {
    category: 'validation',
    userCause:
      'O documento não tinha nenhum arquivo anexado na hora de enviar para assinatura.',
    remediation: 'Anexar um arquivo ao documento antes de enviar.',
    retriable: false,
    httpStatus: 400,
  },
  'clicksign.envelope.group_not_found': {
    category: 'config',
    userCause:
      'O grupo de assinatura usado no envio não existe mais nas configurações.',
    remediation: 'Selecionar um grupo de assinatura válido nas Configurações.',
    retriable: false,
    httpStatus: 404,
  },
  'clicksign.envelope.no_signers': {
    category: 'validation',
    userCause:
      'Não foi encontrado nenhum assinante para o documento na hora de enviar.',
    remediation: 'Adicionar ao menos um assinante antes de enviar.',
    retriable: false,
    httpStatus: 400,
  },
  'clicksign.envelope.notify_failed': {
    category: 'integration',
    userCause:
      'O documento foi criado, mas o aviso para os assinantes não saiu.',
    remediation: 'Reenviar a notificação; conferir os contatos dos assinantes.',
    retriable: true,
    httpStatus: 502,
  },
  'clicksign.fields.bitrix_error': {
    category: 'integration',
    userCause:
      'O Bitrix24 não deixou o CRMThink pegar a lista de campos e por isso ela ficou vazia.',
    remediation:
      'Conferir as permissões do app no Bitrix24 e recarregar a tela.',
    retriable: true,
    httpStatus: 502,
  },
  'clicksign.users.bitrix_error': {
    category: 'integration',
    userCause:
      'O Bitrix24 não deixou o CRMThink pegar a lista de usuários e por isso ela ficou vazia.',
    remediation:
      'Conferir as permissões do app no Bitrix24 e recarregar a tela.',
    retriable: true,
    httpStatus: 502,
  },
  'clicksign.provisioning.webhook_check_failed': {
    category: 'integration',
    userCause:
      'O CRMThink não conseguiu confirmar na Clicksign se o aviso automático de eventos está ativo.',
    remediation:
      'Tentar de novo; conferir a credencial da conta Clicksign nas Configurações.',
    retriable: true,
    httpStatus: 502,
  },
  'clicksign.provisioning.webhook_sync_failed': {
    category: 'integration',
    userCause:
      'O CRMThink não conseguiu ligar (ou desligar) na Clicksign o aviso automático de eventos do parceiro.',
    remediation:
      'Reabrir as Configurações e salvar de novo pra re-sincronizar o webhook.',
    retriable: true,
    httpStatus: 502,
  },
  'clicksign.send.document_id_invalid': {
    category: 'validation',
    userCause:
      'A automação de envio mandou o identificador do documento em um formato que o CRMThink não entendeu.',
    remediation:
      'Conferir a configuração da automação de envio (campo do identificador do documento).',
    retriable: false,
    httpStatus: 400,
  },
  'clicksign.send.robot_auth_missing': {
    category: 'auth',
    userCause:
      'A automação de envio disparou sem os dados que identificam o portal, então o CRMThink recusou o envio.',
    remediation:
      'Reconfigurar a automação de envio no Bitrix24 com os dados do portal.',
    retriable: false,
    httpStatus: 400,
  },
  'clicksign.settings.app_not_found': {
    category: 'config',
    userCause:
      'O CRMThink não achou o aplicativo Clicksign ligado ao portal, então as configurações não abrem nem salvam.',
    remediation: 'Confirmar que o app Clicksign está instalado no portal.',
    retriable: false,
    httpStatus: 404,
  },
  'clicksign.settings.robot_update_failed': {
    category: 'integration',
    userCause:
      'As configurações salvaram, mas o CRMThink não conseguiu atualizar no Bitrix24 as opções da automação de assinatura.',
    remediation:
      'Salvar as Configurações de novo; conferir as permissões do app no Bitrix24.',
    retriable: true,
    httpStatus: 502,
  },
  'clicksign.settings.webhook_sync_failed': {
    category: 'integration',
    userCause:
      'As configurações salvaram, mas o CRMThink não conseguiu registrar na Clicksign o canal que traz os avisos automáticos.',
    remediation:
      'Salvar as Configurações de novo pra re-registrar o webhook na Clicksign.',
    retriable: true,
    httpStatus: 502,
  },
  'clicksign.webhook.missing_app_or_ref': {
    category: 'validation',
    userCause:
      'O aviso da Clicksign chegou sem dizer de qual parceiro é — e por isso não pôde ser tratado.',
    remediation:
      'Aviso sem identificação do parceiro; acionar a equipe de desenvolvimento se recorrente.',
    retriable: false,
    httpStatus: 400,
  },
  'clicksign.webhook.secret_missing': {
    category: 'config',
    userCause:
      'Falta a senha de segurança do webhook — sem ela o CRMThink não confia no aviso da Clicksign.',
    remediation:
      'Preencher a senha de segurança do webhook nas Configurações da integração.',
    retriable: false,
    httpStatus: 401,
  },
  'clicksign.webhook.settings_not_found': {
    category: 'config',
    userCause:
      'Chegou um aviso da Clicksign, mas esse parceiro não tem nenhuma configuração salva pra receber.',
    remediation:
      'Conferir se o parceiro tem Configurações salvas da integração Clicksign.',
    retriable: false,
    httpStatus: 404,
  },
  'clicksign.webhook.signature_invalid': {
    category: 'auth',
    userCause:
      'O código de segurança do webhook da Clicksign não conferiu e o evento foi recusado.',
    remediation:
      'Conferir a senha de segurança do webhook nas Configurações (igual à cadastrada na Clicksign).',
    retriable: false,
    httpStatus: 401,
  },

  // Daqui em diante: audience dev (escalam pro dev).
  'clicksign.webhook.payload_invalid': {
    category: 'validation',
    userCause: 'Corpo do webhook não é JSON válido ou sem nome de evento.',
    remediation:
      'Falha de contrato do webhook — acionar a equipe de desenvolvimento.',
    retriable: false,
    httpStatus: 400,
  },
  'clicksign.envelope.activation_failed': {
    category: 'integration',
    userCause:
      'Falha no meio da montagem do envelope — pode ter ficado órfão na Clicksign.',
    remediation:
      'Conferir o envelope no painel da Clicksign; acionar a equipe de desenvolvimento.',
    retriable: false,
    httpStatus: 502,
  },
  'clicksign.event.signer_key_missing': {
    category: 'validation',
    userCause: 'Evento de assinatura sem a chave do signatário — ignorado.',
    remediation: 'Observabilidade — nenhuma ação de suporte.',
    retriable: false,
  },
  'clicksign.event.activity_not_found': {
    category: 'config',
    userCause:
      'Não achou a atividade do CRM correspondente ao documento — ignorado.',
    remediation:
      'Ler a linha de log com o documentKey; acionar o desenvolvimento se recorrente.',
    retriable: false,
  },
  'clicksign.event.layout_or_origin_unparseable': {
    category: 'internal',
    userCause:
      'Campos de origem/layout do evento não são JSON válido — ignorado.',
    remediation: 'Acionar a equipe de desenvolvimento.',
    retriable: false,
  },
  'clicksign.event.already_processed': {
    category: 'internal',
    userCause:
      'Evento de documento fechado já processado — ignorado (idempotência).',
    remediation: 'Observabilidade — nenhuma ação de suporte.',
    retriable: false,
  },
  'clicksign.send.execution_failed': {
    category: 'internal',
    userCause: 'Exceção não tratada no envio do documento.',
    remediation: 'Ler a linha de log; acionar a equipe de desenvolvimento.',
    retriable: false,
  },
  'clicksign.send.bizproc_release_failed': {
    category: 'integration',
    userCause: 'Liberação da automação no Bitrix (bizproc.event.send) falhou.',
    remediation: 'Ler a linha de log; acionar a equipe de desenvolvimento.',
    retriable: false,
  },
  'clicksign.send.settings_not_found': {
    category: 'config',
    userCause:
      'O robô de envio rodou, mas o portal não tem o app Clicksign instalado ou configurado; nenhum documento foi enviado.',
    remediation:
      'Conferir se o app está instalado no portal e se a configuração (tokens) foi salva; depois reexecutar a automação.',
    retriable: false,
  },
  'clicksign.cancel.execution_failed': {
    category: 'internal',
    userCause: 'Exceção não tratada durante o cancelamento.',
    remediation: 'Ler a linha de log; acionar a equipe de desenvolvimento.',
    retriable: false,
  },
  'clicksign.document.envelope_missing': {
    category: 'internal',
    userCause: 'originId do documento não contém uma chave de envelope válida.',
    remediation: 'Ler a linha de log; acionar a equipe de desenvolvimento.',
    retriable: false,
  },
  'clicksign.event.bitrix_update_failed': {
    category: 'integration',
    userCause:
      'O evento da Clicksign chegou, mas a atualização do card ou do negócio no Bitrix24 falhou.',
    remediation:
      'Conferir as permissões de CRM do app no portal; a Clicksign reenvia o evento conforme a política dela.',
    retriable: true,
  },
  'clicksign.lock.acquire_failed': {
    category: 'internal',
    userCause:
      'Não foi possível processar o documento porque ele estava travado por outra operação e o tempo de espera se esgotou.',
    remediation: 'Ler a linha de log; acionar a equipe de desenvolvimento.',
    retriable: true,
  },
  'clicksign.worker.settings_missing': {
    category: 'config',
    userCause:
      'Processamento em segundo plano sem configurações do app — foi pulado.',
    remediation: 'Observabilidade — nenhuma ação de suporte.',
    retriable: false,
  },
  'clicksign.worker.job_failed': {
    category: 'internal',
    userCause: 'O processamento em segundo plano falhou.',
    remediation: 'Ler a linha de log; acionar a equipe de desenvolvimento.',
    retriable: true,
  },
  'clicksign.provisioning.webhook_delete_failed': {
    category: 'integration',
    userCause: 'Remoção de webhook antigo (correção de drift) falhou.',
    remediation: 'Ler a linha de log; acionar a equipe de desenvolvimento.',
    retriable: true,
  },
  'clicksign.provisioning.bitrix_error': {
    category: 'integration',
    userCause: 'A verificação ou o reparo da instalação no Bitrix24 falhou.',
    remediation:
      'Conferir as permissões do app no portal e tentar de novo; ler a resposta do Bitrix24 no log.',
    retriable: true,
  },
  'clicksign.settings.body_invalid': {
    category: 'validation',
    userCause:
      'Os dados enviados ao salvar as configurações estão inválidos ou incompletos.',
    remediation: 'Corrigir o campo apontado no log e salvar de novo.',
    retriable: false,
  },
  'clicksign.fields.entity_invalid': {
    category: 'validation',
    userCause: 'Tipo de entidade inválido (use deal ou contact).',
    remediation: 'Acionar a equipe de desenvolvimento (chamada da tela).',
    retriable: false,
  },
} as const satisfies Record<string, ErrorMeta>

export type ClicksignErrorCode = keyof typeof CLICKSIGN_ERRORS

const catalog = makeErrorCatalog(CLICKSIGN_ERRORS)
// Via A: exceção que borbulha pro funil. Via B/C: desfecho não-exceção logado.
export const clicksignError = catalog.appError
export const logClicksignError = catalog.logError
