# Design

## Context

- **Criação**: `CreateTemplateController` aceita `HEADER` no schema (`z.enum(['HEADER','BODY','FOOTER'])` com `.passthrough()`), mas o formulário (`template-form.tsx`) nunca o envia e `CreateConnectorTemplateUseCase.validate` não o valida. `HubMessageTemplateProvider.createTemplate` repassa os componentes crus para `POST /whatsapp/businesses/{wabaId}/templates`.
- **Provedor**: a HubMessage virou **Z-API Omni**. A doc nova (`developer.omni.z-api.io`, servidor `https://api.omni.z-api.io`) mantém as mesmas rotas de template e documenta o cabeçalho de mídia:
  - `templates/anatomy` e `templates/validation`: em `HEADER` `IMAGE`, `example.header_handle` (no máximo 1 item) aceita o identificador da Meta **ou o link público** do arquivo, "que convertemos para identificador antes de criar o template". O limite de imagem é JPEG/PNG de até 5 MB, exibida em 1.91:1.
  - `templates/upload-media`: `POST /whatsapp/businesses/{wabaId}/templates/media` (multipart, `file` + `type`) devolve o identificador em `h`. Exige App ID e App Secret da Meta cadastrados no painel da conta, sem eles responde `422 MISSING_APP_CREDENTIALS`. O identificador expira, então tem que ser usado na mesma sessão.
  - Link do CDN da Meta (`whatsapp.net`, `fbcdn.net`, `fbsbx.com`), lido de um template existente, é recusado como amostra (`2388215 invalid media sample`). Link que a Meta não consegue baixar volta como `380 media download failed`.
  - No envio, "cabeçalho de mídia **exige** o parâmetro da imagem". O exemplo da doc mostra `components[].type` em minúsculo (`header`, `body`, `button`), mas só traz o caso de cabeçalho de texto. O formato do parâmetro de imagem não está escrito; segue-se o da Cloud API: `{ type: 'image', image: { link } }`.
- **Envio hoje**: o adapter (`hubmessage-template-sender.adapter.ts`) monta só `BODY` e `BUTTON`, em maiúsculo (armadilha 3 de `hubmessage.types.ts`, confirmada por envio real em 2026-08-06).
- **Mídia na HubMessage** vai sempre por URL (`HubMessageSendAttachment.url`). Desde `upload-imagem-envio-widget`, a API grava imagens de cabeçalho no bucket R2 (`TemplateImageStorage`, chave `template-headers/<domainId>/<AAAA-MM>/<uuid>`), e o bucket apaga esses arquivos em 30 dias.
- **Fila**: `core_thinkerszap_widget_outbox` guarda `templateParameters` e `templateButtonParameters`, e o despacho remonta o `TemplateMessageDescriptor` a partir da row (`templateDescriptorOf`).
- **Catálogo**: `toWidgetTemplate` hoje ignora o `HEADER`. Um template com imagem criado na Meta já aparece no widget e falha no envio. O catálogo vem ao vivo da Meta: o ThinkZap não tem tabela de templates, e a URL usada na criação não fica registrada.
- **Imagem do template na Meta**: a Meta não guarda uma imagem fixa para o envio. Em templates sincronizados, `header_handle` traz um link assinado do CDN da Meta (`scontent.whatsapp.net`…), que expira.
- **Edição na Omni**: `PUT /whatsapp/businesses/{wabaId}/templates/{templateId}` (`developer.omni.z-api.io/templates/update-template`), com o mesmo corpo da criação; o `templateId` é o `id` que já vem na listagem (`Template.id`). Responde `{ success: true }`; template aprovado volta para `PENDING`. Erros: `400` (recusa da Meta, `META_WHATSAPP_ERROR`), `422` (validação), `502`/`504`. A doc não descreve as regras da Meta; pela documentação da Meta, só se edita template `APPROVED`, `REJECTED` ou `PAUSED`, nome e idioma não mudam, categoria não muda em template aprovado, e template aprovado aceita 1 edição a cada 24 h e até 10 em 30 dias. A tarefa 1.4 confirma.
- **Aba de templates**: `templates-tab.tsx` alterna entre a lista (`templates-lista.tsx`, `<ul>` de cards simples com nome, selos e corpo) e o formulário (`template-form.tsx`, coluna única `max-w-lg`). Não há busca, filtro, ações por template nem estado de carregamento além de um texto.
- A mudança de botões (`thinkzap/botoes-template-oficial`) já percorreu as mesmas camadas (catálogo → widget → robô → fila → adapter → campanha SMS). Este design segue o mesmo caminho.

