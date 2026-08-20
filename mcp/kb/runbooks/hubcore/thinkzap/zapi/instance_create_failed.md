---
category: integration
audience: suporte
summary: A z-api não conseguiu criar a linha de WhatsApp solicitada.
---
# thinkzap.zapi.instance_create_failed

## O que significa
Para operar um WhatsApp não-oficial (a linha conectada por QR Code), o app thinkzap pede à z-api que crie a linha. Neste caso a z-api recusou ou não respondeu esse pedido, então a linha não foi criada. É uma falha na integração externa com a z-api, geralmente passageira ou ligada a status/credenciais do serviço.

## Causa provável
- **Instabilidade da z-api**: o serviço estava indisponível ou lento no momento.
- **Status ou credenciais da z-api**: a conta na z-api pode estar com problema de status ou de credencial.
- **Limite atingido**: a conta na z-api pode ter chegado ao limite de linhas do plano.

## Como verificar
1. Na tela de Logs do app thinkzap, filtre pelo `traceKey` do ticket.
2. Confirme `código de erro: thinkzap.zapi.instance_create_failed`.
3. Leia na linha do log o status e a mensagem que a z-api devolveu — é o ponto de partida para saber se foi instabilidade, credencial ou limite.

## Como resolver
1. Peça ao parceiro para tentar criar a linha novamente em alguns instantes (o erro costuma ser passageiro).
2. Se persistir, verifique o status da z-api e se as credenciais/o plano estão em ordem, usando a mensagem do log como pista.
3. Após a z-api normalizar, peça para repetir a criação e confirme na tela de Logs que o erro não aparece mais.

## Quando escalar
Se a criação continuar falhando mesmo com a z-api aparentemente normal, acione a equipe de desenvolvimento. Anexe: `traceKey`, `código de erro: thinkzap.zapi.instance_create_failed`, domínio do parceiro, o horário do evento e a mensagem/status devolvidos pela z-api.
