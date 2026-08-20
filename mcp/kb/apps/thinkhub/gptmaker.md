# App: GPT Maker

## O que é (nível suporte)
Atendimento automático por **agentes de IA** integrado ao Bitrix24: o agente responde
as conversas do cliente (WhatsApp e demais canais conectados), treinado numa **base de
conhecimento** do parceiro. Quando não resolve, **transfere para um atendente humano**;
e registra contatos e negócios no CRM do parceiro. Depende de o parceiro ter o app
instalado, a configuração salva, um **canal** conectado, um **agente** ativo e a **base
de conhecimento** treinada.

> Este contexto é apoio interno de triagem. Não descreva arquitetura, fluxo interno
> ou "como funciona por dentro" para o solicitante — só use para identificar o modo
> de falha e guiar a resolução do erro.

## Modos de falha comuns (para triar)

### Instalação / configuração do parceiro (resolve com o parceiro)
- **App não instalado no portal** → `gptmaker.app.not_installed`.
- **Portal reconhecido, mas usuário sem cadastro** → `gptmaker.app.user_not_found`
  (a instalação cria o vínculo; reinstalar se deveria existir).
- **Configuração do GPT Maker não salva** → `gptmaker.config.not_found`
  (orientar o parceiro a abrir Configurações e salvar).

### Canal de conversa (resolve reconectando)
- **Canal do WhatsApp desconectado** → `gptmaker.channel.disconnected`
  (reconectar lendo o QR Code na tela de Conexão).
- **QR Code expirou antes de parear** → `gptmaker.channel.qr_expired`
  (gerar um novo QR e ler dentro do prazo).
- **Falha ao conectar o canal** → `gptmaker.channel.connect_failed`.

### Agente de IA (resolve no painel do agente)
- **Agente não encontrado ou desativado** → `gptmaker.agent.not_found`
  (conferir se o agente existe e está ativo).
- **Transferência para atendente humano falhou** → `gptmaker.agent.handoff_failed`.

### Base de conhecimento / treinamento (resolve no painel de treino)
- **Base de conhecimento vazia — agente sem contexto** → `gptmaker.training.empty_base`
  (adicionar conteúdo de treino).
- **Não baixou a fonte de treino (site/documento)** → `gptmaker.training.source_fetch_failed`.
- **Falha ao indexar a base de conhecimento** → `gptmaker.training.index_failed`.

### Créditos / plano (resolve na assinatura do parceiro)
- **Sem créditos para o agente responder** → `gptmaker.credits.insufficient`.
- **Limite do plano atingido** → `gptmaker.plan.limit_reached`.

### Falhas de comunicação com sistema externo (tentar de novo; escalar se persistir)
- **Não leu/gravou a configuração no Bitrix24** → `gptmaker.config.load_failed`.
- **Agente não gerou resposta (falha no modelo de IA)** → `gptmaker.agent.generation_failed`.
- **Resposta não saiu para o contato** → `gptmaker.message.send_failed`.
- **Mensagem recebida não foi processada** → `gptmaker.message.receive_failed`.
- **Contato não criado/atualizado no CRM** → `gptmaker.bitrix.contact_sync_failed`.
- **Negócio não criado/atualizado no CRM** → `gptmaker.bitrix.deal_sync_failed`.
- **Ferramenta externa do agente falhou** → `gptmaker.tool.call_failed`.
- **Webhook de integração falhou** → `gptmaker.tool.webhook_failed`.

### Benignos / técnicos (não são bug de config — avaliar antes de escalar)
- **Falha interna não prevista** → `gptmaker.internal.unexpected` (escalar com o traceKey).

## Dicas de triagem
- A maioria dos tickets é **configuração do parceiro** (app não instalado, config não
  salva, canal desconectado) ou **base de conhecimento** (vazia/sem treino) — não bug.
- Erro de o agente "não responder" quase sempre é **canal desconectado**
  (`channel.disconnected`), **base vazia** (`training.empty_base`) ou **sem créditos**
  (`credits.insufficient`) — confira esses três antes de escalar como falha de IA.
- Separe por área: **canal** (conexão), **agente** (IA/handoff), **treino** (base),
  **message** (envio/recebimento) e **bitrix** (sincronização com o CRM). O `errorCode`
  já diz a área.
- Erros de área `credits`/`plan` são **assinatura do parceiro**, não bug: oriente a
  regularizar o plano.
- Codes de área `internal` (ex.: `gptmaker.internal.unexpected`) são para o dev —
  escale, não tente resolver.
- Uma mesma conversa gera eventos separados (recebimento, geração, envio, handoff,
  sincronização); o **id da conversa** liga as fases entre si.
- Sempre peça o `traceKey` da tela de Logs do app gptmaker para localizar o evento exato
  e confirmar o `errorCode`.