## Goals / Non-Goals

**Goals:**
- Isolar o formato da imagem de exemplo no adapter HubMessage: o domínio só conhece "arquivo" ou "link", e quem decide entre upload e `header_handle` com link é o adapter.
- Permitir que o operador envie o arquivo da imagem de exemplo.
- Usar o mesmo caminho de valor por envio dos botões dinâmicos: do catálogo ao front, do front à fila e da fila ao adapter.
- Permitir enviar um template com imagem sem informar a imagem a cada envio, usando uma imagem padrão guardada pelo ThinkZap.
- Editar templates pelo mesmo formulário e pelas mesmas validações da criação.
- Dar à aba de templates cara de SaaS moderno sem mudar o contrato dos dados da lista.

**Non-Goals:**
- Excluir template (a Omni tem a rota, mas não foi pedido).
- Limpar arquivos de imagem padrão substituídos (ver Risks).
- Usar o `header_handle` da Meta como imagem do envio: o link expira.
- Paginação ou busca no servidor: a lista de uma WABA é pequena e já vem inteira.

## Decisions

### D1. Imagem de exemplo por arquivo (upload à Omni) ou por link, com contrato neutro no domínio
O operador escolhe entre enviar o arquivo e informar um link. Pedido com arquivo vai em multipart: o campo `payload` leva o JSON (nome, categoria, idioma, componentes) e o arquivo vai em `headerImage`. Sem arquivo, o pedido continua JSON como hoje.

O componente neutro é `{ type: 'HEADER', format: 'IMAGE', example?: { imageUrl } }`, e o pedido tem **exatamente uma** fonte: o arquivo ou `imageUrl`. `CreateTemplateInput` ganha `headerSampleImage?: TemplateSampleImage` (bytes + tipo).

O caminho do arquivo:
- **Com o bucket R2 configurado** (mudança `upload-imagem-envio-widget`): o use case grava o arquivo no bucket, troca o cabeçalho por `example.imageUrl` com a URL pública e segue pelo caminho do link. Não depende das credenciais da Meta nem da rota de upload da Omni. A gravação acontece depois das recusas de linha, para um pedido recusado não deixar arquivo.
- **Sem o bucket**: o adapter usa `uploadTemplateMedia` (`POST /whatsapp/businesses/{wabaId}/templates/media`, multipart `file` + `type`) → `h` → `example: { header_handle: [h] }`, no mesmo request porque o `h` expira. Em 2026-10-20 essa rota respondia `405` (documentada, não publicada); a resposta `404`/`405` dela vira mensagem pedindo o link.

O link vai em `example: { header_handle: [imageUrl] }`, o formato documentado pela Omni para link público, que ela converte no identificador da Meta.

O `422 MISSING_APP_CREDENTIALS` do upload vira `thinkzap.template.header_image_app_credentials_missing`, com mensagem dizendo que o envio de arquivo não está disponível na conta e que o operador pode usar o link (ou pedir a configuração de App ID/App Secret no painel da Omni).

A tarefa 1 confirma os dois caminhos numa WABA de teste e anota o resultado no JSDoc de `CreateTemplateParams` em `hubmessage.types.ts`.

*Alternativas descartadas*: (a) sempre fazer upload, inclusive para o link (a API baixaria a imagem e subiria). Faria a criação por link também depender das credenciais da Meta. (b) Integrar direto com a Resumable Upload API da Meta. Exige um app da Meta que não controlamos, e é exatamente o que a Omni já faz por nós.

### D2. Validar e baixar a imagem de exemplo na API
A API recusa link do CDN da Meta (`whatsapp.net`, `fbcdn.net`, `fbsbx.com`) e depois baixa a URL de exemplo antes de chamar o provider, com limite de 5 MB e conferindo o `Content-Type` (`image/jpeg`, `image/png`). Isso transforma `2388215` e `380` (recusas da Meta difíceis de entender) em um erro de definição inválida que o operador consegue corrigir. O download segue o padrão de `fetchRobotFiles` (axios com `maxContentLength`, que encerra quando passa do limite).

O arquivo enviado passa pelas mesmas travas: no máximo 5 MB (limite do multer, em memória) e JPEG/PNG **pela assinatura do arquivo** (`FF D8 FF` / `89 50 4E 47`), não pelo tipo que o navegador declara.

### D3. Imagem do envio por URL, guardada em coluna nova
A URL da imagem do envio entra em `TemplateMessageDescriptor.headerImageUrl?: string` e numa coluna anulável nova, `template_header_image_url`, em `core_thinkerszap_widget_outbox`. Um campo próprio, e não um item em `templateButtonParameters`, porque o cabeçalho não tem `index` e misturar os dois confundiria o despacho.

