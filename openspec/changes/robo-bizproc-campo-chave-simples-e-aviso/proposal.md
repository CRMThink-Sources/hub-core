# Proposal

## Why

No negócio 53433 do portal `crmthink.bitrix24.com.br`, o robô "[ThinkZap] Enviar Template" comentava "Nenhum destinatário válido para o envio do template" mesmo com contato e celular preenchidos. A investigação mostrou três falhas encadeadas, todas no caminho entre o que a tela do robô grava e o que o Bitrix entrega ao webhook:

1. **A tela grava campo da entidade como `{{=Document:ID}}` (chaves duplas).** O Bitrix resolve o miolo e deixa o par externo: o nome do contato chegou ao WhatsApp como `Olá, {João}!`. Com chave simples (`{=Document:ID}`) a mesma configuração entregou `Olá, João!`.
2. **Ao reabrir o robô, o Bitrix devolve o campo em forma de exibição (`{{{Contato: Celular}}}`), e a tela o guarda como "Seletor do Bitrix", verbatim.** Basta abrir e salvar de novo para gravar esse texto literal, que o Bitrix **não resolve**. Foi o que o webhook recebeu nas execuções com falha: `destination: "{{{Contato: Celular}}}"`.
3. **O comentário da timeline não diz o que chegou.** Destino `{}` (campo resolvido para vazio, por exemplo telefone do contato cadastrado como "Trabalho" quando o campo lido é "Celular") e destino literal `{{{…}}}` produzem o mesmo "nenhum destinatário válido", e o operador não tem como distinguir configuração quebrada de contato sem telefone.

Relato de envio para "números aleatórios" ficou fora do escopo: a origem mais provável é o toggle "Enviar para todos os contatos relacionados" em negócio com empresa vinculada, e foi tratada como configuração.

## What Changes

- **Gravação** (`toStoredValue`): campo da entidade passa a ser gravado como `{=Document:ID}`. A leitura já aceita de 1 a 3 chaves, então robôs salvos antes continuam reconhecidos. Vale para o robô de template e para o robô de botões, que compartilham as funções.
- **Reabertura** (`fromStoredValue`): um token `{{{Rótulo}}}` cujo rótulo bate exatamente com o título de **um único** campo do documento volta como "Campo da entidade" daquele campo, e o próximo salvamento regrava `{=Document:ID}`. Rótulo que não casa, ou casa com mais de um campo, e tokens de retorno de outro passo (`{{{[Passo] Nome}}}`) continuam como "Seletor do Bitrix", intactos.
- **Aviso na timeline**: quando o destino do robô de template ou de botões chega vazio, `{}` ou como token não resolvido `{{{…}}}`, o comentário passa a dizer a causa provável e o que fazer (conferir o tipo do telefone no cadastro; reabrir o robô, escolher o campo de novo e salvar). Os avisos existem em português, inglês e espanhol, seguindo o idioma da instalação.
- Fora do escopo, de propósito: resolvedor de contatos relacionados, filtro por tipo de telefone, e qualquer "conserto" automático de valores já gravados no handler (risco de alterar valor legítimo entre chaves).

## Capabilities

### New Capabilities
- `thinkzap/robo-bizproc-valores-campo`: como a tela dos robôs de template e de botões grava e relê valores de campo da entidade, e como o servidor diagnostica um destino que o Bitrix não resolveu.

### Modified Capabilities
- `thinkzap/idioma-avisos-servidor`: o requisito "Avisos na timeline do CRM" passa a listar o aviso de destino não resolvido dos robôs de template e de botões, nos três idiomas.

## Impact

- **Front** (`front/app/bitrix/bizproc`): `template/_lib/robot-config.ts` (`toStoredValue`, `fromStoredValue`, `readRobotConfig` e a lista de campos), `_shared-button/button-robot-config.ts`, `template/_components/template-robot-form.tsx` e o formulário do robô de botões (repassar a lista de campos à leitura), mais `robot-config.test.ts`.
- **API** (`api/src/modules/thinkzap`): `domain/notices/timeline-notices.ts` (pt, en, es), `bitrix-template-robot-webhook-handler.controller.ts` e `bitrix-button-robot-webhook-handler.controller.ts` (diagnóstico do destino), um helper novo e testado, e os `.controller.test.ts`.
- **Sem migration, sem variável de ambiente, sem mudança de contrato com o Bitrix** (o handler continua recebendo as mesmas propriedades).
- **Sobreposição**: a change em andamento `imagem-cabecalho-template-oficial` também edita `robot-config.ts`, `template-robot-form.tsx` e o handler do robô de template. Aplicar uma sobre a outra exige reconciliar esses três arquivos.
- **Robôs já salvos errado** (`{{=Document:X}}`, que entregam `{valor}`; ou literal `{{{…}}}`) só se corrigem quando alguém reabre e salva de novo. A correção deste change impede que o reabrir-e-salvar volte a estragar o valor, mas não reescreve o que já está gravado nos portais.
