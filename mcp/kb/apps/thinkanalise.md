# App: ThinkAnalise

## O que faz
Integração de BI entre o **Bitrix24** do cliente e sistemas financeiros/ERP
externos. O app registra **BI Connectors** no Bitrix24 e serve, pro BI Builder
do portal, os dados que ficam nesses sistemas externos — **Asaas**, **Bling**,
**Conta Azul**, **Omie** e **Sonax**. Quem executa as chamadas às APIs externas
e ao Bitrix24 é o servidor **CRMThink**. Na prática: os relatórios do BI Builder
são montados com dados que o CRMThink puxa dos ERPs em tempo de consulta.

## Fluxos principais
1. **Admin de connectors/sources/datasets**: o cliente cria e edita os conectores
   pela tela do app; o CRMThink grava essas estruturas no Bitrix24 usando os
   métodos `biconnector.connector.*`, `biconnector.source.*` e
   `biconnector.dataset.*`, e persiste os dados do conector no seu próprio banco.
2. **Conexão da conta (OAuth)**: pros providers que exigem conta conectada
   (**Conta Azul** e **Bling**), o cliente autoriza o acesso numa janela popup
   (fluxo OAuth). O CRMThink guarda o token de acesso e o renova sozinho antes de
   vencer. Outros providers (ex.: Asaas) usam **chave de API**.
3. **Callbacks do BI Builder**: quando o BI monta um relatório, o Bitrix24 chama
   o CRMThink (check / data / tables / describe). O CRMThink usa a credencial ou o
   token salvo, busca os dados no ERP correspondente e devolve pro BI.

## Modos de falha comuns
- **Credencial inválida/expirada do provider** → `thinkanalise.credentials.invalid`
  (mais comum; resolve conferindo a chave de API ou reconectando a conta).
- **Conta do provider não conectada** → `thinkanalise.token.not_found`.
- **Renovação automática do acesso falhou** → `thinkanalise.token.refresh_failed`
  (acesso expirou ou foi revogado no provider).
- **Fluxo de conexão OAuth interrompido** → `thinkanalise.oauth.state_invalid_or_expired`
  (janela expirou/reaberta) e `thinkanalise.oauth.code_exchange_failed`
  (código expirado ou já usado).
- **App não instalado no portal** → `thinkanalise.connector.app_not_found`
  (o conector não abre nem salva).
- **Provider limitou/barrou o acesso** → `thinkanalise.provider.rate_limited`
  (limite de requisições) e `thinkanalise.provider.blocked` (consumo/plano).
- **Provider falhou ao entregar dados** → `thinkanalise.provider.data_fetch_failed`
  e, no teste de conexão, `thinkanalise.provider.check_failed`.
- **Falhas internas de gravação** (para dev) → `thinkanalise.bitrix.connector_write_failed`,
  `thinkanalise.bitrix.no_connector_id`, `thinkanalise.bitrix.source_write_failed`,
  `thinkanalise.bitrix.dataset_write_failed` e `thinkanalise.connector.persist_failed`.
- **Eventos de observabilidade** (não fatais) → `thinkanalise.omie.capability_probe_failed`,
  `thinkanalise.sonax.campaigns_unavailable` e `thinkanalise.sonax.campaign_skipped`.

## Dicas de triagem
- A maioria dos tickets de suporte é **credencial/conexão do provider**
  (chave de API errada, conta desconectada, acesso revogado), não bug.
- Sempre identifique no log **qual provider** está envolvido (Asaas, Bling, Conta
  Azul, Omie, Sonax) — a ação de resolução muda conforme o sistema externo.
- Diferencie **limite momentâneo** (`provider.rate_limited`, resolve esperando) de
  **bloqueio firme** (`provider.blocked`, resolve no painel do provider).
- Erros de `app_not_found` são config do portal (instalar/reinstalar o app).
- Erros `bitrix.*`, `request.*`, `callback.*` e `oauth.*_not_configured` são
  técnicos — acione a equipe de desenvolvimento.
- Sempre peça o `traceKey` da tela de Logs do app thinkanalise pra localizar o
  evento exato e confirmar o `errorCode`.
