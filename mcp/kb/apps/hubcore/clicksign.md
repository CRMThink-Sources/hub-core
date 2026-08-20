# App: Clicksign

## O que é (nível suporte)
Integração de assinatura eletrônica entre o Bitrix24 do cliente e a Clicksign.
O cliente envia documentos para assinatura a partir do Bitrix24 e recebe de volta
o status (assinado/recusado).

> Este contexto é apoio interno de triagem. Não descreva arquitetura, fluxo
> interno ou "como funciona por dentro" para o solicitante — só use para
> identificar o modo de falha e guiar a resolução do erro.

## Modos de falha comuns (para triar)
- **Retorno de status recusado por segredo divergente** → `clicksign.webhook.signature_invalid`
  (o segredo cadastrado no app não bate com o da Clicksign).
- **Segredo de retorno não configurado** → `clicksign.webhook.secret_missing`.
- **Arquivo ausente no envio** → `clicksign.envelope.file_missing`.
- **Falha ao falar com a Clicksign** (rede, credencial, limite da conta) →
  `clicksign.api.request_failed`.

## Dicas de triagem
- Erro de retorno de status geralmente é config do cliente (segredo), não bug.
- Erro de envio geralmente é dado faltando no Bitrix24 (arquivo/signatário).
- Para falha na Clicksign, leia no log o status/mensagem que ela devolveu — é o que
  diz o motivo real (credencial, conta ou dado).
- Sempre peça o `traceKey` da tela de Logs para localizar o evento exato.
