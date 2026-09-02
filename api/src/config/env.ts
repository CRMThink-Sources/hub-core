import 'dotenv/config'

/**
 * Ambiente do gateway de pagamento: qual conta Stripe as credenciais em uso
 * apontam.
 *
 * Existe porque produção e homologação compartilham o **mesmo portal Bitrix** —
 * `CRMTHINK_WEBHOOK_URL` é o mesmo valor nos dois — e portanto a mesma SPA de
 * planos. O price id, porém, é por conta: o de teste não existe na conta live e
 * vice-versa. É este valor que diz qual dos dois campos de price id do plano o
 * mapper lê.
 */
export type StripeEnvironment = 'production' | 'homolog'

/**
 * Chave **live** é o que define produção. Qualquer outro valor — `sk_test_`,
 * `rk_test_`, vazio, malformado — resolve `homolog`.
 *
 * Não é derivado de `NODE_ENV` de propósito: `.env.local` deste projeto tem
 * `NODE_ENV=production` com `sk_test_`, e sob `NODE_ENV` esse arquivo leria o price
 * id de produção para mandá-lo à conta de teste. Derivar da própria chave torna o
 * descasamento inexpressável — a mesma string que decide qual conta é chamada
 * decide qual price id é lido.
 *
 * `rk_` entra junto de `sk_` porque a restricted key é aceita pelo gateway
 * (`StripeWrongKeyTypeError` recusa só a publicável): tratar `rk_live_` como
 * homologação faria a produção ler o price de teste.
 *
 * Default fechado em `homolog`: chave vazia já significa checkout indisponível, e
 * nesse estado ler o campo de produção não tem utilidade e tem risco.
 */
export function resolveStripeEnvironment(
  secretKey: string | undefined,
): StripeEnvironment {
  return /^(sk|rk)_live_/.test(secretKey ?? '') ? 'production' : 'homolog'
}

/** Page size do worker: clamp [1,50] (50 = teto de comandos do batch Bitrix). */
function parsePageSize(raw: string | undefined): number {
  const n = Number(raw)
  if (!Number.isFinite(n)) return 20
  return Math.min(50, Math.max(1, Math.trunc(n)))
}

