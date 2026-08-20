---
category: integration
audience: suporte
summary: O aviso de falha de envio não pôde ser publicado na timeline do CRM.
---
# thinkzap.message.widget_send_notice_failed

## O que significa
Um envio pelo widget terminou mal (`widget_send_exhausted` ou `widget_send_unknown`) e o sistema tentou avisar o operador com um comentário na timeline da entidade do CRM — mas a publicação do comentário falhou.

**Este é o erro mais silencioso do fluxo:** o envio já tinha dado errado, e agora o aviso também se perdeu. O operador não sabe de nada. O desfecho continua registrado no log, mas ninguém no portal do parceiro foi informado.

Aparece sempre acompanhado do código do desfecho original, com o mesmo `traceKey`.

## Causa provável
- **Permissões de CRM insuficientes** para o app no Bitrix24 (`crm.timeline.comment.add`).
- **Entidade apagada** entre o envio e o aviso: o deal/contato/lead não existe mais.
- Bitrix24 indisponível no momento da publicação.

## Como verificar
1. Filtre pelo `traceKey` na tela de Logs e localize os **dois** registros: o desfecho do envio e esta falha do aviso.
2. Leia `entity` e `entityId` — é a entidade onde o comentário deveria ter aparecido.
3. Confirme no Bitrix24 do parceiro se aquela entidade ainda existe.
4. Confira as permissões de CRM do app na instalação.

## Como resolver
1. **Avise o parceiro manualmente** sobre a mensagem que não foi entregue — é a parte que não pode esperar. Use os dados do log do desfecho original (`destination` e o texto).
2. Se for permissão: orientar a reinstalar ou reautorizar o app para restaurar o escopo de CRM.
3. Se a entidade foi apagada: nenhuma ação além do aviso manual.

## Quando escalar
Se as permissões estão corretas, a entidade existe e a publicação continua falhando, acione a equipe de desenvolvimento. Anexe: `traceKey`, os dois códigos de erro, domínio/portal, `entity` e `entityId`.
