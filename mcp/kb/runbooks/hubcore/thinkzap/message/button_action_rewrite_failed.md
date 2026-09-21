---
category: internal
audience: dev
summary: Observabilidade — o código de envio de botões não foi trocado por um texto legível na timeline.
---
# thinkzap.message.button_action_rewrite_failed

## O que significa
Registro de observabilidade. Depois que o envio de botões da tela do canal aberto já foi confirmado ao contato, o app thinkzap tenta trocar o código bruto (`##THINKZAP_BUTTON_ACTION##...`) postado na timeline do operador por um texto legível. Este código indica apenas que essa troca falhou — o envio ao contato não é afetado, só o texto que fica visível na timeline do Bitrix para o operador. Não requer ação de suporte.

## Como verificar
1. Na tela de Logs do app thinkzap, filtre pelo `traceKey` do ticket.
2. Confirme `código de erro: thinkzap.message.button_action_rewrite_failed`.
3. Leia o motivo registrado na linha do log para fins de diagnóstico.

Não requer ação de suporte. Se aparecer de forma recorrente, encaminhe para a equipe de desenvolvimento avaliar as permissões do app no Bitrix24 para editar mensagem de outro usuário, anexando `traceKey`, código de erro e horário.
