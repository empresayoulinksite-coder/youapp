const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');

const isDev = !app.isPackaged;

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    title: 'Youapp',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  if (isDev && process.env.ELECTRON_START_URL) {
    win.loadURL(process.env.ELECTRON_START_URL);
  } else {
    win.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));
  }

  // IPC: listar impressoras do sistema
  ipcMain.handle('printers:list', async () => {
    try {
      const wc = win.webContents;
      const list = typeof wc.getPrintersAsync === 'function'
        ? await wc.getPrintersAsync()
        : (typeof wc.getPrinters === 'function' ? wc.getPrinters() : []);
      return (list || []).map((p) => p && p.name).filter(Boolean);
    } catch (e) {
      console.error('printers:list error', e);
      return [];
    }
  });

  // IPC: imprimir HTML em impressora específica (silencioso)
  ipcMain.handle('printers:print', async (_evt, opts) => {
    const { html, printerName } = opts || {};
    if (!html) return { success: false, error: 'HTML vazio' };

    return await new Promise((resolve) => {
      const printWin = new BrowserWindow({
        show: false,
        webPreferences: { offscreen: false, contextIsolation: true, nodeIntegration: false },
      });
      const dataUrl = 'data:text/html;charset=utf-8,' + encodeURIComponent(html);
      printWin.loadURL(dataUrl).then(() => {
        printWin.webContents.print(
          {
            silent: true,
            printBackground: true,
            deviceName: printerName || undefined,
          },
          (success, failureReason) => {
            try { printWin.close(); } catch {}
            resolve({ success, error: success ? undefined : failureReason });
          }
        );
      }).catch((err) => {
        try { printWin.close(); } catch {}
        resolve({ success: false, error: String(err && err.message || err) });
      });
    });
  });
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
