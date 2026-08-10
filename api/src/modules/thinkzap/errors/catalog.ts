import {
  makeErrorCatalog,
  type ErrorMeta,
} from '@/shared/domain/errors/error-catalog'

// Fonte única dos errorCode do thinkzap (metadados = summary do runbook + ação).
// Via A (exceção que borbulha pro funil HTTP) usa thinkzapError(); via B/C
// (webhook/worker/side-effect logado, sem exceção) usa logThinkzapError().
// Todo code aqui tem runbook em mcp/kb/runbooks/hubcore/thinkzap/<area>/<causa>.md
// (cruzado por teste). errorCode é contrato — estável, nunca renomear.
//
// Categorias: integration (terceiro falhou) · auth · validation (entrada ruim) ·
// internal (bug/estado nosso) · config (ambiente/instalação incompleta).
export const THINKZAP_ERRORS = {
  // ── app: resolução da instalação (portal + app) em controllers/webhooks ──
  'thinkzap.app.context_missing': {
    category: 'validation',
    userCause: 'Não foi possível identificar a instalação na sua sessão.',
    remediation:
      'Recarregar o app dentro do portal; se persistir, reinstalar o app e reabrir.',
    retriable: false,
    httpStatus: 400,
  },
  'thinkzap.app.not_found': {
    category: 'config',
    userCause: 'O app não está instalado neste portal (ou foi removido).',
    remediation:
      'Confirmar que o app está instalado e ativo no portal e tentar de novo.',
    retriable: false,
    httpStatus: 404,
  },

  // ── zapi: transporte do cliente z-api (WhatsApp não-oficial) ──
  'thinkzap.zapi.instance_create_failed': {
    category: 'integration',
    userCause: 'A z-api não conseguiu criar a linha de WhatsApp.',
    remediation:
      'Tentar de novo em instantes; se persistir, verificar status/credenciais da z-api.',
    retriable: true,
    httpStatus: 502,
  },
  'thinkzap.zapi.instance_subscribe_failed': {
    category: 'integration',
    userCause: 'Ativar/desativar a assinatura da linha na z-api falhou.',
    remediation:
      'Tentar de novo em instantes; se persistir, verificar status da z-api.',
    retriable: true,
    httpStatus: 502,
  },
  'thinkzap.zapi.instance_update_failed': {
    category: 'integration',
    userCause: 'Atualizar os dados da linha na z-api falhou.',
    remediation:
      'Tentar de novo em instantes; se persistir, verificar status da z-api.',
    retriable: true,
    httpStatus: 502,
  },
  'thinkzap.zapi.instance_list_failed': {
    category: 'integration',
    userCause: 'A z-api não respondeu à listagem de linhas.',
    remediation:
      'Tentar de novo em instantes; se persistir, verificar status da z-api.',
    retriable: true,
    httpStatus: 502,
  },
  'thinkzap.zapi.instance_get_failed': {
    category: 'integration',
    userCause: 'Ler os dados da linha na z-api falhou.',
    remediation:
      'Tentar de novo em instantes; se persistir, verificar status da z-api.',
    retriable: true,
    httpStatus: 502,
  },
  'thinkzap.zapi.instance_status_failed': {
    category: 'integration',
    userCause: 'Consultar o status de conexão da linha na z-api falhou.',
    remediation:
      'Tentar de novo em instantes; se persistir, verificar status da z-api.',
    retriable: true,
    httpStatus: 502,
  },
  'thinkzap.zapi.instance_disconnect_failed': {
    category: 'integration',
    userCause: 'Desconectar a linha na z-api falhou.',
    remediation:
      'Tentar de novo em instantes; se persistir, verificar status da z-api.',
    retriable: true,
    httpStatus: 502,
  },
  'thinkzap.zapi.qrcode_failed': {
    category: 'integration',
    userCause: 'A z-api não devolveu o QR Code para conectar a linha.',
    remediation:
      'Recarregar a aba Conexão em instantes; se persistir, verificar status da z-api.',
    retriable: true,
    httpStatus: 502,
  },
  'thinkzap.zapi.message_send_failed': {
    category: 'integration',
    userCause: 'A z-api não conseguiu enviar a mensagem ao contato.',
    remediation:
      'Conferir o número e se a linha está conectada; reenviar em instantes.',
    retriable: true,
    httpStatus: 502,
  },
  'thinkzap.zapi.message_edit_failed': {
    category: 'integration',
    userCause: 'Editar a mensagem já enviada pela z-api falhou.',
    remediation:
      'Tentar de novo; se persistir, conferir se a linha está conectada.',
    retriable: true,
    httpStatus: 502,
  },
  'thinkzap.zapi.message_delete_failed': {
    category: 'integration',
    userCause: 'Apagar a mensagem já enviada pela z-api falhou.',
    remediation:
      'Tentar de novo; se persistir, conferir se a linha está conectada.',
    retriable: true,
    httpStatus: 502,
  },
  'thinkzap.zapi.group_op_failed': {
    category: 'integration',
    userCause: 'Uma operação de grupo de WhatsApp na z-api falhou.',
    remediation:
      'Conferir se a linha está conectada e tentar de novo; ver o log para a operação.',
    retriable: true,
    httpStatus: 502,
  },

  // ── hubmessage: transporte do WhatsApp Oficial ──
  'thinkzap.hubmessage.not_configured': {
    category: 'config',
    userCause: 'A integração com o WhatsApp Oficial não está configurada.',
    remediation:
      'Acionar o time responsável para configurar a credencial do canal HubMessage.',
    retriable: false,
    httpStatus: 500,
  },
  'thinkzap.hubmessage.request_failed': {
    category: 'integration',
    userCause: 'O WhatsApp Oficial (HubMessage) recusou ou não respondeu.',
    remediation:
      'Reenviar em instantes; se persistir, verificar status/credenciais do canal HubMessage.',
    retriable: true,
    httpStatus: 502,
  },
  'thinkzap.hubmessage.send_failed': {
    category: 'integration',
    userCause:
      'A mensagem do operador não foi entregue ao contato pelo WhatsApp Oficial.',
    remediation:
      'Será retentada automaticamente; se persistir, checar o canal HubMessage.',
    retriable: true,
  },
  'thinkzap.hubmessage.window_closed': {
    category: 'validation',
    userCause:
      'O contato não interage há mais de 24h; o WhatsApp Oficial só permite mensagem livre nessa janela.',
    remediation: 'Reabrir a conversa enviando um template aprovado.',
    retriable: false,
  },
  'thinkzap.hubmessage.notify_failed': {
    category: 'internal',
    userCause:
      'Observabilidade — o aviso de janela fechada não foi postado no chat.',
    remediation: 'Nenhuma ação de suporte.',
    retriable: false,
  },

  // ── gateway: contratação/cobrança (provider de pagamento; hoje Stripe) ──
  'thinkzap.gateway.not_configured': {
    category: 'config',
    userCause: 'A contratação por cartão está indisponível no momento.',
    remediation:
      'Acionar o time responsável; a modalidade manual não é afetada.',
    retriable: false,
    httpStatus: 500,
  },
  'thinkzap.gateway.wrong_key_type': {
    category: 'config',
    userCause:
      'A contratação por cartão está indisponível por erro de configuração.',
    remediation:
      'Acionar o time responsável (chave secreta do gateway incorreta).',
    retriable: false,
    httpStatus: 500,
  },
  'thinkzap.gateway.checkout_create_failed': {
    category: 'integration',
    userCause: 'Não foi possível iniciar o pagamento da assinatura.',
    remediation:
      'Tentar de novo em instantes; se persistir, acionar o suporte.',
    retriable: false,
    httpStatus: 500,
  },
  'thinkzap.gateway.portal_create_failed': {
    category: 'integration',
    userCause: 'Não foi possível abrir o portal de faturamento agora.',
    remediation:
      'Tentar de novo em instantes; se persistir, acionar o suporte.',
    retriable: true,
    httpStatus: 500,
  },
  'thinkzap.gateway.webhook_secret_missing': {
    category: 'config',
    userCause: 'A verificação de eventos de pagamento não está configurada.',
    remediation:
      'Acionar o time responsável para configurar o segredo do webhook do gateway.',
    retriable: false,
    httpStatus: 401,
  },
  'thinkzap.gateway.webhook_signature_invalid': {
    category: 'auth',
    userCause:
      'Um evento de pagamento foi recusado por não ter origem verificável.',
    remediation:
      'Conferir o segredo do webhook configurado no gateway; nenhuma ação do cliente.',
    retriable: false,
    httpStatus: 401,
  },
  'thinkzap.gateway.webhook_payload_invalid': {
    category: 'validation',
    userCause:
      'Um evento de pagamento chegou em formato que não pôde ser verificado.',
    remediation: 'Acionar o time responsável (registro da rota do webhook).',
    retriable: false,
    httpStatus: 400,
  },
  'thinkzap.gateway.event_ignored': {
    category: 'internal',
    userCause:
      'Observabilidade — evento de pagamento ignorado por não trazer dados suficientes.',
    remediation: 'Nenhuma ação de suporte.',
    retriable: false,
  },
  'thinkzap.gateway.webhook_handler_failed': {
    category: 'integration',
    userCause:
      'Um pagamento foi confirmado no gateway mas o processamento interno falhou.',
    remediation:
      'Será reprocessado; se a linha não liberar, acionar o suporte com o e-mail da conta.',
    retriable: true,
    httpStatus: 500,
  },

  // ── bitrix: robô Bizproc, bot de atendimento, contexto de reply ──
  'thinkzap.bitrix.robot_webhook_failed': {
    category: 'integration',
    userCause:
      'O disparo automático de WhatsApp pelo fluxo (robô) não pôde ser concluído.',
    remediation:
      'Conferir se a linha está ativa e conectada; revisar a configuração do robô no fluxo.',
    retriable: false,
  },
  'thinkzap.bitrix.bot_id_failed': {
    category: 'integration',
    userCause:
      'A configuração do bot de atendimento no Bitrix24 não pôde ser concluída.',
    remediation:
      'Conferir as permissões (escopo imbot) do app no Bitrix24 e tentar de novo.',
    retriable: true,
  },
  'thinkzap.bitrix.reply_context_failed': {
    category: 'internal',
    userCause:
      'Observabilidade — uma citação de mensagem não foi resolvida; a mensagem seguiu sem a citação.',
    remediation: 'Nenhuma ação de suporte.',
    retriable: false,
  },
  'thinkzap.bitrix.user_name_failed': {
    category: 'internal',
    userCause:
      'Observabilidade — o nome de exibição de um usuário do Bitrix24 não foi obtido; usado um fallback.',
    remediation: 'Nenhuma ação de suporte.',
    retriable: false,
  },

  // ── subscription: ciclo de vida de linha/cobrança ──
  'thinkzap.subscription.activation_failed': {
    category: 'internal',
    userCause:
      'Seu pagamento foi aprovado, mas a ativação da assinatura não pôde ser concluída automaticamente.',
    remediation:
      'Acionar o suporte com o e-mail da conta; a liberação será feita manualmente, sem novo pagamento.',
    retriable: false,
    httpStatus: 500,
  },
  'thinkzap.subscription.line_blocked_after_payment': {
    category: 'internal',
    userCause:
      'Seu pagamento foi aprovado, mas a linha ainda não foi liberada.',
    remediation:
      'URGENTE: acionar o suporte com o e-mail/portal; a linha será destravada manualmente, sem nova cobrança.',
    retriable: false,
    httpStatus: 500,
  },
  'thinkzap.subscription.additional_line_failed': {
    category: 'internal',
    userCause: 'Não foi possível concluir a criação da linha adicional.',
    remediation:
      'Acionar o suporte; se houve cobrança, a linha será criada manualmente sem novo pagamento.',
    retriable: false,
    httpStatus: 500,
  },
  'thinkzap.subscription.new_line_not_created': {
    category: 'internal',
    userCause:
      'Observabilidade — pagamento aprovado e a nova linha não foi criada; reconciliar à mão.',
    remediation:
      'Localizar a assinatura pelo e-mail/portal no log e criar a linha manualmente, sem nova cobrança.',
    retriable: false,
  },
  'thinkzap.subscription.trial_activation_failed': {
    category: 'internal',
    userCause: 'Não foi possível ativar o período de teste agora.',
    remediation:
      'Tentar novamente em instantes; se persistir, acionar o suporte.',
    retriable: false,
    httpStatus: 500,
  },
  'thinkzap.subscription.trial_not_eligible': {
    category: 'validation',
    userCause:
      'Este portal não está elegível ao período de teste (já utilizado ou já possui assinatura).',
    remediation:
      'Para contratar, usar a opção de assinatura; dúvidas, acionar o suporte.',
    retriable: false,
    httpStatus: 409,
  },
  'thinkzap.subscription.trial_plan_missing': {
    category: 'config',
    userCause: 'O período de teste está temporariamente indisponível.',
    remediation:
      'Acionar o time responsável (plano de teste não configurado no catálogo).',
    retriable: false,
    httpStatus: 503,
  },
  'thinkzap.subscription.provider_billing_failed': {
    category: 'integration',
    userCause:
      'Observabilidade — o vínculo de cobrança de uma linha com o provedor externo falhou; o serviço do cliente segue.',
    remediation:
      'Ver no log o item/provedor e reconciliar a cobrança com o provedor externo.',
    retriable: false,
  },
  'thinkzap.subscription.line_not_found_for_item': {
    category: 'validation',
    userCause: 'A linha informada não foi encontrada nesta instalação.',
    remediation:
      'Recarregar a lista de linhas e tentar de novo; se sumiu, verificar se a assinatura está ativa.',
    retriable: false,
    httpStatus: 404,
  },

  // ── provisioning: ciclo de vida da instância z-api ──
  'thinkzap.provisioning.instance_ensure_failed': {
    category: 'integration',
    userCause: 'Não foi possível preparar a linha para o envio.',
    remediation:
      'Tentar de novo em instantes; se persistir, acionar o suporte.',
    retriable: false,
    httpStatus: 400,
  },
  'thinkzap.provisioning.instance_resolve_failed': {
    category: 'validation',
    userCause: 'A linha não está conectada no WhatsApp.',
    remediation: 'Ler o QR Code novamente na aba Conexão e repetir a operação.',
    retriable: false,
    httpStatus: 400,
  },
  'thinkzap.provisioning.settings_not_found': {
    category: 'internal',
    userCause:
      'Observabilidade — configurações da linha não encontradas; aplicados os padrões.',
    remediation:
      'Nenhuma ação de suporte, salvo mensagens sumindo — aí verificar a linha na lista.',
    retriable: false,
  },
  'thinkzap.provisioning.disconnect_expired_failed': {
    category: 'integration',
    userCause:
      'Observabilidade — a desconexão de uma linha com teste vencido falhou; será retentada.',
    remediation: 'Nenhuma ação de suporte.',
    retriable: true,
  },

  // ── message: orquestração de envio/recebimento (camada de use-case) ──
  'thinkzap.message.widget_send_failed': {
    category: 'validation',
    userCause: 'Não foi possível enviar a mensagem.',
    remediation:
      'Conferir o número do destinatário e se a linha está ativa e conectada; reenviar.',
    retriable: false,
    httpStatus: 400,
  },
  'thinkzap.message.widget_template_failed': {
    category: 'validation',
    userCause: 'Não foi possível enviar o template pelo WhatsApp Oficial.',
    remediation:
      'Conferir o número, se a linha é WhatsApp Oficial e se o template está aprovado; reenviar.',
    retriable: false,
    httpStatus: 400,
  },
  'thinkzap.message.inbound_zapi_failed': {
    category: 'integration',
    userCause:
      'Uma mensagem recebida do WhatsApp não pôde ser entregue ao CRM.',
    remediation:
      'Reprocessada automaticamente; se recorrente, conferir a linha e a instalação do app.',
    retriable: true,
  },
  'thinkzap.message.inbound_hubmessage_failed': {
    category: 'integration',
    userCause:
      'Uma mensagem recebida do WhatsApp Oficial não pôde ser entregue ao CRM.',
    remediation:
      'Reprocessada automaticamente; se recorrente, conferir o canal HubMessage e a instalação.',
    retriable: true,
  },
  'thinkzap.message.related_destinations_failed': {
    category: 'integration',
    userCause: 'Não foi possível montar a lista de contatos relacionados.',
    remediation:
      'Conferir as permissões de CRM do app no Bitrix24; informar o destino manualmente se necessário.',
    retriable: false,
  },
  'thinkzap.message.invalid_phone': {
    category: 'validation',
    userCause: 'Um dos números informados é inválido.',
    remediation: 'Conferir o número (DDI/DDD) e tentar de novo.',
    retriable: false,
    httpStatus: 400,
  },

  // ── template: catálogo/envio de template do WhatsApp Oficial ──
  'thinkzap.template.provider_unsupported': {
    category: 'validation',
    userCause:
      'Esta linha usa uma conexão que não trabalha com templates; use o envio de mensagem normal.',
    remediation:
      'Enviar pelo campo de mensagem comum; templates só valem para linhas de WhatsApp Oficial.',
    retriable: false,
    httpStatus: 400,
  },
  'thinkzap.template.channel_not_connected': {
    category: 'validation',
    userCause:
      'O número desta linha ainda não foi conectado no WhatsApp Oficial; sem isso não há templates.',
    remediation:
      'Concluir a conexão do canal (número na Meta) e tentar de novo.',
    retriable: false,
    httpStatus: 400,
  },
  'thinkzap.template.provider_unavailable': {
    category: 'integration',
    userCause:
      'O WhatsApp Oficial está temporariamente indisponível; nenhuma mensagem foi enviada.',
    remediation:
      'Tentar de novo em alguns minutos; se persistir, acionar o suporte.',
    retriable: true,
    httpStatus: 503,
  },
  'thinkzap.template.invalid_definition': {
    category: 'validation',
    userCause: 'Os dados do template estão inválidos.',
    remediation: 'Conferir nome, idioma, categoria e componentes do template.',
    retriable: false,
    httpStatus: 400,
  },
  'thinkzap.template.provider_rejected': {
    category: 'integration',
    userCause: 'O WhatsApp Oficial recusou a operação do template.',
    remediation:
      'Ler no log a mensagem retornada pelo provedor e ajustar o template conforme apontado.',
    retriable: false,
    httpStatus: 400,
  },

  // ── line: estado da linha no envio/leitura pelo widget ──
  'thinkzap.line.blocked': {
    category: 'validation',
    userCause:
      'Esta linha está sem assinatura ativa ou com o período de teste encerrado.',
    remediation:
      'Contratar/reativar a assinatura da linha para voltar a usá-la.',
    retriable: false,
    httpStatus: 402,
  },
  'thinkzap.line.disconnected': {
    category: 'validation',
    userCause: 'A linha não está conectada no WhatsApp.',
    remediation: 'Ler o QR Code novamente na aba Conexão e repetir a operação.',
    retriable: false,
    httpStatus: 409,
  },
  'thinkzap.line.provider_unsupported': {
    category: 'validation',
    userCause: 'Esta operação não está disponível para o tipo desta linha.',
    remediation:
      'Conferir a modalidade da linha (WhatsApp comum vs Oficial); usar a operação compatível.',
    retriable: false,
    httpStatus: 400,
  },

  // ── subscription: resolução de plano / regras de contratação ──
  'thinkzap.subscription.plan_not_offerable': {
    category: 'validation',
    userCause: 'O plano escolhido não está disponível para esta linha.',
    remediation:
      'Recarregar os planos e escolher novamente; se persistir, acionar o suporte.',
    retriable: false,
    httpStatus: 400,
  },
  'thinkzap.subscription.plan_for_provider_missing': {
    category: 'config',
    userCause:
      'A contratação para este tipo de linha está indisponível no momento.',
    remediation:
      'Acionar o time responsável (plano/preço do conector não configurado).',
    retriable: false,
    httpStatus: 409,
  },
  'thinkzap.subscription.plan_for_provider_ambiguous': {
    category: 'config',
    userCause:
      'Há mais de um plano para este tipo de linha e não dá para decidir automaticamente qual usar.',
    remediation:
      'Acionar o time responsável para deixar um único plano ofertável por conector.',
    retriable: false,
    httpStatus: 409,
  },
  'thinkzap.subscription.already_subscribed': {
    category: 'validation',
    userCause: 'Esta conta já tem uma assinatura ativa.',
    remediation:
      'Trocar de plano por aqui não está disponível; gerenciar pela área de faturamento ou acionar o suporte.',
    retriable: false,
    httpStatus: 409,
  },
  'thinkzap.subscription.no_line_to_extend': {
    category: 'validation',
    userCause: 'Esta conta ainda não tem nenhuma linha.',
    remediation:
      'A primeira linha é criada pelo período de teste; iniciar por ele.',
    retriable: false,
    httpStatus: 409,
  },
  'thinkzap.subscription.manual_modality_cannot_add_line': {
    category: 'validation',
    userCause: 'A assinatura desta conta é cobrada por boleto.',
    remediation:
      'Para adicionar uma linha nessa modalidade, falar com o suporte.',
    retriable: false,
    httpStatus: 409,
  },
  'thinkzap.subscription.billing_portal_unavailable': {
    category: 'validation',
    userCause:
      'Não há faturamento a gerenciar para esta conta (sem assinatura por cartão).',
    remediation:
      'Confirmar se a conta tem assinatura por cartão; modalidade manual não usa o portal.',
    retriable: false,
    httpStatus: 400,
  },

  // ── provisioning: credencial da linha recém-provisionada ──
  'thinkzap.provisioning.credential_missing': {
    category: 'integration',
    userCause:
      'A criação da linha não retornou os dados de conexão; nada foi cobrado.',
    remediation:
      'Tentar novamente em instantes; se persistir, acionar o suporte.',
    retriable: true,
    httpStatus: 502,
  },

  // ── gateway: normalização de evento de assinatura ──
  'thinkzap.gateway.period_missing': {
    category: 'integration',
    userCause:
      'Observabilidade — o gateway não informou o período de cobrança de uma assinatura.',
    remediation:
      'Nenhuma ação de suporte; reconciliar no gateway se recorrente.',
    retriable: false,
  },

  // ── config/install: ambiente e instalação ──
  'thinkzap.config.missing_env': {
    category: 'config',
    userCause:
      'Um recurso está temporariamente indisponível por configuração de ambiente.',
    remediation: 'Acionar o time responsável (variável de ambiente ausente).',
    retriable: false,
    httpStatus: 500,
  },
  'thinkzap.install.placement_bind_failed': {
    category: 'integration',
    userCause:
      'A instalação não conseguiu registrar uma tela do app no Bitrix24.',
    remediation:
      'Reinstalar o app no portal; se persistir, conferir permissões e acionar o suporte.',
    retriable: true,
  },
} as const satisfies Record<string, ErrorMeta>

export type ThinkzapErrorCode = keyof typeof THINKZAP_ERRORS

const catalog = makeErrorCatalog(THINKZAP_ERRORS)
// Via A: exceção que borbulha pro funil. Via B/C: desfecho não-exceção logado.
export const thinkzapError = catalog.appError
export const logThinkzapError = catalog.logError
