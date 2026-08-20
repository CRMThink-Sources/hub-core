---
category: integration
audience: suporte
summary: A criação da linha não retornou os dados de conexão; nada foi cobrado.
---
# thinkzap.provisioning.credential_missing

## O que significa
O app thinkzap pediu a criação de uma nova linha, mas a resposta voltou sem os dados de conexão que a linha precisa para funcionar. Sem esses dados, a linha não fica utilizável. Isso costuma ser uma condição temporária da criação, e pode ser retentado. Importante: nada foi cobrado por conta desta falha.

## Causa provável
- **Resposta incompleta na criação**: o provisionamento retornou sem os dados de conexão esperados.
- **Instabilidade momentânea**: uma oscilação no momento da criação da linha.

## Como verificar
1. Na tela de Logs do app thinkzap, filtre pelo `traceKey` do ticket.
2. Confirme `código de erro: thinkzap.provisioning.credential_missing`.
3. Veja no log o momento da criação e se os dados de conexão vieram ausentes.

## Como resolver
1. Aguarde alguns instantes e peça para tentar criar a linha novamente.
2. Tranquilize o parceiro de que nada foi cobrado por esta falha.
3. Confirme na tela de Logs que a nova tentativa não repete o erro.

## Quando escalar
Se a criação continuar retornando sem os dados de conexão após novas tentativas, acione a equipe de desenvolvimento. Anexe: `traceKey`, `código de erro: thinkzap.provisioning.credential_missing`, domínio do parceiro, o e-mail da conta e o horário do evento.
