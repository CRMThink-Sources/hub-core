# Tasks

## 1. Configuração e dependência

- [x] 1.1 Adicionar `@aws-sdk/client-s3` ao `api/package.json` e instalar. Verificação: `yarn` conclui e o `tsc` da API importa `S3Client` sem erro.
- [x] 1.2 Adicionar o bloco `r2` em `api/src/config/env.ts` (`accountId`, `accessKeyId`, `secretAccessKey`, `bucket`, `publicBaseUrl`, padrão vazio) e as chaves comentadas em `api/.env.example`. Verificação: `tsc` sem erro e `.env.example` documenta as cinco variáveis.

## 2. Armazenamento (domínio e infra)

- [x] 2.1 Criar o port `domain/ports/template-image-storage.port.ts` (`store({ data, contentType, scope: { domainId } }) → { url }`) e o erro `TemplateImageStorageUnavailableError`. Verificação: `tsc` sem erro.
- [x] 2.2 Criar `infra/adapters/r2-template-image-storage.adapter.ts` com `PutObjectCommand` (chave `template-headers/<domainId>/<AAAA-MM>/<uuid>.<png|jpg>`, `ContentType` do arquivo) e URL `R2_PUBLIC_BASE_URL/<chave>`; falha do S3 vira `TemplateImageStorageUnavailableError`. Verificação: teste com `S3Client` mockado confere bucket, formato da chave, `ContentType`, URL devolvida e tradução da falha.
- [x] 2.3 Criar a fábrica que monta o adapter só com as cinco variáveis `R2_*` preenchidas e devolve `null` caso contrário. Verificação: teste da fábrica com env completo e incompleto.

## 3. Upload pela API

- [x] 3.1 Criar o use case `UploadWidgetTemplateHeaderImageUseCase`: valida 5 MB e JPEG/PNG por `sniffTemplateImageType`, recusa sem chamar o armazenamento, grava e registra log (domínio, usuário, tamanho, chave). Sem armazenamento configurado, lança `TemplateImageStorageUnavailableError`. Verificação: testes com PNG, JPEG, PDF renomeado, 6 MB e armazenamento ausente.
- [x] 3.2 Criar o controller e a rota `POST /thinkzap/messages/widget-template-header-image` (multer em memória, campo `image`, limite 5 MB com `400` legível, no padrão de `template-header-image-upload.multer.ts`): `200 { url }`, `400` para arquivo inválido, `503` para armazenamento indisponível. Verificação: testes do controller e do middleware com servidor real (arquivo válido, 6 MB, sem arquivo).
- [x] 3.3 Registrar `thinkzap.message.widget_header_image_invalid` e `thinkzap.message.widget_header_image_storage_unavailable` no catálogo de erros, com runbooks em `mcp/kb/runbooks/hubcore/thinkzap/message/`. Verificação: `catalog.test.ts` passa.
- [x] 3.4 Em `/messages/widget-templates/:id`, devolver `headerImageUpload: boolean` junto da lista, conforme a fábrica de 2.3. Verificação: teste do controller com e sem armazenamento.

## 4. Widget (front)

- [x] 4.1 Em `use-widget-templates.ts`, ler `headerImageUpload` (ausente = `false`) e criar o client de upload `uploadWidgetHeaderImage(file) → url` com `FormData`. Verificação: teste do builder do `FormData` e `tsc` do front.
- [x] 4.2 Em `template-composer.tsx` / `conversation-view.tsx`, oferecer "Enviar arquivo" (padrão quando disponível) / "Usar link"; validar tipo e 5 MB no cliente; subir ao escolher; mostrar progresso, erro e preview pela URL devolvida; preencher `headerImageUrl` com ela; desabilitar o envio durante o upload ou após falha; limpar ao trocar de template ou de linha. Verificação: testes do helper de validação e do "pode enviar" em `template-variables.ts`, e envio manual em dev.
- [x] 4.3 Texto de aviso de que a imagem fica acessível por link e expira em 30 dias (o widget é só pt-br, como o restante). Verificação: aviso visível no modo arquivo em dev.

## 5. Integração

- [x] 5.1 Em staging: subir uma imagem pelo widget, abrir a URL devolvida numa janela anônima, enviar o template e conferir a imagem no aparelho e o histórico no CRM; conferir que a regra de 30 dias está ativa no bucket. Verificação: checklist anexado ao PR.
- [x] 5.2 Rodar lint, testes e `tsc` na API e no front. Verificação: tudo verde (exceto falhas pré-existentes documentadas no PR).
