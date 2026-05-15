## Diagnóstico

Pelo print, o QZ Tray está mostrando:

- `Organization: Unknown`
- `Common Name: An anonymous request`
- `Validity: Invalid Certificate`
- `Trusted: Untrusted website`

Isso indica que o navegador/QZ Tray não está recebendo o certificado público gerado pelo sistema. No banco também não há nenhum certificado salvo ainda (`qz_certificates` está vazio), então a conexão cai como requisição anônima.

## Plano de correção

1. **Corrigir o carregamento do certificado no QZ Tray**
   - Fazer o `setCertificatePromise` falhar de forma explícita quando não houver certificado, em vez de deixar o QZ continuar como “anonymous request”.
   - Garantir que o certificado público seja entregue antes da conexão WebSocket com o QZ Tray.

2. **Corrigir a página `/admin/qz-setup` para confirmar o estado real**
   - Mostrar se já existe certificado gerado no backend.
   - Depois de clicar em “Gerar certificado”, confirmar na tela que ele foi salvo.
   - Se ainda não existir certificado, exibir aviso claro antes do usuário tentar imprimir.

3. **Adicionar um teste interno de assinatura/certificado**
   - Criar uma função de verificação admin-only que confere se há certificado salvo e se a chave privada consegue assinar corretamente.
   - Mostrar o resultado na página de setup para evitar instalar um `override.crt` vazio/antigo.

4. **Ajustar as instruções para Windows/QZ Tray**
   - Explicar que depois de gerar o certificado é obrigatório copiar o `override.crt` baixado para:
     ```text
     C:\Program Files\QZ Tray\override.crt
     ```
   - Orientar a fechar o QZ Tray completamente e abrir novamente.
   - Avisar que, se gerar um certificado novo, precisa substituir o `override.crt` em todos os computadores.

5. **Verificação**
   - Conferir que o certificado foi salvo no backend.
   - Conferir que a página de setup abre e mostra o status correto.
   - Conferir que a integração QZ não segue mais silenciosamente como requisição anônima quando o certificado não existir.