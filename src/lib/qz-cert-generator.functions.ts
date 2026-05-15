import { createServerFn } from "@tanstack/react-start";
import forge from "node-forge";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

/**
 * Gera par de chaves RSA 2048 + certificado X.509 auto-assinado válido por 10 anos
 * e salva no banco. Apenas admins podem chamar.
 *
 * Retorna o conteúdo do `override.crt` que o usuário deve copiar para a pasta do
 * QZ Tray em cada PC da loja (esse arquivo "ensina" o QZ Tray a confiar no
 * certificado, fazendo a impressão ficar 100% silenciosa).
 */
export const generateQzCertificate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    // Verifica se é admin
    const { userId } = context;
    const { data: roleRow } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .eq("role", "admin")
      .maybeSingle();

    if (!roleRow) {
      throw new Error("Apenas administradores podem gerar o certificado QZ");
    }

    // 1. Gera par RSA 2048
    const keys = forge.pki.rsa.generateKeyPair({ bits: 2048, e: 0x10001 });

    // 2. Monta certificado X.509 auto-assinado válido por 10 anos
    const cert = forge.pki.createCertificate();
    cert.publicKey = keys.publicKey;
    cert.serialNumber = String(Date.now());
    cert.validity.notBefore = new Date();
    cert.validity.notAfter = new Date();
    cert.validity.notAfter.setFullYear(cert.validity.notBefore.getFullYear() + 10);

    const attrs = [
      { name: "commonName", value: "QZ Tray Cert" },
      { name: "organizationName", value: "Lovable App" },
      { name: "organizationalUnitName", value: "Silent Printing" },
    ];
    cert.setSubject(attrs);
    cert.setIssuer(attrs);
    cert.setExtensions([
      { name: "basicConstraints", cA: true },
      {
        name: "keyUsage",
        keyCertSign: true,
        digitalSignature: true,
        nonRepudiation: true,
        keyEncipherment: true,
        dataEncipherment: true,
      },
      { name: "extKeyUsage", serverAuth: true, clientAuth: true, codeSigning: true, emailProtection: true },
      { name: "subjectKeyIdentifier" },
    ]);

    // Auto-assina com SHA-256
    cert.sign(keys.privateKey, forge.md.sha256.create());

    // 3. Serializa em PEM
    const privateKeyPem = forge.pki.privateKeyToPem(keys.privateKey);
    const publicCertPem = forge.pki.certificateToPem(cert);
    // override.crt do QZ Tray é o mesmo certificado público em formato PEM
    const overrideCrt = publicCertPem;

    // 4. Persiste (upsert no singleton id=1)
    const { error } = await supabaseAdmin
      .from("qz_certificates")
      .upsert({
        id: 1,
        private_key: privateKeyPem,
        public_cert: publicCertPem,
        override_crt: overrideCrt,
      });

    if (error) throw new Error(`Erro ao salvar certificado: ${error.message}`);

    return { overrideCrt, generated: true };
  });

/**
 * Retorna o certificado público para o navegador entregar ao QZ Tray.
 * Não exige autenticação porque o certificado é PÚBLICO por natureza.
 */
export const getQzPublicCertificate = createServerFn({ method: "GET" }).handler(async () => {
  const { data, error } = await supabaseAdmin
    .from("qz_certificates")
    .select("public_cert")
    .eq("id", 1)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return { publicCert: data?.public_cert ?? null };
});

/**
 * Retorna o override.crt para o admin baixar novamente sem regerar.
 */
export const getQzOverrideCrt = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { userId } = context;
    const { data: roleRow } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .eq("role", "admin")
      .maybeSingle();
    if (!roleRow) throw new Error("Apenas administradores");

    const { data } = await supabaseAdmin
      .from("qz_certificates")
      .select("override_crt")
      .eq("id", 1)
      .maybeSingle();

    return { overrideCrt: data?.override_crt ?? null };
  });
