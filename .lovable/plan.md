## Problema

Ao clicar em "Conectar USB", o navegador mostra "Nenhum dispositivo compatível encontrado" mesmo com a impressora plugada.

**Causa:** estamos usando a API **Web Serial** (`navigator.serial`), que só enxerga dispositivos que aparecem como porta COM/serial (geralmente impressoras com chip conversor USB-Serial ou drivers virtuais COM instalados). A maioria das impressoras térmicas USB modernas (Epson, Bematech, Elgin, Knup, Goojprt, etc.) se identificam ao sistema como **dispositivos USB de classe Printer (classe 7)** — para essas, é preciso usar a API **WebUSB** (`navigator.usb`).

## Solução

Adicionar suporte a **WebUSB** como caminho principal para "Conectar USB", mantendo Web Serial como alternativa.

### 1. `src/lib/thermal-printer.ts`

- Adicionar `hasUSB()` checando `"usb" in navigator`.
- Adicionar `connectUSB()`:
  - `navigator.usb.requestDevice({ filters: [{ classCode: 7 }] })` (classe Printer) — mostra qualquer impressora USB conectada.
  - `device.open()`, `selectConfiguration(1)`, encontrar a primeira interface com `interfaceClass === 7`, `claimInterface(...)`, achar o endpoint `direction === "out"`.
  - `write(bytes)` envia em chunks de ~64 bytes via `device.transferOut(endpoint, slice)`.
  - `disconnect()` faz `releaseInterface` + `device.close()`.
- Novo `PrinterKind`: `"usb"` (WebUSB) — manter `"serial"` para o caso raro de COM virtual.

### 2. `src/components/painel/OrdersManager.tsx`

- Renomear o botão atual "Conectar USB" para chamar `connectUSB()` (WebUSB).
- Adicionar um botão secundário pequeno "Porta serial (COM)" que chama o `connectSerial()` antigo, para quem realmente precisa.
- Mensagens de erro mais claras: se `requestDevice` for cancelado ou nenhum device aparecer, mostrar dica: *"Verifique se a impressora está ligada, conectada e se o driver não está bloqueando o acesso. Em Windows, pode ser necessário usar Zadig para trocar o driver para WinUSB."*
- Aviso visível no diálogo: "USB funciona em Chrome/Edge no desktop. No celular, use Bluetooth."

### 3. Compatibilidade

- WebUSB: Chrome/Edge desktop (Windows, macOS, Linux) e Android. Não funciona em iOS/Safari/Firefox.
- Requer HTTPS (já temos no preview/produção).
- Em Windows, se a impressora já tem driver de impressão instalado, ele "trava" o dispositivo — pode ser necessário desinstalar o driver ou usar Zadig (vamos documentar isso na mensagem de erro).

### 4. Validação

Após implementar:
1. Plugar a impressora térmica USB.
2. Abrir Configurações → "Conectar USB" → escolher a impressora na lista do navegador.
3. Clicar "Imprimir teste" e confirmar saída do papel.
4. Aceitar um pedido e confirmar impressão automática.

## Arquivos alterados

- `src/lib/thermal-printer.ts` (adicionar WebUSB)
- `src/components/painel/OrdersManager.tsx` (botão USB usa WebUSB, adicionar fallback serial)
