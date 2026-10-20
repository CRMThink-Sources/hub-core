# Design

## Context

- **Criação**: `CreateTemplateController` aceita `HEADER` no schema (`z.enum(['HEADER','BODY','FOOTER'])` com `.passthrough()`), mas o formulário (`template-form.tsx`) nunca o envia e `CreateConnectorTemplateUseCase.validate` não o valida. `HubMessageTemplateProvider.createTemplate` repassa os componentes crus para `POST /whatsapp/businesses/{wabaId}/templates`.
- **Provedor**: a HubMessage virou **Z-API Omni**. A doc nova (`developer.omni.z-api.io`, servidor `https://api.omni.z-api.io`) mantém as mesmas rotas de template e documenta o cabeçalho de mídia:
  - `templates/anatomy` e `templates/validation`: em `HEADER` `IMAGE`, `example.header_handle` (no máximo 1 item) aceita o identificador da Meta **ou o link público** do arquivo, "que convertemos para identificador antes de criar o template". O limite de imagem é JPEG/PNG de até 5 MB, exibida em 1.91:1.
  - `templates/upload-media`: `POST /whatsapp/businesses/{wabaId}/templates/media` (multipart, `file` + `type`) devolve o identificador em `h`. Exige App ID e App Secret da Meta cadastrados no painel da conta, sem eles responde `422 MISSING_APP_CREDENTIALS`. O identificador expira, então tem que ser usado na mesma sessão.
  - Link do CDN da Meta (`whatsapp.net`, `fbcdn.net`, `fbsbx.com`), lido de um template existente, é recusado como amostra (`2388215 invalid media sample`). Link que a Meta não consegue baixar volta como `380 media download failed`.
  - No envio, "cabeçalho de mídia **exige** o parâmetro da imagem". O exemplo da doc mostra `components[].type` em minúsculo (`header`, `body`, `button`), mas só traz o caso de cabeçalho de texto. O formato do parâmetro de imagem não está escrito; segue-se o da Cloud API: `{ type: 'image', image: { link } }`.
- **Envio hoje**: o adapter (`hubmessage-template-sender.adapter.ts`) monta só `BODY` e `BUTTON`, em maiúsculo (armadilha 3 de `hubmessage.types.ts`, confirmada por envio real em 2026-08-06).
- **Mídia na HubMessage** vai sempre por URL (`HubMessageSendAttachment.url`). Não existe armazenamento de arquivos na API: o multipart do widget (`widget-message-upload.multer.ts`) é só Z-API e fica em memória.
- **Fila**: `core_thinkerszap_widget_outbox` guarda `templateParameters` e `templateButtonParameters`, e o despacho remonta o `TemplateMessageDescriptor` a partir da row (`templateDescriptorOf`).
- **Catálogo**: `toWidgetTemplate` hoje ignora o `HEADER`. Um template com imagem criado na Meta já aparece no widget e falha no envio.
- A mudança de botões (`thinkzap/botoes-template-oficial`) já percorreu as mesmas camadas (catálogo → widget → robô → fila → adapter → campanha SMS). Este design segue o mesmo caminho.

## Goals / Non-Goals

**Goals:**
- Isolar o formato da imagem de exemplo no adapter HubMessage: o domínio só conhece "arquivo" ou "link", e quem decide entre upload e `header_handle` com link é o adapter.
- Permitir que o operador envie o arquivo da imagem de exemplo, sem o ThinkZap guardar nada.
- Usar o mesmo caminho de valor por envio dos botões dinâmicos: do catálogo ao front, do front à fila e da fila ao adapter.

**Non-Goals:**
- Hospedar arquivos no ThinkZap (bucket, rota pública de mídia). O upload da criação vai da memória direto para a Omni e não é persistido; a imagem de envio continua sendo URL pública fornecida pelo cliente.
- Reaproveitar a imagem de exemplo como padrão no envio. O catálogo não guarda a URL que o cliente usou, e o `header_handle` devolvido pela Meta em templates sincronizados não é uma URL estável.

## Decisions

