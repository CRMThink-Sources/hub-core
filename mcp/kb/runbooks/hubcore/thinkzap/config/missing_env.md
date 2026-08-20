---
category: config
audience: suporte
summary: Um recurso está temporariamente indisponível por configuração de ambiente.
---
# thinkzap.config.missing_env

## O que significa
Um recurso do app thinkzap depende de uma configuração de ambiente que não está presente, então ele fica temporariamente indisponível. Não é falha do parceiro, não é instabilidade externa e nada foi cobrado indevidamente: falta um item de configuração interna. A correção depende do time responsável.

## Causa provável
- **Configuração de ambiente ausente**: uma variável necessária para o recurso não está definida.
- **Configuração incompleta após mudança de ambiente**: um ajuste recente deixou o item sem valor.

## Como verificar
1. Na tela de Logs do app thinkzap, filtre pelo `traceKey` do ticket.
2. Confirme `código de erro: thinkzap.config.missing_env`.
3. Veja no log qual recurso ficou indisponível.

## Como resolver
1. Este caso não se resolve pelo parceiro: informe que o recurso está temporariamente indisponível.
2. Acione o time responsável para configurar a variável de ambiente ausente.
3. Após a correção, oriente o parceiro a repetir a operação.

## Quando escalar
Acione a equipe de desenvolvimento assim que confirmar o erro, pois depende de configuração interna. Anexe: `traceKey`, `código de erro: thinkzap.config.missing_env`, domínio do parceiro, o horário do evento e o recurso que ficou indisponível.
