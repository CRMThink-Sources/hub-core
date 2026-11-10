## ADDED Requirements

### Requirement: Checagem de origem autorizada feita no servidor
O sistema SHALL verificar, no servidor, se a origem da página está na lista de origens liberadas do canal da linha oficial, antes de acionar o SDK de conexão. O navegador NÃO SHALL chamar o endpoint `sdk-info` da Omni para essa checagem. O `channelId` SHALL ser resolvido no servidor a partir do `metadata` do item de assinatura, e NÃO SHALL ser aceito do chamador.

A rota SHALL ser `GET /api/thinkzap/lines/:itemId/connect-origin-check`, receber a origem em `origin`, exigir a permissão `connectors:update` e responder `{ allowed: boolean }`.

#### Scenario: Origem liberada
- **WHEN** o front pergunta sobre uma origem presente em `allowOrigins` do canal (ignorando barra final)
- **THEN** a rota responde `{ allowed: true }` e o SDK é acionado

#### Scenario: Origem não liberada
- **WHEN** `allowOrigins` do canal é não vazio e não contém a origem informada
- **THEN** a rota responde `{ allowed: false }` e a tela mostra a mensagem de origem não autorizada com a origem, sem acionar o SDK

#### Scenario: Lista de origens vazia
- **WHEN** `allowOrigins` vem vazio ou ausente
- **THEN** a rota responde `{ allowed: true }`

#### Scenario: Omni indisponível ou recusando a consulta
- **WHEN** a consulta a `sdk-info` falha por rede, timeout ou resposta diferente de 2xx
- **THEN** a rota responde `{ allowed: true }` e registra o motivo no log, deixando o SDK decidir

#### Scenario: Origem inválida
- **WHEN** `origin` está ausente ou não é uma origem http(s) válida
- **THEN** a rota responde `400` sem consultar a Omni

#### Scenario: Linha de outro provider ou fora da instalação
- **WHEN** o item não é uma linha oficial da instalação do chamador
- **THEN** a rota responde com o mesmo erro de linha usado por `connect-channel` (400 provider incompatível, 404 item fora da instalação)

### Requirement: Conexão da linha sem requisição do navegador a `sdk-info`
A tela de Conexão da linha oficial SHALL manter os desfechos conectado, cancelado, sem configuração, origem não autorizada e retorno incompleto, e SHALL obtê-los sem que o código da aplicação faça `fetch` a `api.omni.z-api.io`. Falha na rede do cliente até a Omni durante a checagem NÃO SHALL impedir a abertura do SDK.

#### Scenario: Rede do cliente não alcança a Omni
- **WHEN** o navegador do cliente alcança o servidor do hub-core mas não alcança `api.omni.z-api.io` durante a checagem
- **THEN** a checagem responde via servidor e o fluxo segue para o SDK sem erro da pré-checagem

#### Scenario: Falha da própria rota de checagem
- **WHEN** a chamada do front à rota de checagem falha por rede ou 5xx
- **THEN** o front segue para o SDK, como no comportamento tolerante atual, em vez de bloquear a conexão
