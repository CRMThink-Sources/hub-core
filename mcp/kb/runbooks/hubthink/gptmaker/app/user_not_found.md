---
category: config
audience: suporte
summary: O portal foi reconhecido, mas o usuário não tem cadastro no GPT Maker.
---
# gptmaker.app.user_not_found

## O que significa
O portal do parceiro foi reconhecido, mas o usuário que originou a ação não tem cadastro no GPT Maker. O vínculo do usuário é criado durante a instalação do app.

## Causa provável
- A instalação não concluiu o cadastro do usuário.
- O usuário foi criado no Bitrix24 depois da instalação.

## Como verificar
1. Na tela de Logs do app gptmaker, filtre pelo `traceKey` do ticket.
2. Confirme `código de erro: gptmaker.app.user_not_found`.
3. Confirme com o parceiro qual usuário estava usando o app.

## Como resolver
1. Oriente o parceiro a reinstalar o app, o que recria o vínculo dos usuários.
2. Peça para o usuário abrir o app novamente e repetir a ação.
3. Confirme na tela de Logs que o erro deixou de ocorrer.

## Quando escalar
Se após a reinstalação o usuário continua sem ser reconhecido, acione a equipe de desenvolvimento. Anexe: `traceKey`, `código de erro: gptmaker.app.user_not_found`, domínio do parceiro e o horário do evento.
