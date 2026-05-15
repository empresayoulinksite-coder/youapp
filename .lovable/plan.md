# Gerar o certificado QZ Tray automaticamente (sem PowerShell, sem site externo)

## A ideia

Em vez de você gerar o certificado no Windows, **eu crio um endpoint temporário** no próprio backend do app que:
1. Gera o par de chaves RSA 2048 + certificado auto-assinado válido por 10 anos
2. Salva a chave privada automaticamente como secret `QZ_PRIVATE_KEY`
3. Salva o certificado público automaticamente em `src/lib/qz-certificate.ts`
4. Te devolve **apenas o arquivo `override.crt`** pra você baixar

Você só precisa:
- Clicar num botão "Gerar certificado QZ" (vou colocar uma página `/admin/qz-setup` temporária)
- Baixar o `override.crt`
- Copiar pra pasta do QZ Tray em cada PC da loja
- Reiniciar o QZ Tray

Pronto. Sem PowerShell, sem site externo, sem copiar/colar chave.

## Passo a passo do que vou fazer

### 1. Criar a página `/admin/qz-setup`
Página simples com um botão "Gerar certificado". Só admin acessa.

### 2. Criar o server function `generateQzCertificate`
Usa o módulo `crypto` nativo do Node pra:
- Gerar par RSA 2048
- Criar certificado X.509 auto-assinado (CN: "QZ Tray Cert", validade 10 anos)
- Retornar 3 strings: `privateKey`, `publicCert`, `overrideCrt` (no formato que o QZ Tray espera)

### 3. Salvar automaticamente os artefatos
- Chave privada → secret `QZ_PRIVATE_KEY` (via API de secrets do projeto)
- Certificado público → escreve em `src/lib/qz-certificate.ts`
- `override.crt` → disponibiliza pra download direto no navegador

### 4. Configuração final do PC da loja (uma vez por PC)
Te mando passo a passo curto com prints/caminhos:
- Onde fica a pasta do QZ Tray no Windows (`C:\Program Files\QZ Tray\`)
- Onde colocar o `override.crt`
- Como reiniciar o serviço

## O que muda em relação ao plano anterior

| Antes | Agora |
|-------|-------|
| Você roda PowerShell | Eu gero tudo no backend |
| Você cola chave privada manualmente no formulário de secret | Salvo automaticamente |
| Você edita `qz-certificate.ts` | Salvo automaticamente |
| Você só baixa `override.crt` |  Igual |

## Detalhes técnicos

**Novo:**
- `src/lib/qz-cert-generator.functions.ts` — server function que gera o par usando `crypto.generateKeyPairSync('rsa', { modulusLength: 2048 })` + monta certificado X.509 com `node-forge` (lib pure-JS, compatível com Cloudflare Workers)
- `src/routes/admin.qz-setup.tsx` — página admin com botão "Gerar" e link de download do `override.crt`

**Dependência nova:**
- `node-forge` — necessário porque o módulo `crypto` nativo do Node não cria certificados X.509, só chaves. `node-forge` é pure-JS e funciona no runtime do Cloudflare Workers.

**Mantido do plano anterior:**
- `src/lib/qz-sign.functions.ts` (assinatura SHA512withRSA)
- `src/lib/qz-printer.ts` (registra `setCertificatePromise` + `setSignaturePromise`)
- `src/lib/qz-certificate.ts` (mas agora preenchido automaticamente)

## Resultado final

1. Você abre `/admin/qz-setup`, clica "Gerar"
2. Baixa `override.crt`
3. Copia pra pasta do QZ Tray de cada PC da loja
4. Imprime sem nenhum prompt — pra sempre

Se aprovar, eu implemento e te mando o link da página `/admin/qz-setup` pra você clicar.
