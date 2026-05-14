
# Configurar QZ Tray com assinatura via backend

Objetivo: eliminar de vez o prompt "Allow / Remember this decision" do QZ Tray, fazendo o site assinar cada pedido de impressão com um certificado digital. Resultado: impressão 100% silenciosa, sem nenhum diálogo.

## Como vai funcionar

```text
┌─────────┐   1. pede assinatura    ┌──────────────┐
│ Site    │ ──────────────────────► │ Backend      │
│ (QZ.js) │ ◄────────────────────── │ (chave priv.)│
└────┬────┘   2. devolve assinatura └──────────────┘
     │
     │ 3. envia pra impressora COM assinatura
     ▼
┌──────────┐
│ QZ Tray  │ → reconhece certificado confiável → imprime sem prompt
└──────────┘
```

A chave privada **nunca** sai do servidor. O navegador só pede ao backend para assinar cada requisição.

## Passo a passo do que vou fazer

### Etapa 1 — Você gera o certificado (uma vez, no seu Windows)

Vou te entregar um **comando único de PowerShell** para rodar no seu PC. Ele:
- Gera `private-key.pem` (chave privada — você vai me passar via secret seguro)
- Gera `digital-certificate.txt` (certificado público — vai no código)
- Gera `override.crt` (vai no QZ Tray de cada PC da loja)

Tempo: ~30 segundos.

### Etapa 2 — Configuração no projeto (eu faço)

1. Crio um **server function** `signQzRequest` (`src/lib/qz-sign.functions.ts`) que recebe um payload do QZ e devolve a assinatura SHA512withRSA usando a chave privada armazenada como secret `QZ_PRIVATE_KEY`.
2. Adiciono o certificado público em `src/lib/qz-certificate.ts` (constante exportada — pode ficar no código, é público).
3. Atualizo `src/lib/qz-printer.ts` para registrar:
   - `qz.security.setCertificatePromise` → retorna o certificado público
   - `qz.security.setSignaturePromise` → chama o server function pra assinar
4. Peço o secret `QZ_PRIVATE_KEY` via `add_secret` (você cola o conteúdo do `private-key.pem`).

### Etapa 3 — Você configura cada PC da loja (uma vez por máquina)

Te entrego um passo a passo curto:
1. Copiar `override.crt` para a pasta de instalação do QZ Tray.
2. Reiniciar o QZ Tray.
3. Pronto — abre o painel, clica imprimir, **nunca mais aparece prompt**.

## Detalhes técnicos

**Arquivos novos:**
- `src/lib/qz-sign.functions.ts` — server function que assina com `crypto.createSign('SHA512')`
- `src/lib/qz-certificate.ts` — exporta o certificado público como string

**Arquivos editados:**
- `src/lib/qz-printer.ts` — registra `setCertificatePromise` e `setSignaturePromise` antes de `qz.websocket.connect()`

**Secret novo:**
- `QZ_PRIVATE_KEY` — conteúdo do `private-key.pem` (PEM com `-----BEGIN PRIVATE KEY-----`)

**Algoritmo de assinatura:** SHA512withRSA (padrão do QZ Tray 2.1+).

**Compatibilidade:** funciona com a versão atual do QZ Tray que você já instalou. Não precisa reinstalar nada.

## O que você precisa fazer depois que eu implementar

1. Rodar o comando PowerShell que vou mandar (gera os 3 arquivos).
2. Colar o conteúdo do `private-key.pem` no formulário de secret.
3. Copiar o `override.crt` pra pasta do QZ Tray e reiniciar o serviço.
4. Testar — deve imprimir silencioso na primeira tentativa.

Se aprovar o plano, vou implementar e em seguida te passar o comando exato do PowerShell pra você rodar.
