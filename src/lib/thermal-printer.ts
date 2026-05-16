// Thermal printer support (ESC/POS) via Web Bluetooth / Web Serial.
// Falls back to native browser print dialog when neither is available.

export type PrinterKind = "bluetooth" | "usb" | "serial" | "browser";

export type PrinterConnection = {
  kind: PrinterKind;
  label: string;
  write: (bytes: Uint8Array) => Promise<void>;
  disconnect: () => Promise<void>;
};

const PREF_KEY_PREFIX = "thermal-printer:";

export type PrinterPrefs = {
  autoPrint: boolean;
  kind: PrinterKind | null;
  deviceName: string | null;
};

type ElectronPrintResult = boolean | { success?: boolean; error?: string } | void;
type ElectronPrintBridge = {
  print: (html: string) => Promise<ElectronPrintResult> | ElectronPrintResult;
};

function getElectronPrintBridge(): ElectronPrintBridge | null {
  if (typeof window === "undefined") return null;
  const bridge = (window as unknown as { electronPrint?: Partial<ElectronPrintBridge> }).electronPrint;
  return typeof bridge?.print === "function" ? (bridge as ElectronPrintBridge) : null;
}

function wasElectronPrintSuccessful(result: ElectronPrintResult) {
  if (result === false) return false;
  if (result && typeof result === "object" && "success" in result) return result.success !== false;
  return true;
}

export function loadPrefs(storeId: string): PrinterPrefs {
  try {
    const raw = localStorage.getItem(PREF_KEY_PREFIX + storeId);
    if (!raw) return { autoPrint: false, kind: null, deviceName: null };
    return JSON.parse(raw);
  } catch {
    return { autoPrint: false, kind: null, deviceName: null };
  }
}

export function savePrefs(storeId: string, prefs: PrinterPrefs) {
  try {
    localStorage.setItem(PREF_KEY_PREFIX + storeId, JSON.stringify(prefs));
  } catch {
    // ignore
  }
}

// Common Bluetooth thermal printer service (Inner Printer / generic ESC/POS BT)
const BT_SERVICE = "000018f0-0000-1000-8000-00805f9b34fb";
const BT_CHARACTERISTIC = "00002af1-0000-1000-8000-00805f9b34fb";

let activeConnection: PrinterConnection | null = null;

export function getActiveConnection(): PrinterConnection | null {
  return activeConnection;
}

export function hasBluetooth(): boolean {
  return typeof navigator !== "undefined" && "bluetooth" in navigator;
}

export function hasUSB(): boolean {
  return typeof navigator !== "undefined" && "usb" in navigator;
}

export function hasSerial(): boolean {
  return typeof navigator !== "undefined" && "serial" in navigator;
}

export async function connectUSB(): Promise<PrinterConnection> {
  if (!hasUSB()) {
    throw new Error(
      "WebUSB não suportado. Use Chrome ou Edge no computador (ou Android).",
    );
  }
  // @ts-expect-error - WebUSB types not in TS lib
  const device = await navigator.usb.requestDevice({
    filters: [{ classCode: 7 }], // USB Printer class
  });

  await device.open();
  if (device.configuration === null) {
    await device.selectConfiguration(1);
  }

  // Find printer interface (class 7) and its OUT endpoint
  const config = device.configuration;
  if (!config) throw new Error("Configuração USB não encontrada");

  let interfaceNumber = -1;
  let endpointNumber = -1;
  for (const iface of config.interfaces) {
    for (const alt of iface.alternates) {
      if (alt.interfaceClass === 7) {
        const out = alt.endpoints.find(
          (e: { direction: string; endpointNumber: number }) =>
            e.direction === "out",
        );
        if (out) {
          interfaceNumber = iface.interfaceNumber;
          endpointNumber = out.endpointNumber;
          break;
        }
      }
    }
    if (interfaceNumber >= 0) break;
  }

  if (interfaceNumber < 0 || endpointNumber < 0) {
    try {
      await device.close();
    } catch {
      // ignore
    }
    throw new Error("Endpoint de impressora não encontrado neste dispositivo USB");
  }

  await device.claimInterface(interfaceNumber);

  const conn: PrinterConnection = {
    kind: "usb",
    label: device.productName || "Impressora USB",
    write: async (bytes) => {
      const chunkSize = 64;
      for (let i = 0; i < bytes.length; i += chunkSize) {
        const slice = bytes.slice(i, i + chunkSize);
        await device.transferOut(endpointNumber, slice);
      }
    },
    disconnect: async () => {
      try {
        await device.releaseInterface(interfaceNumber);
        await device.close();
      } catch {
        // ignore
      }
    },
  };
  activeConnection = conn;
  return conn;
}

