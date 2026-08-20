---
category: integration
audience: suporte
summary: Falha ao ler ou gravar a configuração do Sonax no Bitrix24 porque o Bitrix não respondeu como esperado.
---
# sonax.config.load_failed

## O que significa
Para ler ou salvar a configuração do Sonax, o CRMThink precisa conversar com o Bitrix24 do parceiro. Esse erro quer dizer que essa conversa não deu certo: o Bitrix24 não respondeu como esperado no momento de ler ou gravar a configuração.

Como costuma ser uma falha momentânea de comunicação, geralmente vale tentar de novo.

## Causa provável
- **Instabilidade momentânea**: o Bitrix24 estava lento ou indisponível no momento.
- **Credencial de acesso ao portal com problema**: a credencial que autoriza o CRMThink a acessar o portal expirou ou ficou inválida.
- **Bloqueio ou restrição no portal**: alguma limitação temporária no Bitrix24 do parceiro impediu a resposta.

## Como verificar
1. Na tela de Logs do app sonax, filtre pelo `traceKey` do ticket.
2. Confirme `código de erro: sonax.config.load_failed`.
3. Verifique se o erro é pontual ou está se repetindo. Confira também se o parceiro relata lentidão ou instabilidade no Bitrix24 dele.

## Como resolver
1. Confira nas Configurações do Sonax se a credencial de acesso ao portal está válida.
2. Peça ao parceiro para repetir a ação após alguns minutos — muitas vezes a falha se resolve sozinha.
3. Acompanhe na tela de Logs se o erro deixa de ocorrer.

## Quando escalar
Se o erro persiste mesmo após novas tentativas e com a credencial válida, acione a equipe de desenvolvimento. Anexe: `traceKey`, `código de erro: sonax.config.load_failed`, domínio do parceiro e o horário do evento.
