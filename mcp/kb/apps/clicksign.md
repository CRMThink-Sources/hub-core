# App: Clicksign

## O que faz
Integração de assinatura eletrônica entre o Bitrix24 do cliente e a Clicksign.
Permite enviar documentos de negócios/contatos para assinatura e recebe de volta
o status via webhook.

## Fluxos principais
1. **Configuração**: o cliente instala a integração e informa credenciais da
   Clicksign + segredo do webhook nas configurações do app.
2. **Envio de envelope**: a partir de um documento no Bitrix24, o CRMThink monta
   um envelope na Clicksign com o arquivo e os signatários.
3. **Webhook de retorno**: a Clicksign notifica o CRMThink quando o documento é
   assinado/recusado; o CRMThink valida a assinatura HMAC e atualiza o status.

## Modos de falha comuns
- **Assinatura HMAC do webhook inválida** → `clicksign.webhook.signature_invalid`
  (segredo divergente entre Clicksign e CRMThink).
- **Segredo de webhook não configurado** → `clicksign.webhook.secret_missing`.
- **Arquivo ausente no envio** → `clicksign.envelope.file_missing`.
- **Falha na API da Clicksign** (rede, credencial, limite) → erro da API externa.

## Dicas de triagem
- Erro de webhook geralmente é config do cliente (segredo), não bug.
- Erro de envio geralmente é dado faltando no Bitrix24 (arquivo/signatário).
- Sempre peça o `traceKey` da tela de Logs para localizar o evento exato.
