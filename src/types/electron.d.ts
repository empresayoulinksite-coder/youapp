export {};

declare global {
  interface ElectronPrintOptions {
    html: string;
    printerName?: string | null;
  }

  interface ElectronPrintResult {
    success: boolean;
    error?: string;
  }

  interface ElectronAPI {
    getPrinters: () => Promise<string[]>;
    print: (opts: ElectronPrintOptions) => Promise<ElectronPrintResult>;
  }

  interface Window {
    electronAPI?: ElectronAPI;
    // Legado: bridge antigo só com print(html)
    electronPrint?: {
      print: (html: string) => Promise<unknown> | unknown;
    };
  }
}
