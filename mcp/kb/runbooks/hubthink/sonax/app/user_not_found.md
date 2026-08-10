---
category: config
audience: suporte
summary: O portal foi reconhecido, mas o usuário não está cadastrado na base do CRMThink.
---
# sonax.app.user_not_found

## O que significa
Quando o app Sonax é instalado, a instalação cria o vínculo entre o portal e o usuário na base do CRMThink. É esse vínculo que permite ao Sonax operar em nome do parceiro.

Esse erro quer dizer que o portal foi reconhecido, mas o usuário correspondente não foi encontrado na base do CRMThink. Como esse vínculo é criado na instalação, a ausência dele costuma indicar uma instalação incompleta ou desfeita.

## Causa provável
- **Instalação incompleta**: o app começou a ser instalado, mas não concluiu, e o vínculo do usuário não foi criado.
- **Vínculo removido**: o parceiro existia, mas o registro foi apagado depois (por reinstalação ou limpeza).
- **Instalação por caminho irregular**: o app foi ativado de uma forma que não completou o cadastro do usuário.

## Como verificar
1. Na tela de Logs do app sonax, filtre pelo `traceKey` do ticket.
2. Confirme `código de erro: sonax.app.user_not_found`.
3. Verifique se o parceiro (domínio) deveria mesmo ter um usuário cadastrado. Se ele deveria existir, a instalação provavelmente não concluiu corretamente.

## Como resolver
1. Confirme com o parceiro que o app Sonax foi instalado corretamente no Bitrix24 dele.
2. Se o parceiro deveria existir mas não aparece, oriente a reinstalação do app Sonax — a instalação recria o vínculo do usuário.
3. Após reinstalar, peça para repetir a ação que gerou o erro e acompanhe na tela de Logs.

## Quando escalar
Se o app foi reinstalado corretamente e o usuário continua não sendo encontrado, acione a equipe de desenvolvimento. Anexe: `traceKey`, `código de erro: sonax.app.user_not_found`, domínio do parceiro e o horário do evento.