### D1. Imagem de exemplo por arquivo (upload à Omni) ou por link, com contrato neutro no domínio
O operador escolhe entre enviar o arquivo e informar um link. Pedido com arquivo vai em multipart: o campo `payload` leva o JSON (nome, categoria, idioma, componentes) e o arquivo vai em `headerImage`. Sem arquivo, o pedido continua JSON como hoje.

O componente neutro é `{ type: 'HEADER', format: 'IMAGE', example?: { imageUrl } }`, e o pedido tem **exatamente uma** fonte: o arquivo ou `imageUrl`. `CreateTemplateInput` ganha `headerSampleImage?: TemplateSampleImage` (bytes + tipo).

O adapter decide o formato:
- **Arquivo**: `uploadTemplateMedia` (`POST /whatsapp/businesses/{wabaId}/templates/media`, multipart `file` + `type`) → `h` → `example: { header_handle: [h] }`. Upload e criação acontecem no mesmo request, porque o `h` expira.
- **Link**: `example: { header_handle: [imageUrl] }`, o formato documentado pela Omni para link público, que ela converte no identificador da Meta.

O `422 MISSING_APP_CREDENTIALS` do upload vira `thinkzap.template.header_image_app_credentials_missing`, com mensagem dizendo que o envio de arquivo não está disponível na conta e que o operador pode usar o link (ou pedir a configuração de App ID/App Secret no painel da Omni).

A tarefa 1 confirma os dois caminhos numa WABA de teste e anota o resultado no JSDoc de `CreateTemplateParams` em `hubmessage.types.ts`.

*Alternativas descartadas*: (a) sempre fazer upload, inclusive para o link (a API baixaria a imagem e subiria). Faria a criação por link também depender das credenciais da Meta. (b) Integrar direto com a Resumable Upload API da Meta. Exige um app da Meta que não controlamos, e é exatamente o que a Omni já faz por nós.

### D2. Validar e baixar a imagem de exemplo na API
A API recusa link do CDN da Meta (`whatsapp.net`, `fbcdn.net`, `fbsbx.com`) e depois baixa a URL de exemplo antes de chamar o provider, com limite de 5 MB e conferindo o `Content-Type` (`image/jpeg`, `image/png`). Isso transforma `2388215` e `380` (recusas da Meta difíceis de entender) em um erro de definição inválida que o operador consegue corrigir. O download segue o padrão de `fetchRobotFiles` (axios com `maxContentLength`, que encerra quando passa do limite).

O arquivo enviado passa pelas mesmas travas: no máximo 5 MB (limite do multer, em memória) e JPEG/PNG **pela assinatura do arquivo** (`FF D8 FF` / `89 50 4E 47`), não pelo tipo que o navegador declara.

### D3. Imagem do envio por URL, guardada em coluna nova
A URL da imagem do envio entra em `TemplateMessageDescriptor.headerImageUrl?: string` e numa coluna anulável nova, `template_header_image_url`, em `core_thinkerszap_widget_outbox`. Um campo próprio, e não um item em `templateButtonParameters`, porque o cabeçalho não tem `index` e misturar os dois confundiria o despacho.

O adapter monta `{ type: 'HEADER', parameters: [{ type: 'image', image: { link } }] }` antes do `BODY`. O `type` vai em maiúsculo, como os demais componentes (armadilha 3). A doc nova mostra minúsculo, mas o maiúsculo é o que foi confirmado em envio real. A tarefa 1.2 confirma o parâmetro de imagem, que a doc não escreve, e testa minúsculo se o maiúsculo for recusado.

*Alternativa descartada*: subir o arquivo pelo widget e hospedar no ThinkZap. Exigiria armazenamento público e limpeza, fora do escopo (ver Non-Goals).

### D4. Catálogo com `header`
`WidgetTemplate` ganha `header: { type: 'NONE' | 'TEXT' | 'IMAGE' }`. Um helper novo, `templateHeaderOf(components)`, em `domain/template-header.ts` (irmão de `template-buttons.ts`), lê o `HEADER`: sem cabeçalho = `NONE`, texto sem `{{` = `TEXT`, imagem = `IMAGE`. Qualquer outro caso (vídeo, documento, localização, texto com variável) fica `UNSUPPORTED`, e `ListWidgetTemplatesUseCase` filtra esses templates. A tela do robô usa o mesmo catálogo, então herda o filtro.