O adapter monta `{ type: 'HEADER', parameters: [{ type: 'image', image: { link } }] }` antes do `BODY`. O `type` vai em maiúsculo, como os demais componentes (armadilha 3). A doc nova mostra minúsculo, mas o maiúsculo é o que foi confirmado em envio real. A tarefa 1.2 confirma o parâmetro de imagem, que a doc não escreve, e testa minúsculo se o maiúsculo for recusado.

### D4. Catálogo com `header`
`WidgetTemplate` ganha `header: { type: 'NONE' | 'TEXT' | 'IMAGE', defaultImageUrl?: string }` (`defaultImageUrl` vem de D8, só em `IMAGE`). Um helper novo, `templateHeaderOf(components)`, em `domain/template-header.ts` (irmão de `template-buttons.ts`), lê o `HEADER`: sem cabeçalho = `NONE`, texto sem `{{` = `TEXT`, imagem = `IMAGE`. Qualquer outro caso (vídeo, documento, localização, texto com variável) fica `UNSUPPORTED`, e `ListWidgetTemplatesUseCase` filtra esses templates. A tela do robô usa o mesmo catálogo, então herda o filtro.

### D5. Robô: propriedade `templateHeaderImageUrl`
Nova propriedade `Type: 'string'`, não múltipla e **não obrigatória**, em `templateRobotProperties()`. Ao resolver os valores no disparo, a API usa os mesmos helpers de campo do documento que `resolve-robot-button-parameters.ts`. URL resolvida vazia cai na imagem padrão do template (D9). Só quando não há nenhuma das duas, ou a URL informada não é `https`, a API registra um aviso novo em `timeline-notices.ts` (`templateRobot.missingHeaderImage`, nos três idiomas) e não enfileira. A tela do robô só impede salvar com o campo vazio quando o template não tem imagem padrão. Os robôs já instalados ganham a propriedade quando o `ensure-template-robot` os registra de novo, já que `ensureTemplateRobot` faz `bizproc.robot.add` e, se o robô já existe, `bizproc.robot.update`.

### D6. Campanha SMS
`manage-line-sms-provider.ts` ganha `hasImageHeader` ao lado de `hasDynamicButton`, e o handler da campanha recusa pelo mesmo caminho da recusa de botão dinâmico, com um código de motivo novo no catálogo de erros (`thinkzap.template.image_header_not_supported`).

### D7. Validação no front espelha a API
`template-form.tsx` ganha a seção de cabeçalho (nenhum / imagem). A validação de URL `https` e a regra "não em Autenticação" ficam num helper puro, no mesmo arquivo de regras que os botões usam, para o front e os testes compartilharem a lógica. A checagem de tamanho e tipo do link só acontece na API (o front não baixa a imagem).

A imagem de exemplo tem duas opções: "Enviar arquivo" e "Usar link". O arquivo é conferido também no cliente (tipo e 5 MB), o preview usa object URL, e o pedido sai em multipart quando há arquivo.

### D8. Imagem padrão do envio, guardada por template
Tabela nova `core_thinkerszap_template_defaults`: `domainId`, `itemId` (linha), `templateName`, `language`, `headerImageUrl`, `updatedAt`, com chave única `(domainId, itemId, templateName, language)`. A chave é nome + idioma, e não o `id` da Meta, porque é assim que o catálogo de envio, a fila e o robô identificam o template, e nenhum dos dois muda numa edição.

Port novo `TemplateDefaultsRepository` (`find(scope, name, language)`, `findMany(scope)`, `upsert`), com adapter Prisma.

O arquivo vai para o R2 por `TemplateImageStorage.store` com um parâmetro novo `retention: 'temporary' | 'permanent'`: `temporary` mantém `template-headers/...` (30 dias), `permanent` grava em `template-defaults/<domainId>/<uuid>.<ext>`, sem expiração. A regra de ciclo de vida do bucket precisa filtrar pelo prefixo `template-headers/` (tarefa 1.5); se hoje ela vale para o bucket inteiro, é ajustada no painel do R2 antes do deploy.

Quem grava a imagem padrão:
- **Criação**: depois que o provider aceita o template, o use case grava a URL de exemplo (o link informado, ou o arquivo regravado como `permanent`) como imagem padrão. Falha ao gravar a imagem padrão não desfaz a criação: registra log e o template fica sem padrão, que pode ser definido depois.
- **Ação "Imagem padrão do envio"**: rota nova `PUT /lines/:itemId/templates/:name/:language/default-image` (JSON com `imageUrl` ou multipart com `image`), use case `SetTemplateDefaultImageUseCase`. Passa pelas mesmas travas da amostra (D2): `https`, recusa do CDN da Meta, download validado de até 5 MB JPEG/PNG, ou assinatura do arquivo. Só aceita template com `templateHeaderOf === 'IMAGE'`.
- **Edição** que troca a imagem (D10).

