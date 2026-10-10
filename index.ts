// Envoie une notification push via Firebase Cloud Messaging (API HTTP v1).
// POST { cible: "etudiant"|"admin"|"tous", etudiant_id?, admin_id?, titre, corps, page? }
// Header requis : x-push-secret: <PUSH_SECRET>
import { createClient } from "npm:@supabase/supabase-js@2";

const sa = JSON.parse(Deno.env.get("FCM_SERVICE_ACCOUNT")!);
const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

const b64u = (b: ArrayBuffer | string) =>
  btoa(typeof b === "string" ? b : String.fromCharCode(...new Uint8Array(b)))
    .replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");

async function accessToken(): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const head = b64u(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claim = b64u(JSON.stringify({
    iss: sa.client_email, scope: "https://www.googleapis.com/auth/firebase.messaging",
    aud: "https://oauth2.googleapis.com/token", iat: now, exp: now + 3600,
  }));
  const pem = sa.private_key.replace(/-----[^-]+-----/g, "").replace(/\s/g, "");
  const key = await crypto.subtle.importKey(
    "pkcs8", Uint8Array.from(atob(pem), (c) => c.charCodeAt(0)),
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, new TextEncoder().encode(`${head}.${claim}`));
  const r = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion: `${head}.${claim}.${b64u(sig)}`,
    }),
  });
  return (await r.json()).access_token;
}

Deno.serve(async (req) => {
  if (req.headers.get("x-push-secret") !== Deno.env.get("PUSH_SECRET"))
    return new Response("non autorisé", { status: 401 });
  const { cible = "tous", etudiant_id, admin_id, titre, corps, page } = await req.json();

  let q = db.from("appareils").select("jeton");
  if (cible === "etudiant") q = q.eq("role", "etudiant");
  if (cible === "admin") q = q.eq("role", "admin");
  if (etudiant_id) q = q.eq("etudiant_id", String(etudiant_id));
  if (admin_id) q = q.eq("admin_id", String(admin_id));
  const { data: appareils } = await q;

  const token = await accessToken();
  let envoyes = 0;
  for (const { jeton } of appareils ?? []) {
    const r = await fetch(`https://fcm.googleapis.com/v1/projects/${sa.project_id}/messages:send`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ message: {
        token: jeton, notification: { title: titre, body: corps },
        data: page ? { page } : {}, android: { priority: "HIGH" },
      } }),
    });
    if (r.ok) envoyes++;
    else if (r.status === 404 || r.status === 400) await db.from("appareils").delete().eq("jeton", jeton); // jeton périmé
  }
  return Response.json({ envoyes, total: appareils?.length ?? 0 });
});