### D5. Robô: propriedade `templateHeaderImageUrl`
Nova propriedade `Type: 'string'`, não múltipla, em `templateRobotProperties()`. Ao resolver os valores no disparo, a API usa os mesmos helpers de campo do documento que `resolve-robot-button-parameters.ts`. URL vazia ou sem `https` registra um aviso novo em `timeline-notices.ts` (`templateRobot.missingHeaderImage`, nos três idiomas) e não enfileira. Os robôs já instalados ganham a propriedade quando o `ensure-template-robot` os registra de novo, já que `ensureTemplateRobot` faz `bizproc.robot.add` e, se o robô já existe, `bizproc.robot.update`.

### D6. Campanha SMS
`manage-line-sms-provider.ts` ganha `hasImageHeader` ao lado de `hasDynamicButton`, e o handler da campanha recusa pelo mesmo caminho da recusa de botão dinâmico, com um código de motivo novo no catálogo de erros (`thinkzap.template.image_header_not_supported`).

### D7. Validação no front espelha a API
`template-form.tsx` ganha a seção de cabeçalho (nenhum / imagem). A validação de URL `https` e a regra "não em Autenticação" ficam num helper puro, no mesmo arquivo de regras que os botões usam, para o front e os testes compartilharem a lógica. A checagem de tamanho e tipo do link só acontece na API (o front não baixa a imagem).

A imagem de exemplo tem duas opções: "Enviar arquivo" e "Usar link". O arquivo é conferido também no cliente (tipo e 5 MB), o preview usa object URL, e o pedido sai em multipart quando há arquivo.

## Risks / Trade-offs

- [O upload exige App ID/App Secret da Meta cadastrados no painel da Omni, e ainda não se sabe se são da nossa conta ou de cada WABA] → Sem eles, o envio de arquivo falha com mensagem legível e o link continua disponível. Envio, lista e catálogo não dependem disso.
- [Arquivo malicioso com extensão de imagem] → O tipo é decidido pela assinatura do arquivo, não pelo `mimetype` do navegador, e o arquivo nunca é gravado em disco nem servido pelo ThinkZap.
- [Base URL] → A doc nova usa `https://api.omni.z-api.io`, e o padrão de `env.hubMessage.baseUrl` ainda é `https://api.hubmessage.io`. Não muda nesta mudança, mas a tarefa 1 registra se o domínio antigo continua respondendo.
- [A Meta não consegue baixar a URL no envio (host bloqueado, URL expirada, link de Drive)] → A falha chega à timeline pelo caminho atual de falha de template. A tela e a ajuda dizem que a URL precisa ser pública e direta para o arquivo.
- [URL do Bitrix (`urlMachine`) usada como imagem no robô] → Ela leva um token que expira, e um reenvio tardio falharia. Fica documentado que o campo espera uma URL pública. Não tentamos converter campo de arquivo em URL.
- [Download da imagem de exemplo vira SSRF] → Só `https`, recusa de host que resolva para IP privado ou de loopback (inclusive depois de redirect), timeout curto e limite de 5 MB.
- [Filtrar templates com cabeçalho não suportado tira do widget templates que hoje aparecem] → Hoje eles já falham no envio. Esconder troca uma falha assíncrona por ausência, e a lista de templates da configuração continua mostrando todos.

## Migration Plan

1. Migration Prisma aditiva (`template_header_image_url TEXT NULL`). Rows antigas ficam nulas = envio sem imagem.
2. Deploy da API antes do front. A API aceita pedidos sem os campos novos, então o front antigo segue funcionando.
3. Reinstalar os robôs de template pelo fluxo já existente para registrar a nova propriedade.
4. Rollback: reverter o código. A coluna nula pode ficar.

## Open Questions

- Se o domínio `api.hubmessage.io` vai ser desligado em favor de `api.omni.z-api.io`. Isso é troca de variável de ambiente e não muda este plano.
- Quem cadastra App ID/App Secret na Omni (nós ou cada cliente), e se o cadastro é por conta ou por WABA.
