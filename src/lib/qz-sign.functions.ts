import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { createSign, createPrivateKey } from "crypto";

const InputSchema = z.object({
  request: z.string().min(1).max(100_000),
});

/**
 * Assina o payload do QZ Tray com a chave privada (SHA512withRSA).
 * A chave privada nunca sai do servidor.
 */
export const signQzRequest = createServerFn({ method: "POST" })
  .inputValidator((input) => InputSchema.parse(input))
  .handler(async ({ data }) => {
    const pem = process.env.QZ_PRIVATE_KEY;
    if (!pem) {
      throw new Error("QZ_PRIVATE_KEY não configurada no servidor");
    }

    const key = createPrivateKey({ key: pem, format: "pem" });
    const signer = createSign("RSA-SHA512");
    signer.update(data.request);
    signer.end();
    const signature = signer.sign(key).toString("base64");

    return { signature };
  });
