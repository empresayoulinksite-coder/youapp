// QZ Tray integration - silent printing to any installed printer.
// Requires QZ Tray (https://qz.io/download/) running on the user's PC.
import { QZ_CERTIFICATE } from "./qz-certificate";
import { signQzRequest } from "./qz-sign.functions";

let qzModulePromise: Promise<any> | null = null;

async function getQz(): Promise<any> {
  if (typeof window === "undefined") {
    throw new Error("QZ Tray só funciona no navegador");
  }
  if (!qzModulePromise) {
    qzModulePromise = import("qz-tray").then((m) => m.default ?? m);
  }
  const qz = await qzModulePromise;

  // Configure signed mode — backend assina cada requisição com SHA512withRSA.
  // Com o certificado importado como override.crt no QZ Tray do PC, NUNCA aparece prompt.
  if (!qz.security.__configured) {
    qz.security.setCertificatePromise((resolve: (v: string) => void) => {
      resolve(QZ_CERTIFICATE);
    });
    qz.security.setSignatureAlgorithm?.("SHA512");
    qz.security.setSignaturePromise((toSign: string) => {
      return (resolve: (v: string) => void, reject: (e: unknown) => void) => {
        signQzRequest({ data: { request: toSign } })
          .then((res) => resolve(res.signature))
          .catch(reject);
      };
    });
    qz.security.__configured = true;
  }
  return qz;
}

export async function qzIsConnected(): Promise<boolean> {
  try {
    const qz = await getQz();
    return !!qz.websocket.isActive();
  } catch {
    return false;
  }
}

export async function qzConnect(): Promise<void> {
  const qz = await getQz();
  if (qz.websocket.isActive()) return;
  await qz.websocket.connect({ retries: 2, delay: 1 });
}

export async function qzDisconnect(): Promise<void> {
  const qz = await getQz();
  if (qz.websocket.isActive()) {
    await qz.websocket.disconnect();
  }
}

export async function qzListPrinters(): Promise<string[]> {
  const qz = await getQz();
  if (!qz.websocket.isActive()) await qzConnect();
  const list = await qz.printers.find();
  return Array.isArray(list) ? list : [list];
}

export async function qzGetDefaultPrinter(): Promise<string | null> {
  const qz = await getQz();
  if (!qz.websocket.isActive()) await qzConnect();
  try {
    return (await qz.printers.getDefault()) ?? null;
  } catch {
    return null;
  }
}

export async function qzPrintHTML(printerName: string, html: string): Promise<void> {
  const qz = await getQz();
  if (!qz.websocket.isActive()) await qzConnect();
  const config = qz.configs.create(printerName, {
    margins: { top: 0.1, right: 0.1, bottom: 0.1, left: 0.1 },
    scaleContent: true,
  });
  const data = [
    {
      type: "pixel",
      format: "html",
      flavor: "plain",
      data: html,
    },
  ];
  await qz.print(config, data);
}

export async function qzPrintRaw(printerName: string, bytes: Uint8Array): Promise<void> {
  const qz = await getQz();
  if (!qz.websocket.isActive()) await qzConnect();
  const config = qz.configs.create(printerName);
  // Convert to base64 for raw transport
  let binary = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  const b64 = btoa(binary);
  const data = [
    {
      type: "raw",
      format: "base64",
      data: b64,
    },
  ];
  await qz.print(config, data);
}