A listagem de templates da configuração (`GET` atual) passa a devolver `defaultImageUrl` em cada template com imagem, juntando a lista ao vivo da Meta com `findMany` da linha.

*Alternativas descartadas*: (a) usar o `header_handle` da Meta: link assinado que expira. (b) Guardar o media ID da Meta: também vale cerca de 30 dias. (c) Chave pelo `id` da Meta: o catálogo de envio e a fila não o carregam, e a troca não traria ganho.

### D9. Resolução da imagem no envio
Ordem: URL informada no envio (widget ou propriedade do robô) → imagem padrão do template → bloqueio. A resolução acontece **na hora de enfileirar** (`EnqueueTemplateSendService` recebe a URL já resolvida pelo widget/robô; o robô consulta `TemplateDefaultsRepository` quando a propriedade vem vazia), e a URL que valeu é gravada em `template_header_image_url`. Reenvios e reprocessamentos usam a URL gravada, mesmo que a imagem padrão mude depois.

No widget, o catálogo já traz `defaultImageUrl`: o composer pré-preenche o preview com ela e manda `headerImageUrl` explícito no envio. Trocar a imagem no widget vale só para aquele envio e não altera a padrão.

### D10. Edição de template
- **Provider**: `WhatsAppTemplateProvider.updateTemplate(input: UpdateTemplateInput)` (`wabaId`, `templateId`, `name`, `category`, `language`, `components`, `headerSampleImage?`), implementado no `HubMessageTemplateProvider` sobre `HubMessageClient.updateTemplate` (`PUT .../templates/{templateId}`), com a mesma tradução de cabeçalho da criação (D1).
- **Use case**: `UpdateConnectorTemplateUseCase` reaproveita a validação de `CreateConnectorTemplateUseCase` (extraída para uma função compartilhada) e acrescenta: busca o template atual na lista da WABA, recusa se não existir, se o status não for `APPROVED`, `REJECTED` ou `PAUSED`, se nome ou idioma vierem diferentes, ou se a categoria mudar num template `APPROVED`.
- **Controller**: `PUT /lines/:itemId/templates/:templateId`, JSON ou multipart, como a criação.
- **Imagem na edição**: o link da Meta não vale como amostra (`2388215`). Se o operador não trocar a imagem, a amostra enviada é a imagem padrão do template. Sem imagem padrão, o formulário exige uma imagem nova. Imagem trocada na edição vira a nova imagem padrão.
- **Erros**: recusas de limite de edição da Meta e de estado não editável viram códigos novos no catálogo (`thinkzap.template.edit_limit_reached`, `thinkzap.template.not_editable`), com runbook e mensagem legível. Os códigos exatos da Meta são confirmados na tarefa 1.4; até lá, o mapeamento cobre pela mensagem.
- **Front**: `TemplateForm` ganha `mode: 'create' | 'edit'` e `initial` (template atual). No modo edição, nome e idioma ficam desabilitados, a categoria fica desabilitada em template aprovado, e um aviso fixo diz que o template volta para análise e sai do catálogo de envio até ser reaprovado.

### D11. Aba de templates
Mesmos dados de hoje, organizados como um SaaS moderno. A busca (nome e corpo) e os filtros (status, categoria, "com imagem") rodam no cliente.

Componentes, todos em `configuracoes/oficial/`:
- `templates-tab.tsx`: cabeçalho com título, contagem e ações (Sincronizar, Novo template); barra de busca e filtros; troca entre lista e formulário (criação ou edição).
- `templates-toolbar.tsx`: busca, filtros em chips/segmentos, contagem de resultados e "limpar filtros".
- `template-card.tsx`: miniatura da imagem padrão (ou placeholder quando o template tem imagem sem padrão, com chamada para definir), nome, selo de status com ponto colorido, categoria e idioma, corpo em duas linhas, selos de botões, e menu de ações.
- `template-actions-menu.tsx`: Editar (desabilitado com dica quando o status não permite), Imagem padrão do envio (só em template com imagem), Ver detalhes.
- `template-default-image-dialog.tsx`: arquivo ou link, preview 1.91:1, salvar.
- `template-details-sheet.tsx`: painel lateral com o preview completo e os metadados.
- `template-preview.tsx`: bolha estilo WhatsApp (cabeçalho com imagem, corpo com variáveis destacadas, rodapé e botões), usada no card de detalhes e no formulário.
- `template-form.tsx`: duas colunas em telas largas (campos em seções com título à esquerda, `template-preview` fixo à direita), uma coluna em telas estreitas.

