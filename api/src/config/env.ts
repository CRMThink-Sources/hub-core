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

// `API_URL` já termina em `/api` em parte dos ambientes, e concatenar produzia
// `/api/api/webhooks/bitrix-bot`. Endereço errado é caro: `Bot.register` não atualiza
// em chamada repetida, e o bot fica registrado apontando para o vazio.
export function bitrixBotWebhookFromApiUrl(apiUrl: string | undefined): string {
  if (!apiUrl) return ''

  const base = apiUrl.replace(/\/+$/, '')
  const prefixo = base.endsWith('/api') ? '' : '/api'

  return `${base}${prefixo}/webhooks/bitrix-bot`
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
  // Isola as filas por ambiente: staging e produção no mesmo Redis compartilhariam
  // `bull:thinkzap-inbound:*` e um worker consumiria job do outro. Default `'bull'` é o
  // do BullMQ; trocar o valor troca de fila, então só com fila drenada.
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
  // Para onde serviços externos devolvem o navegador (checkout, portal, OAuth). Cai em
  // `APP_URL` porque no deploy padrão front e api saem do mesmo host; `FRONT_URL` existe
  // para o caso de estarem separados. Fallback aqui, não em cada consumidor: esquecê-lo
  // produzia URL relativa, que o gateway recusa longe da causa.
  frontUrl: process.env.FRONT_URL ?? process.env.APP_URL ?? '',
  crmthinkWebhookUrl: process.env.CRMTHINK_WEBHOOK_URL ?? '',
  // Único fator de autenticação de `POST /api/webhooks/spa` — o webhook de saída do
  // Bitrix não assina o corpo. Vazio desabilita a rota (503); aceitar sem token faria
  // dela um botão público de esvaziar o cache do módulo `payments`.
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
    // Separado do webhook do conector (`ONIMCONNECTOR*`): shape diferente, e o do bot
    // chega com todo escalar como string (`http_build_query`).
    botWebhookUrl:
      process.env.BITRIX_BOT_WEBHOOK_URL ??
      bitrixBotWebhookFromApiUrl(process.env.API_URL),
    /**
     * `code` do bot do ThinkBot no portal.
     *
     * Configurável porque o `code` é único **no portal**, e não por app: dois ambientes
     * nossos apontados para o mesmo Bitrix24 disputam o mesmo nome, e o segundo a
     * registrar leva `BOT_CODE_ALREADY_TAKEN` — `imbot.v2.Bot.register` só é idempotente
     * para o app que registrou. Produção fica no default; dev e homolog sobrescrevem.
     */
    botFlowCode: process.env.BITRIX_BOT_FLOW_CODE ?? 'thinkzap-flow',
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
    // Mesmo esquema do widget de áudio, outro ícone no textarea do canal aberto.
    // Sem `hash` própria: reaproveita `iframeAudio.hash`, o segredo de validação
    // do iframe imbot — não é específico do widget de áudio.
    iframeButton: {
      code: process.env.BITRIX_IFRAME_BUTTON_CODE ?? 'thinkzap_button',
      name: process.env.BITRIX_IFRAME_BUTTON_NAME ?? 'ThinkZap Botões',
      url: process.env.BITRIX_IFRAME_BUTTON_URL ?? '',
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
    // `handlerUrl` vazio deixa o robô fora do portal (registro vira no-op), para que
    // ambiente sem a rota publicada não crie automação apontando para 404.
    // `placementUrl` vazio registra o robô sem tela própria: cai no formulário nativo.
    templateRobot: {
      code: process.env.BITRIX_TEMPLATE_ROBOT_CODE ?? 'thinkzap_template_robot',
      name:
        process.env.BITRIX_TEMPLATE_ROBOT_NAME ??
        'ThinkZap - Enviar template (WhatsApp Oficial)',
      handlerUrl: process.env.BITRIX_TEMPLATE_ROBOT_HANDLER_URL ?? '',
      placementUrl: process.env.BITRIX_TEMPLATE_ROBOT_PLACEMENT_URL ?? '',
    },
    /**
     * Dois robôs de botão — um por provider, mesmo `handlerUrl`/`placementUrl` vazio
     * = fora do portal do jeito que `templateRobot` já faz. `NAME` em env (e não
     * hardcoded) porque a copy que o operador vê na lista de robôs do Bitrix ainda
     * não foi validada com o time — trocar sem redeploy até a decisão assentar.
     */
    buttonRobotOfficial: {
      code:
        process.env.BITRIX_BUTTON_ROBOT_OFFICIAL_CODE ??
        'thinkzap_button_robot_official',
      name:
        process.env.BITRIX_BUTTON_ROBOT_OFFICIAL_NAME ??
        'ThinkZap - Enviar botões (WhatsApp Oficial)',
      handlerUrl: process.env.BITRIX_BUTTON_ROBOT_OFFICIAL_HANDLER_URL ?? '',
      placementUrl:
        process.env.BITRIX_BUTTON_ROBOT_OFFICIAL_PLACEMENT_URL ?? '',
    },
    buttonRobotUnofficial: {
      code:
        process.env.BITRIX_BUTTON_ROBOT_UNOFFICIAL_CODE ??
        'thinkzap_button_robot_unofficial',
      name:
        process.env.BITRIX_BUTTON_ROBOT_UNOFFICIAL_NAME ??
        'ThinkZap - Enviar botões (Z-API)',
      handlerUrl: process.env.BITRIX_BUTTON_ROBOT_UNOFFICIAL_HANDLER_URL ?? '',
      placementUrl:
        process.env.BITRIX_BUTTON_ROBOT_UNOFFICIAL_PLACEMENT_URL ?? '',
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
  /**
   * Liga a identidade por LID no canal aberto de linha Z-API.
   *
   * **Desligada por padrão de propósito.** A troca de identidade não pode acontecer
   * antes do backfill: trocar o `chat.id` de um contato faz o Bitrix abrir uma conversa
   * nova para quem já tem uma, e o `imconnector` não oferece remapear. A ordem é
   * deployar desligada (o mapa começa a aprender os pares sem mudar comportamento
   * nenhum), rodar o backfill, e só então ligar.
   *
   * Desligar de volta é o rollback: o mapa e os pares aprendidos ficam, e não atrapalham.
   */
  thinkzapZApiLidIdentity: process.env.THINKZAP_ZAPI_LID_IDENTITY === 'true',
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
      // Item por instalação de app, espelho de `core_apps`. Mesmo `entityTypeId` que o
      // onboarding chama de `SPA_CLIENT` (`shared/domain/config/bitrix.env.ts`).
      aplicationEntityType: 1060,
      // O que uma assinatura provisiona, na prática um conector. Sem campo de provider:
      // o par de credenciais preenchido diz qual é (ver `subscription-item.mapper.ts`).
      subscriptionItemEntityType: 1146,
      /**
       * Liga os efeitos de provider dos eventos das SPAs 1146 e 1142 — provisionar,
       * assinar, desassinar, limpar.
       *
       * Existe porque produção e homologação compartilham o portal, e o portal tem um
       * webhook de saída para cada API: sem isto, o mesmo item criado no CRM provisiona
       * duas instâncias, e homologação desassina recurso de cliente de produção.
       *
       * **Ligada por padrão**, e só o literal `'false'` desliga: desligar por engano em
       * produção é linha que não provisiona; ligar por engano em homologação é o bug que
       * isto corrige. Homologação seta `false`.
       */
      providerEffectsEnabled:
        process.env.THINKZAP_SPA_PROVIDER_EFFECTS_ENABLED !== 'false',
    },
    // Item de plano na SPA 1138 que as assinaturas de trial referenciam. É configuração,
    // não dado de runtime: `PlanRepository` é só leitura, e `getPlan` lança quando o item
    // não existe — derrubando a lista de linhas da instalação inteira. Vazio = trial
    // indisponível, reportado como motivo próprio pela rota de estado.
    trialPlanId: process.env.THINKZAP_TRIAL_PLAN_ID ?? '',
    // Vazio = contratação self-service indisponível; a modalidade manual segue inteira
    // (criada na SPA por automação externa). `webhookSecret` valida a assinatura sobre o
    // corpo cru — sem ele o handler recusa o evento, senão um
    // `checkout.session.completed` forjado destravaria linha sem pagamento.
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
  // `jwtSecret` é dedicado, distinto de JWT_SECRET: o token do portal é assinado sem
  // `expiresIn`, e reusar o segredo deixaria um token eterno ser aceito no /mcp. URLs
  // de env explícita, nunca de req.host: o issuer entra no `aud` e no redirect_uri.
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