export async function connectBluetooth(): Promise<PrinterConnection> {
  if (!hasBluetooth()) throw new Error("Web Bluetooth não suportado neste navegador");
  // @ts-expect-error - Web Bluetooth types not in TS lib
  const device = await navigator.bluetooth.requestDevice({
    filters: [{ services: [BT_SERVICE] }],
    optionalServices: [BT_SERVICE],
  });
  const server = await device.gatt!.connect();
  const service = await server.getPrimaryService(BT_SERVICE);
  const characteristic = await service.getCharacteristic(BT_CHARACTERISTIC);

  const conn: PrinterConnection = {
    kind: "bluetooth",
    label: device.name ?? "Impressora Bluetooth",
    write: async (bytes) => {
      // BLE typically limits writes to ~512 bytes; chunk to be safe
      const chunkSize = 180;
      for (let i = 0; i < bytes.length; i += chunkSize) {
        const slice = bytes.slice(i, i + chunkSize);
        await characteristic.writeValueWithoutResponse(slice);
      }
    },
    disconnect: async () => {
      try {
        device.gatt?.disconnect();
      } catch {
        // ignore
      }
    },
  };
  activeConnection = conn;
  return conn;
}

export async function connectSerial(): Promise<PrinterConnection> {
  if (!hasSerial()) throw new Error("Web Serial não suportado neste navegador");
  // @ts-expect-error - Web Serial types not in TS lib
  const port = await navigator.serial.requestPort();
  await port.open({ baudRate: 9600 });

  const writer = port.writable!.getWriter();

  const conn: PrinterConnection = {
    kind: "serial",
    label: "Impressora USB",
    write: async (bytes) => {
      await writer.write(bytes);
    },
    disconnect: async () => {
      try {
        await writer.close();
        await port.close();
      } catch {
        // ignore
      }
    },
  };
  activeConnection = conn;
  return conn;
}

// Prefer Electron silent printing; fallback opens browser print UI only outside Electron.
export async function browserPrintHTML(html: string) {
  const electronPrint = getElectronPrintBridge();
  if (electronPrint) {
    const result = await electronPrint.print(html);
    if (!wasElectronPrintSuccessful(result)) {
      const error = typeof result === "object" && result?.error ? result.error : "Falha na impressão silenciosa";
      throw new Error(error);
    }
    return;
  }

  const w = window.open("", "_blank", "width=380,height=600");
  if (!w) {
    throw new Error("Permita pop-ups para imprimir");
  }
  w.document.write(`${html}<script>window.print();setTimeout(()=>window.close(),400);</script>`);
  w.document.close();
}

// Strip accents for ESC/POS (most thermal printers don't support UTF-8 directly).
function normalize(text: string): string {
  return text.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

export function encodeText(text: string): Uint8Array {
  const ascii = normalize(text);
  const bytes = new Uint8Array(ascii.length);
  for (let i = 0; i < ascii.length; i++) {
    bytes[i] = ascii.charCodeAt(i) & 0xff;
  }
  return bytes;
}

export function concatBytes(parts: Uint8Array[]): Uint8Array {
  const total = parts.reduce((s, p) => s + p.length, 0);
  const out = new Uint8Array(total);
  let off = 0;
  for (const p of parts) {
    out.set(p, off);
    off += p.length;
  }
  return out;
}

// ESC/POS command helpers
export const ESC = {
  init: new Uint8Array([0x1b, 0x40]),
  alignLeft: new Uint8Array([0x1b, 0x61, 0x00]),
  alignCenter: new Uint8Array([0x1b, 0x61, 0x01]),
  alignRight: new Uint8Array([0x1b, 0x61, 0x02]),
  boldOn: new Uint8Array([0x1b, 0x45, 0x01]),
  boldOff: new Uint8Array([0x1b, 0x45, 0x00]),
  doubleOn: new Uint8Array([0x1d, 0x21, 0x11]),
  doubleOff: new Uint8Array([0x1d, 0x21, 0x00]),
  lf: new Uint8Array([0x0a]),
  feed: (n: number) => new Uint8Array([0x1b, 0x64, n]),
  cut: new Uint8Array([0x1d, 0x56, 0x00]),
};