Estados: esqueleto no carregamento, estado vazio com ilustração leve e "Criar primeiro template", estado "nenhum resultado" para busca/filtro, e erro com "Tentar de novo". Componentes de `@/components/ui` (shadcn) são reaproveitados. A skill `design-taste-frontend` (regras de telas de app) orienta a implementação, e a verificação é visual no navegador, em tema claro e escuro.

## Risks / Trade-offs

- [O upload exige App ID/App Secret da Meta cadastrados no painel da Omni, e ainda não se sabe se são da nossa conta ou de cada WABA] → Sem eles, o envio de arquivo falha com mensagem legível e o link continua disponível. Envio, lista e catálogo não dependem disso.
- [Arquivo malicioso com extensão de imagem] → O tipo é decidido pela assinatura do arquivo, não pelo `mimetype` do navegador. O arquivo nunca é gravado em disco; vai para o bucket com o `Content-Type` decidido pela assinatura.
- [Arquivos de imagem padrão sem limpeza] → Trocar a imagem padrão não apaga a anterior, porque a fila pode estar reenviando com ela. O volume esperado é pequeno (uma imagem por template). Uma limpeza de órfãos fica para depois, se o volume crescer.
- [Regra de 30 dias valendo para o bucket inteiro] → As imagens padrão sumiriam em 30 dias. A tarefa 1.5 confere a regra antes do deploy.
- [Imagem padrão apagada ou fora do ar] → O envio falha como as demais falhas de download da Meta e aparece na timeline. O operador troca a imagem padrão pela ação da lista.
- [Edição devolve o template para `PENDING`] → Ele sai do catálogo de envio até ser reaprovado. Robôs configurados com ele falham no disparo nesse intervalo, como já acontece com template não aprovado. O formulário avisa antes de salvar.
- [Limite de edições da Meta] → A recusa chega com mensagem legível (D10). O ThinkZap não conta as edições.
- [Base URL] → A doc nova usa `https://api.omni.z-api.io`, e o padrão de `env.hubMessage.baseUrl` ainda é `https://api.hubmessage.io`. Não muda nesta mudança, mas a tarefa 1 registra se o domínio antigo continua respondendo.
- [A Meta não consegue baixar a URL no envio (host bloqueado, URL expirada, link de Drive)] → A falha chega à timeline pelo caminho atual de falha de template. A tela e a ajuda dizem que a URL precisa ser pública e direta para o arquivo.
- [URL do Bitrix (`urlMachine`) usada como imagem no robô] → Ela leva um token que expira, e um reenvio tardio falharia. Fica documentado que o campo espera uma URL pública. Não tentamos converter campo de arquivo em URL.
- [Download da imagem de exemplo vira SSRF] → Só `https`, recusa de host que resolva para IP privado ou de loopback (inclusive depois de redirect), timeout curto e limite de 5 MB.
- [Filtrar templates com cabeçalho não suportado tira do widget templates que hoje aparecem] → Hoje eles já falham no envio. Esconder troca uma falha assíncrona por ausência, e a lista de templates da configuração continua mostrando todos.

## Migration Plan

1. Migrations Prisma aditivas: `template_header_image_url TEXT NULL` na fila e a tabela `core_thinkerszap_template_defaults`. Rows antigas ficam nulas = envio sem imagem.
2. Conferir a regra de ciclo de vida do bucket R2 e restringi-la ao prefixo `template-headers/`.
3. Deploy da API antes do front. A API aceita pedidos sem os campos novos, então o front antigo segue funcionando.
4. Reinstalar os robôs de template pelo fluxo já existente para registrar a nova propriedade.
5. Templates com imagem já existentes não têm imagem padrão: o card mostra a chamada para definir, e o widget pede a imagem até que ela seja definida.
6. Rollback: reverter o código. A coluna, a tabela e os arquivos podem ficar.

## Open Questions

- Se o domínio `api.hubmessage.io` vai ser desligado em favor de `api.omni.z-api.io`. Isso é troca de variável de ambiente e não muda este plano.
- Quem cadastra App ID/App Secret na Omni (nós ou cada cliente), e se o cadastro é por conta ou por WABA.
- Códigos exatos que a Meta (via Omni) devolve para limite de edição e para estado não editável (tarefa 1.4).
