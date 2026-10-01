import {
  makeErrorCatalog,
  type ErrorMeta,
} from '@/shared/domain/errors/error-catalog'

// errorCode é contrato: nunca renomear. Cada code exige runbook em mcp/kb/runbooks/hubcore/thinkzap/ (cruzado por teste).
export const THINKZAP_ERRORS = {
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
  'thinkzap.zapi.group_op_failed': {
    category: 'integration',
    userCause: 'Uma operação de grupo de WhatsApp na z-api falhou.',
    remediation:
      'Conferir se a linha está conectada e tentar de novo; ver o log para a operação.',
    retriable: true,
    httpStatus: 502,
  },

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

  'thinkzap.bitrix.robot_webhook_failed': {
    category: 'integration',
    userCause:
      'O disparo automático de WhatsApp pelo fluxo (robô) não pôde ser concluído.',
    remediation:
      'Conferir se a linha está ativa e conectada; revisar a configuração do robô no fluxo.',
    retriable: false,
  },
  'thinkzap.bitrix.template_robot_refused': {
    category: 'config',
    userCause:
      'O robô de envio de template não disparou: a linha configurada não pode enviar template (bloqueada, Z-API, ou canal não conectado) ou nenhum destinatário foi encontrado.',
    remediation:
      'Abrir a configuração do robô no fluxo e escolher uma linha do WhatsApp Oficial conectada; conferir o destino ou os contatos relacionados da entidade.',
    retriable: false,
  },
  'thinkzap.bitrix.template_robot_enqueue_failed': {
    category: 'internal',
    userCause:
      'O robô de envio de template não conseguiu registrar o envio de um destinatário.',
    remediation:
      'Os demais destinatários seguiram; reexecutar a automação para o destinatário que falhou e acionar o suporte se persistir.',
    retriable: true,
  },
  'thinkzap.bitrix.button_robot_refused': {
    category: 'config',
    userCause:
      'O robô de envio de botões não disparou: a linha configurada não pode enviar botões por esse robô (bloqueada, provider incompatível, canal não conectado) ou nenhum destinatário/botão válido foi encontrado.',
    remediation:
      'Abrir a configuração do robô no fluxo, escolher uma linha do provider certo (oficial para o robô "WhatsApp Oficial", Z-API para o robô "Z-API") e conferir destino, corpo e botões.',
    retriable: false,
  },
  'thinkzap.bitrix.button_robot_enqueue_failed': {
    category: 'internal',
    userCause:
      'O robô de envio de botões não conseguiu registrar o envio de um destinatário.',
    remediation:
      'Os demais destinatários seguiram; reexecutar a automação para o destinatário que falhou e acionar o suporte se persistir.',
    retriable: true,
  },
  'thinkzap.line.messageservice_scope_missing': {
    category: 'config',
    userCause:
      'O aplicativo não tem permissão de serviço de mensagens no portal, então a linha não pode ser oferecida à campanha de SMS.',
    remediation:
      'Publicar o escopo `messageservice` no manifesto do aplicativo e pedir que o portal reautorize o app; não é problema da linha nem da credencial.',
    retriable: false,
    httpStatus: 409,
  },
  'thinkzap.bitrix.sms_sender_unknown': {
    category: 'config',
    userCause:
      'Uma campanha de SMS foi disparada por um provedor de mensagem que não corresponde a nenhuma linha desta instalação.',
    remediation:
      'Remover o provedor órfão pela tela de provedores do portal admin e refazer a campanha com uma linha existente.',
    retriable: false,
    httpStatus: 404,
  },
  'thinkzap.bitrix.sms_campaign_refused': {
    category: 'config',
    userCause:
      'Um destinatário da campanha de SMS foi recusado antes do envio: linha sem habilitação, canal desconectado, corpo fora do formato exigido ou telefone inválido.',
    remediation:
      'Ler o motivo no log, corrigir a linha ou o corpo da campanha e disparar de novo; os demais destinatários seguiram normalmente.',
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
  'thinkzap.bot.register_failed': {
    category: 'integration',
    userCause:
      'Não foi possível registrar o bot de atendimento no Bitrix24; o fluxo não pôde ser vinculada ao canal.',
    remediation:
      'Conferir se o app tem o escopo `imbot` liberado no portal e tentar vincular de novo.',
    retriable: true,
    httpStatus: 502,
  },
  // `BOT_CODE_ALREADY_TAKEN`: dois ambientes nossos no mesmo Bitrix24 (register só é idempotente pro mesmo app).
  'thinkzap.bot.code_taken': {
    category: 'config',
    userCause:
      'Este portal já tem um ThinkBot registrado por outra instalação do app, e o mesmo identificador não pode ser usado duas vezes.',
    remediation:
      'Definir `BITRIX_BOT_FLOW_CODE` com um valor próprio neste ambiente (ex.: `thinkzap-flow-dev`) e vincular de novo.',
    retriable: false,
    httpStatus: 409,
  },
  // Checado antes do registro: o Bitrix devolveria `ACCESS_DENIED` genérico, que despista o suporte.
  'thinkzap.bot.scope_missing': {
    category: 'config',
    userCause:
      'O app instalado no portal não tem as permissões de mensageria que o bot de atendimento precisa, então o bot não pode ser criado.',
    remediation:
      'Reinstalar o app no portal do parceiro liberando os escopos `imbot` e `imopenlines`; o log traz quais faltaram.',
    retriable: false,
    httpStatus: 409,
  },
  'thinkzap.bot.line_bind_failed': {
    category: 'integration',
    userCause:
      'O Bitrix24 não guardou o bot no canal aberto; o fluxo não foi vinculada.',
    remediation:
      'Conferir se o canal aberto está ativo e se nenhum outro app configurou um bot de boas-vindas nele, e tentar vincular de novo.',
    retriable: true,
    httpStatus: 502,
  },
  // Recusa deliberada: sobrescrever o bot de outro app o derrubaria sem aviso.
  'thinkzap.bot.line_has_other_bot': {
    category: 'config',
    userCause:
      'O canal aberto escolhido já usa um bot de saudação de outro aplicativo, e o Bitrix24 só aceita um por canal.',
    remediation:
      'Escolher outro canal aberto, ou desativar o bot de saudação atual nas configurações do canal no Bitrix24 antes de vincular o fluxo. O log traz o id do bot que está ocupando a linha.',
    retriable: false,
    httpStatus: 409,
  },
  'thinkzap.bot.line_unbind_failed': {
    category: 'integration',
    userCause:
      'O Bitrix24 não desligou o bot do canal aberto; o vínculo do fluxo foi mantido para o canal não ficar com um bot sem fluxo.',
    remediation:
      'Conferir o bot de boas-vindas do canal aberto no Bitrix24 e tentar remover o vínculo de novo.',
    retriable: true,
    httpStatus: 502,
  },
  'thinkzap.bot.unregister_failed': {
    category: 'integration',
    userCause:
      'Observabilidade — o bot de atendimento ficou registrado no Bitrix24 depois de o último fluxo ser removido. Nenhum atendimento é afetado.',
    remediation:
      'Nenhuma ação de suporte: o próximo vínculo reaproveita o bot. Se o parceiro quiser limpar, o bot pode ser removido pela lista de bots do portal.',
    retriable: false,
  },
  'thinkzap.bot.say_failed': {
    category: 'integration',
    userCause: 'Uma fala do bot de atendimento não chegou ao cliente.',
    remediation:
      'Conferir se o canal aberto está ativo e o bot instalado na linha; a conversa segue com o atendimento humano.',
    retriable: true,
  },
  // Degradação deliberada: sem sender o turno roda só com eco no chat, em vez de o job falhar.
  'thinkzap.bot.contact_sender_unresolved': {
    category: 'config',
    userCause:
      'O bot não conseguiu descobrir por qual número responder ao cliente; as falas ficaram só no chat do canal aberto, visíveis ao atendente.',
    remediation:
      'Conferir se o canal aberto do fluxo está vinculado a uma linha de WhatsApp ativa e conectada. Enquanto isso, o atendente pode responder manualmente pela conversa.',
    retriable: true,
  },
  'thinkzap.bot.whisper_failed': {
    category: 'integration',
    userCause:
      'Observabilidade — o resumo do atendimento automático não foi registrado no chat antes da transferência. O cliente foi transferido normalmente.',
    remediation:
      'Nenhuma ação de suporte: o atendente tem o histórico da conversa no próprio chat.',
    retriable: false,
  },
  'thinkzap.bot.echo_failed': {
    category: 'integration',
    userCause:
      'Observabilidade — uma fala do bot chegou ao cliente mas não foi registrada no chat do canal aberto. O atendimento não é afetado.',
    remediation:
      'Nenhuma ação de suporte: o cliente recebeu a mensagem. Se o atendente precisar do que foi dito, o histórico está na conversa do WhatsApp.',
    retriable: false,
  },
  'thinkzap.bot.say_session_gone': {
    category: 'integration',
    userCause:
      'O bot tentou falar numa conversa em que já não participa — normalmente porque um atendente assumiu ou a sessão foi encerrada no portal.',
    remediation:
      'Nenhuma ação de suporte: a conversa está com quem a assumiu e a sessão do bot foi encerrada. Retentar não se aplica.',
    retriable: false,
  },
  'thinkzap.bot.handoff_failed': {
    category: 'integration',
    userCause:
      'O bot não conseguiu transferir a conversa para o atendimento humano.',
    remediation:
      'Conferir se o atendente ou canal escolhido no fluxo ainda existe e está ativo no Bitrix24.',
    retriable: true,
  },
  'thinkzap.bot.handoff_target_unusable': {
    category: 'config',
    userCause:
      'O bloco de entrega do fluxo aponta para um atendente ou canal que não existe mais; a conversa foi para a fila da linha.',
    remediation:
      'Abrir o fluxo, escolher de novo o destino do bloco de entrega e publicar.',
    retriable: false,
  },
  'thinkzap.bot.finish_failed': {
    category: 'integration',
    userCause: 'O bot não conseguiu encerrar a sessão do canal aberto.',
    remediation:
      'A sessão fecha pelo tempo de inatividade da linha; nenhuma ação imediata.',
    retriable: true,
  },
  'thinkzap.bot.event_unresolved': {
    category: 'internal',
    userCause:
      'Uma mensagem chegou ao bot de atendimento e não foi possível descobrir a qual instalação ou canal ela pertence; a conversa segue com o atendimento humano.',
    remediation:
      'Conferir se a instalação do ThinkZap ainda está ativa no portal e se o canal aberto do evento existe. Reinstalar o app recria a credencial e o registro do bot.',
    retriable: false,
  },
  'thinkzap.bot.working_hours_unavailable': {
    category: 'integration',
    userCause:
      'O bot não conseguiu ler o horário de atendimento do canal aberto e tratou a conversa como dentro do expediente.',
    remediation:
      'Conferir se o canal aberto do log ainda existe e se o app tem o escopo `imopenlines`; enquanto falhar, o bloco de horário do fluxo não tem efeito.',
    retriable: true,
  },
  'thinkzap.bot.turn_skipped': {
    category: 'config',
    userCause:
      'O bot está ligado num canal aberto que não tem fluxo para rodar; a conversa foi entregue à fila da linha.',
    remediation:
      'Abrir o ThinkBot e vincular um fluxo publicado ao canal, ou remover o vínculo para o canal voltar ao atendimento humano direto.',
    retriable: false,
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
  'thinkzap.subscription.trial_contact_failed': {
    category: 'integration',
    userCause:
      'Não foi possível registrar seus dados de contato para iniciar o teste.',
    remediation:
      'Tentar de novo em instantes; se persistir, verificar a disponibilidade do CRM interno.',
    retriable: true,
    httpStatus: 502,
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
  // Sem `httpStatus`: o webhook já respondeu 200 antes de o job rodar.
  'thinkzap.subscription.manual_line_not_provisioned': {
    category: 'internal',
    userCause:
      'Observabilidade — item de assinatura criado à mão no CRM não virou linha; nenhum recurso foi criado.',
    remediation:
      'Ver no log o id do item e o motivo; corrigir o item na SPA 1146 (provider e credencial) e recriar o evento.',
    retriable: false,
  },
  'thinkzap.subscription.manual_line_credential_orphaned': {
    category: 'internal',
    userCause:
      'Observabilidade — recurso criado no provedor e a credencial não foi gravada no item; recurso órfão, cobrado de nós.',
    remediation:
      'URGENTE: ver no log o id remoto e colar a credencial no item da SPA 1146, ou apagar o recurso no provedor.',
    retriable: false,
  },
  'thinkzap.subscription.manual_line_billing_not_adjusted': {
    category: 'internal',
    userCause:
      'Observabilidade — linha criada à mão e a cobrança do contrato não foi ajustada; cliente com uma linha a mais do que paga.',
    remediation:
      'Ver no log a assinatura do gateway e ajustar a quantidade do line_item para o número de linhas ativas.',
    retriable: false,
  },

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

  // `prefixFailure`/`refusal` no payload separam escopo faltando de cadastro incompleto.
  'thinkzap.message.operator_prefix_unresolved': {
    category: 'config',
    userCause:
      'O nome do operador não foi obtido, então a mensagem saiu sem o prefixo configurado.',
    remediation:
      'Conferir se o app tem escopo de usuários no portal e se o operador tem nome no cadastro de usuários permitidos; a mensagem foi entregue.',
    retriable: false,
  },
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
  'thinkzap.message.widget_button_failed': {
    category: 'validation',
    userCause:
      'Não foi possível enviar a mensagem com botões pelo widget de conversas.',
    remediation:
      'Conferir o número, a linha escolhida e se os botões preenchidos são aceitos por ela; reenviar.',
    retriable: false,
    httpStatus: 400,
  },
  'thinkzap.message.widget_button_provider_unavailable': {
    category: 'integration',
    userCause:
      'O provider de WhatsApp está temporariamente indisponível; nenhuma mensagem com botões foi enviada.',
    remediation:
      'Tentar de novo em alguns minutos; se persistir, acionar o suporte.',
    retriable: true,
    httpStatus: 503,
  },
  // Falha permanente (código malformado ou botão não aceito): o job encerra sem relançar.
  'thinkzap.message.button_action_failed': {
    category: 'validation',
    userCause:
      'O envio de botões da tela do canal aberto não pôde ser entregue ao provider.',
    remediation:
      'Conferir se os botões preenchidos são aceitos pela linha e reenviar pela tela.',
    retriable: false,
  },
  // Nada foi entregue: toda falha teve resposta HTTP do provider (recusa, não incerteza).
  'thinkzap.message.widget_send_exhausted': {
    category: 'integration',
    userCause:
      'Uma mensagem enviada pelo widget não pôde ser entregue ao contato.',
    remediation:
      'Conferir a conexão da linha e o número do destinatário; o operador foi avisado na timeline e pode reenviar.',
    retriable: false,
  },
  // Caiu durante a chamada ao provider: pode ter entregue, então não é retentado de propósito.
  'thinkzap.message.widget_send_unknown': {
    category: 'integration',
    userCause:
      'Não foi possível confirmar se uma mensagem enviada pelo widget saiu para o contato.',
    remediation:
      'O operador foi avisado para conferir a conversa antes de reenviar; se recorrente, investigar estabilidade da rede com o provider.',
    retriable: false,
  },
  'thinkzap.message.widget_send_notice_failed': {
    category: 'integration',
    userCause:
      'O aviso de falha de envio não pôde ser publicado na timeline do CRM.',
    remediation:
      'Conferir as permissões de CRM do app no Bitrix24; o desfecho do envio está no log.',
    retriable: false,
  },
  // Sem `httpStatus`: a mensagem já foi entregue, e responder falha faria o operador reenviar em duplicidade.
  'thinkzap.message.open_channel_failed': {
    category: 'integration',
    userCause:
      'A mensagem foi entregue ao contato, mas a conversa não abriu no canal aberto do Bitrix24.',
    remediation:
      'Conferir se a linha está vinculada a um canal aberto e se o conector está ativo naquela linha; a próxima mensagem tenta de novo.',
    retriable: true,
  },
  'thinkzap.message.outbound_context_missing': {
    category: 'config',
    userCause:
      'Uma mensagem do operador no canal aberto não foi enviada: o canal não está ligado a nenhuma linha ativa desta instalação.',
    remediation:
      'Conferir se o canal aberto do log está vinculado a uma linha na aba Ajustes e se o app segue instalado no portal; o operador reenvia depois do vínculo.',
    retriable: false,
  },
  'thinkzap.message.outbound_persist_failed': {
    category: 'internal',
    userCause:
      'Observabilidade — a mensagem do operador foi entregue, mas não foi registrada no nosso banco; status de entrega e citações dela não vão casar.',
    remediation:
      'Nenhuma ação de suporte para a conversa. Se recorrente, acionar o time responsável (disponibilidade do banco).',
    retriable: false,
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
  'thinkzap.line.channel_already_linked': {
    category: 'validation',
    userCause: 'Este canal aberto já atende outra linha.',
    remediation:
      'Desvincular o canal da outra linha, ou criar um canal aberto novo no Bitrix para esta. ' +
      'Um canal atende uma linha só: a saída do Bitrix identifica apenas o canal, então duas ' +
      'linhas no mesmo canal fazem a resposta do operador sair por um número imprevisível.',
    retriable: false,
    httpStatus: 409,
  },
  'thinkzap.line.channel_binding_ambiguous': {
    category: 'validation',
    userCause:
      'Este canal aberto está vinculado a mais de uma linha, e não há como saber qual deve responder.',
    remediation:
      'Na SPA 1146, desvincular o canal (`ufCrm93Conector`) do item que não deve responder. ' +
      'Estado só existe em instalação configurada antes da guarda de vínculo único.',
    retriable: false,
    httpStatus: 409,
  },

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

  'thinkzap.provisioning.credential_missing': {
    category: 'integration',
    userCause:
      'A criação da linha não retornou os dados de conexão; nada foi cobrado.',
    remediation:
      'Tentar novamente em instantes; se persistir, acionar o suporte.',
    retriable: true,
    httpStatus: 502,
  },

  'thinkzap.gateway.period_missing': {
    category: 'integration',
    userCause:
      'Observabilidade — o gateway não informou o período de cobrança de uma assinatura.',
    remediation:
      'Nenhuma ação de suporte; reconciliar no gateway se recorrente.',
    retriable: false,
  },

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
  'thinkzap.install.placement_unbind_failed': {
    category: 'integration',
    userCause:
      'Observabilidade — uma tela do app não foi removida do Bitrix24 na desinstalação; ela pode continuar aparecendo no portal.',
    remediation:
      'Se o parceiro reclamar da tela órfã, removê-la pela reinstalação seguida de nova desinstalação, ou pelas configurações de aplicativos do portal.',
    retriable: true,
  },

  'thinkzap.bitrix.contact_read_failed': {
    category: 'integration',
    userCause:
      'Um contato do CRM não pôde ser lido; ele ficou fora da busca, ou a conversa abriu com o telefone no lugar do nome.',
    remediation:
      'Conferir se o contato do log existe e se o app tem escopo de CRM no portal; repetir a busca.',
    retriable: true,
  },
  'thinkzap.zapi.phone_data_failed': {
    category: 'integration',
    userCause:
      'Observabilidade — a z-api não devolveu o número do aparelho da linha; a tela mostra a linha sem telefone.',
    remediation:
      'Nenhuma ação se for pontual. Recorrente para a mesma instância: conferir a conexão da linha na z-api.',
    retriable: true,
  },
  'thinkzap.line.billing_read_failed': {
    category: 'integration',
    userCause:
      'Os dados da linha não puderam ser lidos agora (CRM interno ou provider não respondeu como esperado).',
    remediation:
      'Recarregar a tela em instantes; se persistir, ver no log qual leitura falhou (`err`) e acionar o suporte.',
    retriable: true,
    httpStatus: 502,
  },
  'thinkzap.line.waba_persist_failed': {
    category: 'internal',
    userCause:
      'O WhatsApp Oficial foi conectado, mas a conta (WABA) não foi gravada na linha; os templates vão recusar até ela existir.',
    remediation:
      'URGENTE: copiar o `wabaId` do log para o `metadata` do item da linha na SPA 1146, ou reconectar o canal pela tela.',
    retriable: false,
  },
  'thinkzap.line.connected_flag_write_failed': {
    category: 'internal',
    userCause:
      'Observabilidade — o canal conectou, mas o campo Conectado do item da linha não foi atualizado no CRM.',
    remediation:
      'Nenhuma ação para o cliente; o próximo evento de conexão regrava. Se o CRM precisar refletir agora, marcar o campo no item à mão.',
    retriable: true,
  },
  'thinkzap.line.connected_sync_enqueue_failed': {
    category: 'internal',
    userCause:
      'Observabilidade — um evento de conexão/desconexão da z-api não foi enfileirado para atualizar o campo Conectado no CRM.',
    remediation:
      'Nenhuma ação para o cliente; o campo corrige no próximo evento. Recorrente: verificar a disponibilidade do Redis.',
    retriable: true,
  },
  'thinkzap.line.connection_notify_enqueue_failed': {
    category: 'internal',
    userCause:
      'O aviso de conexão/desconexão da linha não foi enviado aos destinatários configurados.',
    remediation:
      'Confirmar o estado da linha na aba Conexão. Recorrente: verificar a disponibilidade do Redis.',
    retriable: true,
  },
  'thinkzap.gateway.price_read_failed': {
    category: 'integration',
    userCause:
      'O preço de um plano não pôde ser lido no gateway de pagamento; o plano ficou fora da oferta ou aparece sem valor.',
    remediation:
      'Conferir no gateway se o price do log existe e está ativo; se for instabilidade, recarregar em instantes.',
    retriable: true,
  },
  'thinkzap.gateway.subscription_read_failed': {
    category: 'integration',
    userCause:
      'A assinatura não pôde ser lida no gateway de pagamento; a tela mostra só o período vigente, sem valores.',
    remediation:
      'Conferir no gateway se a assinatura do log existe; se for instabilidade, recarregar em instantes.',
    retriable: true,
  },
  'thinkzap.subscription.plan_price_invalid': {
    category: 'config',
    userCause:
      'O preço configurado de um plano não pôde ser calculado; o plano ficou fora da oferta ou aparece sem valor.',
    remediation:
      'Acionar o time responsável para revisar o price do plano no gateway (modo de cobrança ou faixas não suportados).',
    retriable: false,
  },
  'thinkzap.gateway.quantity_divergence': {
    category: 'internal',
    userCause:
      'Observabilidade — o gateway cobra uma quantidade de linhas diferente das linhas ativas no CRM; nada foi criado nem cancelado.',
    remediation:
      'Reconciliar à mão: comparar a quantidade do item no gateway com as linhas ativas na SPA 1146 e ajustar o lado errado.',
    retriable: false,
  },
  'thinkzap.message.widget_timeline_stamp_failed': {
    category: 'internal',
    userCause:
      'Observabilidade — o comentário do envio foi publicado na timeline, mas a marca que evita repeti-lo não foi gravada.',
    remediation:
      'Nenhuma ação; se o envio for retentado, o comentário pode aparecer duplicado na timeline.',
    retriable: false,
  },
  'thinkzap.message.open_channel_guard_failed': {
    category: 'internal',
    userCause:
      'Observabilidade — a proteção contra abrir a mesma conversa duas vezes no canal aberto falhou para uma mensagem.',
    remediation:
      'Nenhuma ação; no pior caso a mesma mensagem aparece duas vezes no chat do canal aberto.',
    retriable: false,
  },
  'thinkzap.message.button_action_post_failed': {
    category: 'integration',
    userCause:
      'A mensagem com botões não pôde ser postada no canal aberto; nada foi enviado ao contato.',
    remediation:
      'Conferir se o operador ainda participa do chat e se o app tem escopo `im`; reenviar pela tela.',
    retriable: true,
    httpStatus: 502,
  },
} as const satisfies Record<string, ErrorMeta>

export type ThinkzapErrorCode = keyof typeof THINKZAP_ERRORS

const catalog = makeErrorCatalog(THINKZAP_ERRORS)
export const thinkzapError = catalog.appError
export const logThinkzapError = catalog.logError
