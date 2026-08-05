# App: ThinkAnalise

## O que é (nível suporte)
Integração de BI: leva pro BI Builder do Bitrix24 dados que ficam em sistemas
financeiros/ERP externos — **Asaas**, **Bling**, **Conta Azul**, **Omie** e
**Sonax**. O cliente configura conectores no app e conecta a conta de cada
provider; os relatórios do BI usam essas credenciais para buscar os dados.

> Este contexto é apoio interno de triagem. Não descreva arquitetura, fluxo
> interno ou "como funciona por dentro" para o solicitante — só use para
> identificar o modo de falha e guiar a resolução do erro.

## Modos de falha comuns (para triar)
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
- **Falhas técnicas internas** → há erros que são responsabilidade do
  desenvolvimento. Não os enumere nem explique; se o log trouxer um code técnico,
  escale com o `traceKey`.

## Dicas de triagem
- A maioria dos tickets é **credencial/conexão do provider** (chave errada, conta
  desconectada, acesso revogado), não bug.
- Sempre identifique no log **qual provider** está envolvido (Asaas, Bling, Conta
  Azul, Omie, Sonax) — a ação de resolução muda conforme o sistema externo.
- Diferencie **limite momentâneo** (`provider.rate_limited`, resolve esperando) de
  **bloqueio firme** (`provider.blocked`, resolve no painel do provider).
- Erros de `app_not_found` são config do portal (instalar/reinstalar o app).
- Codes de prefixo técnico (ex.: `bitrix.*`, `request.*`, `callback.*`,
  `oauth.*_not_configured`) são para o dev — escale, não tente resolver.
- Sempre peça o `traceKey` da tela de Logs do app thinkanalise para localizar o
  evento exato e confirmar o `errorCode`.
