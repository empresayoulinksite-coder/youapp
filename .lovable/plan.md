## Diagnóstico

Verifiquei os logs de autenticação da Lovable Cloud na última hora e **nenhuma chamada para `/recover` foi registrada**. Isso indica que a requisição da extensão nem chegou ao servidor — ou porque a extensão instalada ainda é a versão antiga (sem o botão funcional), ou porque o formato do body está incorreto.

Encontrei **2 problemas** no código atual:

### Problema 1 — Formato errado do body
Em `extension/background.js`, a chamada está assim:
```js
body: JSON.stringify({ email, options: { redirectTo } })
```
A API REST do GoTrue (Supabase Auth) **não aceita** `options.redirectTo` — esse formato é só do SDK JS. A API espera `redirect_to` como **query param** na URL:
```
POST /auth/v1/recover?redirect_to=<url>
{ "email": "..." }
```
Sem isso, mesmo se a request chegasse, o redirect cairia no padrão (raiz do site) e perderia o `#type=recovery`.

### Problema 2 — A extensão instalada está desatualizada
O usuário instalou o `.zip` antes de termos adicionado o botão "definir uma senha" funcionar. O `popup.html` mostra o botão, mas o `background.js` velho não tem o handler `forgotPassword` — então o `sendResponse` nunca volta `{ok:true}` e nada é enviado. (Isso explica por que não há nenhum log no servidor.)

## Plano de correção

1. **Corrigir `extension/background.js`** — mover `redirect_to` para query string e remover `options`:
   ```js
   const url = `${AUTH_URL}/recover?redirect_to=${encodeURIComponent(msg.redirectTo)}`;
   const res = await fetch(url, {
     method: "POST",
     headers: { "Content-Type": "application/json", apikey: SUPABASE_ANON_KEY },
     body: JSON.stringify({ email: msg.email }),
   });
   ```

2. **Reempacotar `public/youapp-print.zip`** com a nova versão do `background.js`.

3. **Instruir o usuário** a:
   - Baixar o `.zip` atualizado novamente em Admin → Impressão Automática
   - Em `chrome://extensions`, clicar no botão **"Recarregar"** (🔄) da extensão YouApp Print **OU** remover e instalar de novo a partir da pasta extraída
   - Abrir o popup, digitar o email, clicar em "definir uma senha"
   - Verificar a caixa de entrada (e a pasta de **spam**) do Gmail

4. **Validação** — depois que o usuário tentar de novo, eu consulto os logs de auth para confirmar que a chamada `/recover` chegou com status 200.

## Observação (opcional, para depois)

Se o email continuar não chegando mesmo após a correção, pode ser que o template de "Reset Password" da Cloud esteja desabilitado ou que o domínio de envio não esteja configurado. Nesse caso, o próximo passo seria configurar um domínio de envio em **Cloud → Emails** para garantir entregabilidade. Mas vamos tentar a correção acima primeiro — em 90% dos casos resolve.
