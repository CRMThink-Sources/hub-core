# Proposal

## Why

Na tela de configuração de uma linha do ThinkZap (`/thinkzap/conexoes/[subscriptionItemId]/configuracoes`), a aba **Ajustes** mistura dois tipos de configuração: campos editáveis que dependem de um "Salvar" (nome da linha e toggles de comportamento) e ações imediatas (vincular canal aberto, oferecer a linha na Campanha de SMS do Bitrix24). O botão **Salvar** fica dentro do card **Comportamento**, então parece salvar só os toggles — embora também grave o nome da linha, que está em outro card. Somado a isso, o card de Campanha de SMS (com avisos de risco de bloqueio e, na linha oficial, a lista de templates) alonga a aba e reforça a confusão sobre o que o botão salva.

## What Changes

- Nova aba **Campanha de SMS** na tela de configuração da linha, para linhas não oficiais (Z-API) e oficiais (HubMessage). O conteúdo atual do card de Campanha de SMS do Bitrix24 (`SmsProviderCard`, incluindo o caminho por template da linha oficial) passa a morar nela.
- O card de Campanha de SMS **sai** da aba Ajustes.
- O botão **Salvar** sai de dentro do card Comportamento e vira uma **barra de salvamento da página** (fixa no rodapé da aba Ajustes), que:
  - indica quando há alterações não salvas e quantas são;
  - salva de uma vez todos os campos editáveis alterados na aba (nome + toggles);
  - oferece **Descartar** para voltar aos valores gravados;
  - fica desabilitada sem alterações, com nome inválido ou com linha bloqueada, e mostra estado de carregamento durante o salvamento.
- Proteção contra perda de edição: trocar de aba ou sair da página com alterações não salvas pede confirmação.
- Textos da Campanha de SMS migram para um namespace de tradução próprio (pt, en, es).

Sem mudança de API/backend: os endpoints de ajustes e de provedor de SMS continuam os mesmos.

## Capabilities

### New Capabilities
- `thinkzap/configuracao-linha`: organização da tela de configuração da linha do ThinkZap — abas disponíveis por tipo de linha, aba dedicada à Campanha de SMS do Bitrix24 e comportamento de salvamento das alterações da aba Ajustes.

### Modified Capabilities
<!-- Nenhuma: não há specs existentes em openspec/specs/. -->

## Impact

- `front/app/(thinkzap)/thinkzap/conexoes/[subscriptionItemId]/configuracoes/page.tsx` — nova aba nas duas variantes (Z-API e oficial) e guarda de alterações não salvas na troca de aba.
- `front/app/(thinkzap)/thinkzap/_components/configuracoes/ajustes-tab.tsx` — remove o card de SMS, remove o botão do card Comportamento, adiciona a barra de salvamento e o aviso de saída.
- Novo `front/app/(thinkzap)/thinkzap/_components/configuracoes/campanha-sms-tab.tsx`.
- `front/app/(thinkzap)/thinkzap/_components/configuracoes/sms-provider-card.tsx` — troca de namespace de tradução.
- Possível novo componente de barra de salvamento, inspirado em `permissions-footer-bar.tsx`.
- `front/messages/{pt,en,es}/thinkzap/configuracoes/` — novo `campanha-sms.json`; `ajustes.json` perde o bloco `smsProvider` e ganha chaves da barra; `page.json` ganha o rótulo da aba e textos do aviso de saída.
