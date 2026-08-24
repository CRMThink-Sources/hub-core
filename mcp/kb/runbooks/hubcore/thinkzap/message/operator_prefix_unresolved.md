---
category: config
audience: suporte
summary: O nome do operador não foi obtido, então a mensagem saiu sem o prefixo configurado.
---
# thinkzap.message.operator_prefix_unresolved

## O que significa
A linha tem o ajuste **Prefixar nome do operador** ligado, mas o nome de quem atende não foi obtido por nenhuma origem. A mensagem **foi entregue** ao contato — só saiu sem o `Nome: ` na frente.

O prefixo é cosmético e a mensagem não: o envio nunca é recusado por causa do nome.

## Causa provável
O campo `prefixFailure` da linha de log diz qual:

- `bitrix-refused` — o portal do cliente **recusou** `user.get`. Quase sempre escopo (`user` / `user_brief`) não concedido na instalação do app. O campo `refusal` traz a resposta do Bitrix24.
- `bitrix-empty` — `user.get` respondeu, mas sem nome para aquele id de usuário (usuário fora do escopo do app, ou sem nome e sobrenome preenchidos no portal).
- `allowed-user-empty` — o Bitrix24 não devolveu nome e o registro de usuários permitidos daquela instalação está sem nome cadastrado para o operador.
- `no-user-id` — o evento chegou sem o id do operador. Não há o que resolver; investigar como dev.

## Como verificar
1. Na tela de Logs do app thinkzap, filtre pelo `traceKey` do ticket.
2. Confirme `código de erro: thinkzap.message.operator_prefix_unresolved`.
3. Leia `prefixFailure` e, quando existir, `refusal`.
4. Confirme com o cliente que a mensagem chegou ao contato (chegou — sem o prefixo).

## Como resolver
- `bitrix-refused`: conferir os escopos da ficha do app no marketplace; sem escopo de usuários, o nome só vem do cadastro (segunda origem).
- `bitrix-empty` / `allowed-user-empty`: pedir ao cliente que o operador **entre no app** uma vez — o login grava o nome no cadastro de usuários permitidos, e a partir daí a segunda origem resolve. Alternativa: preencher nome e sobrenome do usuário no portal.
- `no-user-id`: escalar para dev; é evento sem autor, não configuração.
