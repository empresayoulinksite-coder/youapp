import { createServerFn } from "@tanstack/react-start";
import forge from "node-forge";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

/**
 * Gera uma CA local + certificado final RSA 2048 válido por 10 anos
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

    // 1. Gera uma CA local (vai no override.crt) e um certificado final (vai para o navegador)
    const rootKeys = forge.pki.rsa.generateKeyPair({ bits: 2048, e: 0x10001 });
    const leafKeys = forge.pki.rsa.generateKeyPair({ bits: 2048, e: 0x10001 });
    const notBefore = new Date();
    notBefore.setDate(notBefore.getDate() - 1);
    const notAfter = new Date(notBefore);
    notAfter.setFullYear(notBefore.getFullYear() + 10);

    const rootAttrs = [
      { name: "commonName", value: "YouLink QZ Root CA" },
      { name: "organizationName", value: "YouLink" },
      { name: "organizationalUnitName", value: "Silent Printing Root" },
    ];
    const leafAttrs = [
      { name: "commonName", value: "YouLink QZ Tray Cert" },
      { name: "organizationName", value: "YouLink" },
      { name: "organizationalUnitName", value: "Silent Printing" },
    ];

    const rootCert = forge.pki.createCertificate();
    rootCert.publicKey = rootKeys.publicKey;
    rootCert.serialNumber = `${Date.now()}01`;
    rootCert.validity.notBefore = notBefore;
    rootCert.validity.notAfter = notAfter;
    rootCert.setSubject(rootAttrs);
    rootCert.setIssuer(rootAttrs);
    rootCert.setExtensions([
      { name: "basicConstraints", critical: true, cA: true },
      { name: "keyUsage", critical: true, keyCertSign: true, cRLSign: true, digitalSignature: true },
      { name: "subjectKeyIdentifier" },
    ]);
    rootCert.sign(rootKeys.privateKey, forge.md.sha256.create());

    const leafCert = forge.pki.createCertificate();
    leafCert.publicKey = leafKeys.publicKey;
    leafCert.serialNumber = `${Date.now()}02`;
    leafCert.validity.notBefore = notBefore;
    leafCert.validity.notAfter = notAfter;
    leafCert.setSubject(leafAttrs);
    leafCert.setIssuer(rootAttrs);
    leafCert.setExtensions([
      { name: "basicConstraints", critical: true, cA: false },
      { name: "keyUsage", critical: true, digitalSignature: true, nonRepudiation: true, keyEncipherment: true },
      { name: "extKeyUsage", clientAuth: true, codeSigning: true },
      { name: "subjectAltName", altNames: [{ type: 6, value: "https://youlinkapp.site" }] },
      { name: "subjectKeyIdentifier" },
    ]);
    leafCert.sign(rootKeys.privateKey, forge.md.sha256.create());

    // 2. Serializa em PEM: QZ recebe o certificado final; o Windows instala a CA no override.crt.
    const privateKeyPem = forge.pki.privateKeyToPem(leafKeys.privateKey);
    const publicCertPem = forge.pki.certificateToPem(leafCert);
    const overrideCrt = forge.pki.certificateToPem(rootCert);

    // 4. Persiste (upsert no singleton id=1)
    const { error } = await supabaseAdmin
      .from("qz_certificates")
      .upsert({
        id: 1,
        private_key: privateKeyPem,
        public_cert: publicCertPem,
        override_crt: overrideCrt,
        created_at: new Date().toISOString(),
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

/**
 * Status do certificado QZ — usado pela página de setup para mostrar
 * se já foi gerado e quando.
 */
export const getQzCertificateStatus = createServerFn({ method: "GET" }).handler(async () => {
  const { data } = await supabaseAdmin
    .from("qz_certificates")
    .select("id, created_at")
    .eq("id", 1)
    .maybeSingle();
  return {
    exists: !!data,
    createdAt: data?.created_at ?? null,
  };
});
