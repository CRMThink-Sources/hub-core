# Design

## Context

- O envio de template com imagem pelo widget já existe por URL (mudança `imagem-cabecalho-template-oficial`): `send-widget-template` aceita `headerImageUrl` `https`, a URL é gravada em `template_header_image_url` na fila e o adapter monta o `HEADER`. Esta mudança só precisa produzir essa URL a partir de um arquivo.
- A Meta baixa a imagem pela URL no momento da entrega (e de novo em reenvio), então a URL precisa ser pública, direta para o arquivo e estável enquanto houver reenvio possível.
- Já existem no código: `sniffTemplateImageType` (tipo pelo conteúdo) e `TEMPLATE_SAMPLE_IMAGE_MAX_BYTES` (5 MB) em `domain/`; o padrão de multer em memória com `400` legível (`template-header-image-upload.multer.ts`); e o multipart do widget (`send-widget-multipart`), cujo client do front já remove o `Content-Type` para `FormData`.
- Não existe armazenamento de objetos no projeto nem `@aws-sdk/client-s3`. O bucket R2 de staging foi criado com as variáveis `R2_*`; o de produção ainda não está configurado.
- A rota de upload de mídia de template da Z-API Omni (`templates/media`) responde `405` (não publicada), o que bloqueia hoje o upload por arquivo na **criação** do template.

## Goals / Non-Goals

**Goals:**
- Manter o envio inalterado: o upload devolve uma URL e o resto do fluxo é o do link.
- Isolar o armazenamento atrás de um port, para trocar R2 por outro provedor sem mexer em domínio, rota ou front.

**Non-Goals:**
- Guardar histórico de imagens ou servir arquivos por uma rota nossa.
- Deduplicar imagens repetidas entre envios.
- Antivírus ou processamento de imagem (redimensionar, comprimir).

## Decisions

### D1. Rota de upload separada do envio
`POST /thinkzap/messages/widget-template-header-image` recebe o arquivo (`multipart`, campo `image`) e devolve `{ url }`. O widget sobe o arquivo assim que o operador escolhe, mostra o preview pela URL devolvida e, no envio, manda `headerImageUrl` pela rota de envio que já existe.

*Alternativa descartada*: mandar o arquivo junto do envio (multipart em `send-widget-template`). Mudaria a rota e o contrato de envio, perderia o preview da imagem já hospedada, e uma falha no envio obrigaria a subir o arquivo de novo.

### D2. Port `TemplateImageStorage` no domínio, adapter R2 na infra
O port tem um método: `store({ data, contentType, scope }) → { url }`. O adapter usa `@aws-sdk/client-s3` contra o endpoint `https://<R2_ACCOUNT_ID>.r2.cloudflarestorage.com` (compatível com S3) e monta a URL com `R2_PUBLIC_BASE_URL`. `Content-Type` do objeto vem da assinatura do arquivo, não do navegador.

*Alternativa descartada*: Drive do Bitrix (`disk.storage.getForApp` + `disk.file.getExternalLink`). Exige escopo `disk`, depende de link público habilitado no portal, e não se sabe se o link externo entrega o arquivo ou uma página HTML.

### D3. Chave do objeto impossível de adivinhar, com retenção pelo bucket
Chave `template-headers/<domainId>/<AAAA-MM>/<uuid v4>.<png|jpg>`. O `uuid` torna a URL inadivinhável; `domainId` permite apagar por cliente se preciso. A expiração de 30 dias é a regra de ciclo de vida do bucket (já configurada em staging), então não há job de limpeza. A API não lista nem apaga objetos.

### D4. Validação antes de gravar
Multer em memória com limite de 5 MB (`400` legível acima disso, no padrão do middleware da criação). No use case, `sniffTemplateImageType` decide JPEG/PNG; qualquer outra coisa é recusada antes de chamar o armazenamento.

### D5. Disponibilidade derivada da configuração
Sem as cinco variáveis `R2_*`, nenhum adapter é montado e o catálogo do widget (`/messages/widget-templates/:id`) responde `headerImageUpload: false` junto da lista. O front esconde a opção de arquivo nesse caso. Assim produção pode subir antes de o bucket existir.

### D6. Erros
- Arquivo inválido ou grande: `400`, código `thinkzap.message.widget_header_image_invalid`.
- Armazenamento indisponível (configuração ausente, falha do R2): `503`, código `thinkzap.message.widget_header_image_storage_unavailable`, mensagem sugerindo usar link.
Cada código com runbook em `mcp/kb/runbooks/hubcore/thinkzap/message/`.

## Risks / Trade-offs

- [Qualquer usuário do Bitrix com acesso ao widget pode hospedar imagens publicamente por 30 dias] → Só JPEG/PNG pelo conteúdo, até 5 MB, rota autenticada pelo JWT do widget, chave por `domainId` e log de cada upload (domínio, usuário, tamanho, chave). Limite por usuário fica para depois, se o volume pedir.
- [Reenvio depois de 30 dias encontra a imagem expirada] → A fila retenta em minutos/horas, muito antes da expiração. Um reenvio manual tardio falha pela Meta e aparece na timeline pelo caminho atual.
- [Imagem com dados pessoais fica pública enquanto não expira] → URL inadivinhável e prazo curto. A tela avisa que a imagem fica acessível por link.
- [`r2.dev` tem limite de requisições] → Usado só em staging; produção usa domínio próprio.
- [Upload órfão (operador sobe e não envia)] → Expira pela mesma regra de 30 dias; custo desprezível.

## Migration Plan

1. Configurar em produção o bucket, a regra de 30 dias, o domínio público e as variáveis `R2_*`. Sem elas o recurso fica desligado (D5).
2. Deploy da API antes do front: a flag `headerImageUpload` ausente vale como `false` no front.
3. Rollback: reverter o código. Objetos já gravados expiram sozinhos.

## Open Questions

- Usar o mesmo bucket para o upload por arquivo na **criação** do template enquanto a rota `templates/media` da Omni não for publicada (a API subiria o arquivo no R2 e mandaria o link em `header_handle`). Não muda esta mudança; seria uma mudança à parte, que reaproveita o port.
- Domínio público de produção (nome do subdomínio).