export const env = {
  nodeEnv: process.env.NODE_ENV ?? 'development',
  logLevel: process.env.LOG_LEVEL ?? 'info',
  // Quando setado, pino envia direto pro Loki (dev local com yarn dev, sem promtail).
  lokiUrl: process.env.LOKI_URL ?? '',
  // Leitura do Loki (query_range) pela aba Logs; distinto do push do pino acima.
  lokiQueryUrl: process.env.LOKI_QUERY_URL ?? 'http://localhost:3100',
  appUrl: process.env.APP_URL ?? '',
  port: Number(process.env.PORT ?? 4000),
  databaseUrl: process.env.DATABASE_URL ?? '',
  redisUrl: process.env.REDIS_URL ?? '',
  /**
   * Prefixo das chaves do BullMQ — o que isola as filas de um ambiente das do outro.
   *
   * Sem ele, staging e produção apontando para o mesmo Redis compartilham
   * `bull:thinkzap-inbound:*`: o worker de staging consome a mensagem de um cliente e
   * a derruba contra o banco de homologação, e um envio de teste em staging pode ser
   * entregue pelo worker de produção, com credencial de produção. Aconteceu.
   *
   * Default `'bull'` é o próprio default do BullMQ: ambiente que não setar a variável
   * segue lendo e escrevendo exatamente onde já lia. **Trocar o valor troca de fila** —
   * o que estiver enfileirado no prefixo antigo fica órfão, então só com fila drenada.
   */
  queuePrefix: process.env.QUEUE_PREFIX ?? 'bull',
  bullBoard: {
    enabled: process.env.BULL_BOARD_ENABLED === 'true',
    username: process.env.BULL_BOARD_USERNAME ?? '',
    password: process.env.BULL_BOARD_PASSWORD ?? '',
  },
  apiUrl:
    process.env.API_URL && process.env.API_URL !== 'undefined'
      ? process.env.API_URL
      : 'https://homolog-hubthink.crmthink.com.br/api',
  /**
   * URL pública do front, para onde serviços externos devolvem o navegador —
   * retorno de checkout, portal de faturamento e callbacks de OAuth.
   *
   * Cai em `APP_URL` quando não definida: no deploy padrão front e api saem do mesmo
   * host, com `/api/*` roteado para a api, então `APP_URL` já é o endereço do front.
   * `FRONT_URL` existe para o caso de estarem separados.
   *
   * O fallback vive aqui, e não em cada consumidor, porque estava sendo repetido
   * como `env.frontUrl || env.appUrl` em uns lugares e esquecido em outros — e
   * esquecer produzia URL relativa, que o gateway recusa longe da causa.
   */
  frontUrl: process.env.FRONT_URL ?? process.env.APP_URL ?? '',
  crmthinkWebhookUrl: process.env.CRMTHINK_WEBHOOK_URL ?? '',
  /**
   * Application token do webhook de saída das SPAs de billing, copiado da tela do
   * webhook no portal interno. É o **único** fator de autenticação de
   * `POST /api/webhooks/spa`: o webhook de saída do Bitrix não assina o corpo, então
   * não há HMAC a validar como no Stripe.
   *
   * Vazio **desabilita** a rota (503). Aceitar o POST por falta de configuração
   * transformaria a rota num botão público de esvaziar o cache do módulo `payments`.
   */
  bitrixSpaWebhookToken: process.env.BITRIX_SPA_WEBHOOK_TOKEN ?? '',
  tokenEncryptionKey: process.env.TOKEN_ENCRYPTION_KEY ?? '',
  zApi: {
    partnerToken: process.env.Z_API_PARTNER_TOKEN ?? '',
    clientToken: process.env.Z_API_CLIENT_TOKEN ?? '',
    callbackUrl: process.env.Z_API_CALLBACK_URL ?? '',
  },
  /**
   * Credencial do GPT Maker, **compartilhada por todas as instalações**.
   *
   * Não existe token por cliente: todos os agentes são criados no mesmo
   * workspace, porque a cobrança é por créditos e não pelo workspace do
   * cliente. A consequência é que o vendor não distingue instalação — quem
   * separa um cliente do outro é `core_gpt_agents`, e por isso o acesso a um
   * agente só acontece pelo cliente escopado (`forAgent`).
   *
   * Vazio derruba toda criação de agente. O módulo sobe assim de propósito: o
   * resto do hub-core não deve deixar de subir por causa de uma app.
   */
  gptMaker: {
    apiToken: process.env.GPTMAKER_API_TOKEN ?? '',
    workspaceId: process.env.GPTMAKER_WORKSPACE_ID ?? '',
    baseUrl: process.env.GPTMAKER_BASE_URL ?? 'https://api.gptmaker.ai/v2',
  },
  hubMessage: {
    publicKey: process.env.HUBMESSAGE_PUBLIC_KEY ?? '',
    secretKey: process.env.HUBMESSAGE_SECRET_KEY ?? '',
    baseUrl: process.env.HUBMESSAGE_BASE_URL ?? 'https://api.hubmessage.io',
    webhookUrl: process.env.HUBMESSAGE_WEBHOOK_URL ?? '',
  },
  google: {
    clientId: process.env.GOOGLE_CLIENT_ID ?? '',
    clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? '',
    authUrl:
      process.env.GOOGLE_AUTH_URL ??
      'https://accounts.google.com/o/oauth2/v2/auth',
    tokenUrl:
      process.env.GOOGLE_TOKEN_URL ?? 'https://oauth2.googleapis.com/token',
    userInfoUrl:
      process.env.GOOGLE_USERINFO_URL ??
      'https://www.googleapis.com/oauth2/v3/userinfo',
    sheetsApiUrl:
      process.env.GOOGLE_SHEETS_API_URL ?? 'https://sheets.googleapis.com/v4',
  },
  contaAzul: {
    ClientId: process.env.CONTA_AZUL_CLIENT_ID ?? '',
    ClientSecret: process.env.CONTA_AZUL_CLIENT_SECRET ?? '',
    AuthUrl:
      process.env.CONTA_AZUL_AUTH_URL ??
      'https://auth.contaazul.com/oauth2/authorize',
    TokenUrl:
      process.env.CONTA_AZUL_TOKEN_URL ??
      'https://auth.contaazul.com/oauth2/token',
    ApiUrl: process.env.CONTA_AZUL_API_URL ?? 'https://api-v2.contaazul.com/v1',
  },
  omie: {
    apiUrl: process.env.OMIE_API_URL ?? 'https://app.omie.com.br/api/v1',
  },
  bling: {
    ClientId: process.env.BLING_CLIENT_ID ?? '',
    ClientSecret: process.env.BLING_CLIENT_SECRET ?? '',
    AuthUrl:
      process.env.BLING_AUTH_URL ??
      'https://www.bling.com.br/Api/v3/oauth/authorize',
    TokenUrl:
      process.env.BLING_TOKEN_URL ??
      'https://www.bling.com.br/Api/v3/oauth/token',
    ApiUrl: process.env.BLING_API_URL ?? 'https://api.bling.com.br/Api/v3',
  },
  bitrix: {
    webhookUrl:
      process.env.BITRIX_WEBHOOK_URL ??
      (process.env.API_URL ? `${process.env.API_URL}/api/webhooks/bitrix` : ''),
    connector: {
      code: process.env.BITRIX_CONNECTOR_CODE ?? 'hubthink_thinkzap',
      name: process.env.BITRIX_CONNECTOR_NAME ?? 'ThinkZap',
      url: process.env.BITRIX_CONNECTOR_URL ?? '',
    },
    iframeAudio: {
      code: process.env.BITRIX_IFRAME_AUDIO_CODE ?? 'thinkzap_audio',
      name: process.env.BITRIX_IFRAME_AUDIO_NAME ?? 'ThinkZap Audio',
      url: process.env.BITRIX_IFRAME_AUDIO_URL ?? '',
      hash: process.env.BITRIX_IFRAME_AUDIO_HASH ?? '',
    },
    placement: {
      name: process.env.BITRIX_PLACEMENT_NAME ?? 'ThinkZap',
      url: process.env.BITRIX_PLACEMENT_URL ?? '',
    },
    robot: {
      code: process.env.BITRIX_ROBOT_CODE ?? 'thinkzap_robot',
      name: process.env.BITRIX_ROBOT_NAME ?? 'ThinkZap Robot',
      handlerUrl: process.env.BITRIX_ROBOT_HANDLER_URL ?? '',
    },
    /**
     * Robô de envio de **template aprovado**, separado do de envio livre.
     *
     * `handlerUrl` vazio deixa o robô fora do portal — o registro vira no-op, e é
     * assim que um ambiente sem a rota publicada não cria automação apontando para
     * `404`. `placementUrl` vazio registra o robô **sem** a tela própria: o Bitrix cai
     * no formulário nativo sobre as mesmas propriedades, feio mas funcional.
     */
    templateRobot: {
      code: process.env.BITRIX_TEMPLATE_ROBOT_CODE ?? 'thinkzap_template_robot',
      name:
        process.env.BITRIX_TEMPLATE_ROBOT_NAME ??
        'ThinkZap - Enviar template (WhatsApp Oficial)',
      handlerUrl: process.env.BITRIX_TEMPLATE_ROBOT_HANDLER_URL ?? '',
      placementUrl: process.env.BITRIX_TEMPLATE_ROBOT_PLACEMENT_URL ?? '',
    },
    /**
     * Provedor de mensagem (`messageservice`) que a campanha de SMS do Bitrix usa
     * como canal de saída.
     *
     * `codePrefix` monta o `CODE` do sender junto com o id do item de assinatura da
     * linha (`<prefixo>_<subscriptionItemId>`) — é o único identificador nosso que
     * volta no payload do handler, e portanto o que reencontra a linha.
     *
     * `handlerUrl` vazio deixa o registro como no-op, pela mesma razão do robô: um
     * ambiente sem a rota publicada não pode registrar no portal do cliente um
     * provedor apontando para `404`.
     */
    smsSender: {
      codePrefix: process.env.BITRIX_SMS_SENDER_CODE_PREFIX ?? 'thinkzap_sms',
      handlerUrl: process.env.BITRIX_SMS_HANDLER_URL ?? '',
    },
    /** false only in local dev (e.g. SSL-inspecting proxy). Set BITRIX_TLS_REJECT_UNAUTHORIZED=false */
    tlsRejectUnauthorized:
      process.env.BITRIX_TLS_REJECT_UNAUTHORIZED !== 'false',
  },
  appCodes: {
    thinkzap: process.env.THINKZAP_APP_CODE ?? 'crmthink.thinkzap',
    thinkanalise: process.env.THINKANALISE_APP_CODE ?? 'crmthink.thinkanalise',
    importsheet: process.env.IMPORTSHEET_APP_CODE ?? 'crmthink.importsheet',
    clicksign: process.env.CLICKSIGN_APP_CODE ?? 'crmthink.clicksign',
    gptmaker: process.env.GPTMAKER_APP_CODE ?? 'crmthink.gptmaker',
  },
  importsheet: {
    // Linhas por ciclo (round-robin). Default 20, teto 50 (batch Bitrix).
    pageSize: parsePageSize(process.env.IMPORTSHEET_PAGE_SIZE),
    // Pausa entre páginas p/ ficar sob o limite do Bitrix. Default 500ms; 0 desliga.
    pageDelayMs: Math.max(
      0,
      Number(process.env.IMPORTSHEET_PAGE_DELAY_MS ?? 500) || 0,
    ),
  },
  thinkzapMockZApiProvisioning:
    process.env.THINKZAP_MOCK_ZAPI_PROVISIONING === 'true' ||
    (process.env.NODE_ENV === 'local' &&
      process.env.THINKZAP_MOCK_ZAPI_PROVISIONING !== 'false'),
  clicksign: {
    robot: {
      code: process.env.CLICKSIGN_ROBOT_CODE ?? 'ENVIAR_DOCUMENTO',
      name: process.env.CLICKSIGN_ROBOT_NAME ?? 'Enviar documento',
    },
  },
  payments: {
    spa: {
      productEntityType: 1134,
      planEntityType: 1138,
      subscriptionEntityType: 1142,
      /**
       * SPA de aplicação — o item por instalação de app (domínio + app code),
       * espelho de `core_apps`. Existe para montar o nome do campo parent
       * (`parentId1060`) num lugar só, em vez de espalhar a string literal pelo
       * mapper e pelo repositório.
       *
       * Mesmo `entityTypeId` que o onboarding chama de `SPA_CLIENT`
       * (`shared/domain/config/bitrix.env.ts`): o nome de lá é o vocabulário do
       * fluxo de instalação e fica como está.
       */
      aplicationEntityType: 1060,
      /**
       * SPA de itens de assinatura — o que uma assinatura provisiona, na prática
       * um conector. O vínculo com a assinatura é o campo parent
       * (`parentId1142`), montado a partir de `subscriptionEntityType`.
       *
       * Não tem campo de provider: são dois pares de credenciais, e o
       * preenchimento diz qual conector é (ver `subscription-item.mapper.ts`).
       */
      subscriptionItemEntityType: 1146,
    },
    /**
     * Id do item de plano na SPA de planos (1138) que as assinaturas de trial
     * referenciam.
     *
     * `Subscription.plan` é obrigatório e hidratado por `getPlan`, que lança quando
     * o item não existe — e essa exceção sobe pela leitura do contexto, derrubando a
     * lista de linhas da instalação inteira. Por isso é configuração verificada, não
     * dado criado em runtime: `PlanRepository` é só leitura, e criar plano
     * automaticamente exigiria abrir escrita de plano **e** de produto.
     *
     * Vazio = trial indisponível. A rota de estado reporta isso como motivo próprio,
     * em vez de deixar a ativação falhar com erro de hidratação.
     */
    trialPlanId: process.env.THINKZAP_TRIAL_PLAN_ID ?? '',
    /**
     * Credenciais do gateway de pagamento.
     *
     * Vazio = contratação self-service indisponível. A modalidade manual
     * continua funcionando inteira sem isto: ela é criada na SPA por automação
     * externa, e o runtime lê a SPA. Por isso a ausência não derruba nada — só
     * fecha o checkout e o portal de faturamento.
     *
     * `webhookSecret` é usado para validar a assinatura do evento sobre o corpo
     * **cru**. Sem ele qualquer um poderia postar um `checkout.session.completed`
     * forjado e destravar uma linha sem pagar, então o handler recusa o evento
     * quando o segredo não está configurado.
     */
    stripe: {
      secretKey: process.env.STRIPE_SECRET_KEY ?? '',
      webhookSecret: process.env.STRIPE_WEBHOOK_SECRET ?? '',
      /**
       * A conta do gateway que estas credenciais alcançam, e portanto qual campo de
       * price id da SPA de planos vale (ver `resolveStripeEnvironment`).
       */
      environment: resolveStripeEnvironment(process.env.STRIPE_SECRET_KEY),
    },
  },
  /**
   * Authorization Server OAuth 2.1 do MCP de suporte.
   * `jwtSecret` é DEDICADO: distinto de JWT_SECRET porque o token do portal é
   * assinado sem `expiresIn` (nunca expira) — reusar o segredo deixaria um token
   * de portal eterno ser aceito no /mcp.
   * URLs sempre de env explícita, nunca de req.host: o issuer entra no `aud` e no
   * redirect_uri, e host errado faz o claude.ai rejeitar.
   */
  mcpOauth: {
    jwtSecret: process.env.MCP_JWT_SECRET ?? '',
    /** URL pública do api = issuer OAuth. Ex: https://host/api */
    issuerUrl: process.env.MCP_OAUTH_ISSUER_URL ?? '',
    /** URL pública do MCP server (resource). Ex: https://mcp.host */
    mcpServerUrl: process.env.MCP_SERVER_URL ?? '',
    accessTokenTtlSeconds: Number(process.env.MCP_ACCESS_TOKEN_TTL ?? 3600),
    refreshTokenTtlSeconds: Number(
      process.env.MCP_REFRESH_TOKEN_TTL ?? 60 * 60 * 24 * 30,
    ),
    authCodeTtlSeconds: Number(process.env.MCP_AUTH_CODE_TTL ?? 60),
  },
} as const
