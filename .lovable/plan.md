Diagnóstico: a loja Rei do Litoral está correta e o admin tem permissão no banco. O problema está no fluxo da rota: ao abrir o link direto, a checagem de login roda cedo demais e pode mandar para `/auth`; como a tela de login redireciona usuário já logado para `/`, parece que o link “volta para o início”.

Plano de correção:

1. Ajustar a rota `/pedidos-loja/$storeId/impressao`
   - Remover o redirecionamento imediato do `beforeLoad` dessa página.
   - Fazer a checagem de sessão dentro da própria tela, aguardando o login carregar corretamente.
   - Se não estiver logado, mostrar um botão “Entrar para ativar impressão” levando para `/auth`.
   - Se estiver logado mas sem permissão, mostrar mensagem clara em vez de redirecionar silenciosamente.
   - Se tiver permissão, mostrar “Conectado — aguardando pedidos”.

2. Preservar o link após login
   - Atualizar `/auth` para aceitar um parâmetro de retorno, por exemplo:

```text
/auth?redirect=/pedidos-loja/6d08cbcc-5ec8-4b8a-9587-b5822483cbc0/impressao
```

   - Depois de entrar, voltar automaticamente para a página de impressão em vez de ir para a tela inicial.

3. Melhorar mensagens para instalação em modo quiosque
   - Se o Chrome abrir o link sem sessão salva, a página deve orientar o usuário a fazer login uma vez no navegador normal.
   - Depois disso, o atalho com `--kiosk-printing` deve abrir direto na tela de impressão.

4. Verificação final
   - Testar o fluxo do link direto logado.
   - Testar o fluxo deslogado → login → retorno para impressão.
   - Confirmar que admins e donos de loja conseguem acessar a página.