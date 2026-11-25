# Proposal

## Why

Clientes querem usar na API Oficial um número que já está no app WhatsApp Business,
atendendo pelo celular **e** pelo Bitrix24, com toda a conversa no chat. Hoje a
conexão envia sempre `coexistence: false` à HubMessage, e toda mensagem marcada
como da própria empresa (`from_me`) é descartada.

## What Changes

- A conexão do WhatsApp Oficial passa a repassar à HubMessage se o número entrou em
  coexistência, como o SDK `@omnizapi/connect` informa, nas duas rotas de conexão.
- Conexão em coexistência é aceita mesmo quando o retorno não traz o id do telefone.
- A aba de conexão avisa antes de conectar: nem todo número é elegível; o app precisa
  ser aberto ao menos a cada 15 dias; o WhatsApp Desktop para Windows não funciona; o
  WhatsApp Web é desconectado e pode ser reconectado.
- Mensagens enviadas pelo app do celular aparecem no canal aberto, automaticamente
  (sem chave por linha), identificadas como enviadas pelo aparelho. Mensagem para um
  contato sem conversa **abre a conversa**.
- A cópia espelhada nunca é reenviada ao WhatsApp, duplicada nem respondida por fluxo
  de bot do ThinkZap.

**Condicionante:** a documentação da HubMessage não informa se as mensagens enviadas
pelo app chegam ao webhook. Isso é verificado com um número real antes de implementar
o espelhamento; se não chegarem, o espelhamento para e a conexão segue sozinha.

## Capabilities

### New Capabilities

- `thinkzap/coexistencia-whatsapp-oficial`: conexão de número em coexistência na linha
  oficial e espelhamento no canal aberto das mensagens enviadas pelo app.

### Modified Capabilities

Nenhuma.

## Impact

- **API**: `connect-official-line.ts`, `connect-line-channel.controller.ts`,
  `connect-channel.controller.ts`, webhook da HubMessage, worker de entrada, novo caso
  de uso de espelhamento, worker de saída (guard anti-loop) e processador de bot.
- **Front**: `connect-hubmessage-channel.ts`, `conexao-oficial-tab.tsx` e textos
  pt/en/es.
- **HubMessage**: possivelmente novos eventos no webhook de canal (script
  `hubmessage:sync-channel-webhook-events` para canais existentes).
- **Banco**: sem mudança.
- **Fora do escopo**: importar o histórico anterior do celular, edição e remoção
  feitas no celular, e contar envios do celular em limite diário ou cadência.
