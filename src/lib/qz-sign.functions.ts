import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { createSign, createPrivateKey } from "crypto";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const InputSchema = z.object({
  request: z.string().min(1).max(100_000),
});

/**
 * Assina o payload do QZ Tray com a chave privada (SHA512withRSA).
 * A chave privada nunca sai do servidor.
 *
 * Não exige auth: o QZ Tray precisa chamar isto a cada print, inclusive
 * em telas públicas. A segurança vem do par chave/certificado — só quem
 * tem o `override.crt` instalado no QZ Tray imprime sem prompt.
 */
export const signQzRequest = createServerFn({ method: "POST" })
  .inputValidator((input) => InputSchema.parse(input))
  .handler(async ({ data }) => {
    const { data: row, error } = await supabaseAdmin
      .from("qz_certificates")
      .select("private_key")
      .eq("id", 1)
      .maybeSingle();

    if (error) throw new Error(error.message);
    if (!row?.private_key) {
      throw new Error("Certificado QZ ainda não foi gerado. Acesse /admin/qz-setup");
    }

    const key = createPrivateKey({ key: row.private_key, format: "pem" });
    const signer = createSign("RSA-SHA512");
    signer.update(data.request);
    signer.end();
    const signature = signer.sign(key).toString("base64");

    return { signature };
  });
