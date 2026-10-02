import crypto from "crypto";
import type { Express } from "express";
import type pg from "pg";

// Paiements Mobile Money (Orange / Wave / MTN / Moov) via Jèko — même API et mêmes variables
// d'environnement que DiagAssist, adaptés à SkinDiag : commandes de produits (total livraison
// incluse) ET forfaits d'analyse. Le webhook signé est la confirmation de référence ; le sondage
// côté client interroge Jèko directement en filet de sécurité (webhook perdu ou mal routé).

const JEKO_API_BASE = process.env.JEKO_API_BASE || "https://api.jeko.africa";
const ALLOWED_METHODS = new Set(["orange", "wave", "mtn", "moov"]);

interface JekoDeps {
  pool: pg.Pool | null;
  requireAuth: any;
  requireAdminAuth: any;
  planPrices: Record<string, number>;      // FCFA, source de vérité côté serveur
  setUserPlan: (phone: string, plan: string) => void;
  clearPendingActivation: (phone: string) => void;
}

export function registerJekoPayments(app: Express, deps: JekoDeps) {
  const { pool } = deps;
  const apiKey = process.env.JEKO_API_KEY;
  const apiKeyId = process.env.JEKO_API_KEY_ID;
  const storeId = process.env.JEKO_STORE_ID;
  // Un secret par webhook (global "business" ou par magasin) : n'importe lequel valide la signature.
  const webhookSecrets = (process.env.JEKO_WEBHOOK_SECRETS || process.env.JEKO_WEBHOOK_SECRET || "")
    .split(",").map((s) => s.trim()).filter(Boolean);

  const isConfigured = () => Boolean(pool && apiKey && apiKeyId && storeId && webhookSecrets.length > 0);
  if (!isConfigured()) {
    console.warn("[JEKO] JEKO_API_KEY / JEKO_API_KEY_ID / JEKO_STORE_ID / JEKO_WEBHOOK_SECRETS manquantes — paiement en ligne désactivé (repli : Wave manuel).");
  }

  // Applique le résultat d'un paiement CONFIRMÉ. Le « claim » atomique (UPDATE ... WHERE status =
  // 'processing' RETURNING) garantit qu'un webhook rejoué (Jèko le renvoie jusqu'à 3 fois) ou une
  // réconciliation simultanée n'active jamais deux fois le même paiement.
  const markPaid = async (reference: string): Promise<boolean> => {
    if (!pool) return false;
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const claim = await client.query(
        `UPDATE payments SET status = 'paid', validated_at = $1
         WHERE provider = 'jeko' AND provider_reference = $2 AND status = 'processing'
         RETURNING kind, ref_id, phone, plan`,
        [Date.now(), reference]
      );
      if (!claim.rows.length) {
        await client.query("ROLLBACK");
        return false; // déjà traité
      }
      const p = claim.rows[0];
      if (p.kind === "order") {
        await client.query("UPDATE orders SET payment_status = 'paid', paid_at = $1 WHERE id = $2", [Date.now(), p.ref_id]);
      }
      await client.query("COMMIT");
      if (p.kind === "subscription" && p.plan) {
        deps.setUserPlan(p.phone, p.plan);
        deps.clearPendingActivation(p.phone);
      }
      console.log(`[JEKO] Paiement confirmé (${p.kind}${p.plan ? ` ${p.plan}` : ` #${p.ref_id}`}) pour ${p.phone} — réf. ${reference}.`);
      return true;
    } catch (err: any) {
      await client.query("ROLLBACK").catch(() => {});
      console.error("[JEKO][DB] Confirmation échouée:", err.message);
      return false;
    } finally {
      client.release();
    }
  };

  const markFailed = async (reference: string): Promise<void> => {
    if (!pool) return;
    try {
      const upd = await pool.query(
        `UPDATE payments SET status = 'failed' WHERE provider = 'jeko' AND provider_reference = $1 AND status = 'processing'
         RETURNING kind, ref_id`,
        [reference]
      );
      const p = upd.rows[0];
      // Commande de nouveau payable : le client peut réessayer avec un autre moyen.
      if (p?.kind === "order") {
        await pool.query("UPDATE orders SET payment_status = 'awaiting_payment' WHERE id = $1 AND payment_status = 'processing'", [p.ref_id]);
      }
    } catch (err: any) {
      console.error("[JEKO][DB] Échec enregistrement:", err.message);
    }
  };

  // Interroge directement Jèko pour l'état réel d'une transaction encore en cours.
  const reconcile = async (reference: string): Promise<string> => {
    if (!pool || !isConfigured()) return "unknown";
    const { rows } = await pool.query(
      "SELECT status, external_id FROM payments WHERE provider = 'jeko' AND provider_reference = $1",
      [reference]
    );
    const row = rows[0];
    if (!row) return "unknown";
    if (row.status !== "processing" || !row.external_id) return row.status;
    try {
      const response = await fetch(`${JEKO_API_BASE}/partner_api/payment_requests/${row.external_id}`, {
        headers: { "X-API-KEY": apiKey!, "X-API-KEY-ID": apiKeyId! },
      });
      if (!response.ok) return row.status;
      const data: any = await response.json().catch(() => ({}));
      const status = String(data?.status || data?.transaction?.status || "").toLowerCase();
      if (status === "success" || status === "completed") {
        await markPaid(reference);
        return "paid";
      }
      if (status === "error" || status === "failed") {
        await markFailed(reference);
        return "failed";
      }
    } catch (err: any) {
      console.error("[JEKO] Réconciliation impossible:", err.message);
    }
    return row.status;
  };

  // Le client sait ainsi s'il doit proposer Jèko ou le paiement Wave manuel.
  app.get("/api/payments/jeko/config", (_req, res) => {
    res.json({ success: true, enabled: isConfigured() });
  });

  // Crée la demande de paiement. Le MONTANT vient toujours du serveur (total de la commande en base,
  // ou prix officiel du forfait) — jamais du client.
  app.post("/api/payments/jeko/create", deps.requireAuth, async (req: any, res) => {
    if (!isConfigured()) {
      return res.status(503).json({ success: false, message: "Le paiement en ligne est momentanément indisponible." });
    }
    const kind = String(req.body?.kind || "");
    const paymentMethod = String(req.body?.paymentMethod || "");
    const rawPhone = req.body?.payerPhone ? String(req.body.payerPhone).replace(/\D/g, "") : "";
    if (!ALLOWED_METHODS.has(paymentMethod)) {
      return res.status(400).json({ success: false, message: "Moyen de paiement invalide." });
    }
    if (kind !== "order" && kind !== "subscription") {
      return res.status(400).json({ success: false, message: "Type de paiement invalide." });
    }

    const phone: string = req.session.phone;
    let amountXof = 0;
    let orderId: number | null = null;
    let plan: string | null = null;

    try {
      if (kind === "order") {
        orderId = Math.floor(Number(req.body?.orderId));
        const order = await pool!.query(
          "SELECT total_amount, payment_status FROM orders WHERE id = $1 AND phone = $2",
          [orderId, phone]
        );
        if (!order.rows.length) return res.status(404).json({ success: false, message: "Commande introuvable." });
        const o = order.rows[0];
        if (o.payment_status === "paid") return res.status(409).json({ success: false, message: "Cette commande est déjà payée." });
        if (!o.total_amount) return res.status(400).json({ success: false, message: "Commande non payable en ligne." });
        amountXof = Number(o.total_amount);
      } else {
        plan = String(req.body?.plan || "");
        if (!(plan in deps.planPrices)) return res.status(400).json({ success: false, message: "Forfait inconnu." });
        amountXof = deps.planPrices[plan];
      }

      const reference = `skdg-${phone.replace(/\D/g, "")}-${kind === "order" ? `o${orderId}` : plan}-${Date.now()}`;
      const origin = process.env.APP_URL || `https://${req.headers.host}`;
      const paymentData: Record<string, any> = {
        paymentMethod,
        successUrl: `${origin}/?payment=success&reference=${encodeURIComponent(reference)}`,
        errorUrl: `${origin}/?payment=error&reference=${encodeURIComponent(reference)}`,
      };
      if (rawPhone) {
        paymentData.forceProviderDirect = true;
        paymentData.payerPhone = `+${rawPhone.startsWith("225") ? rawPhone : `225${rawPhone}`}`;
      }

      const amountCents = amountXof * 100; // convention Jèko : XOF x 100
      const response = await fetch(`${JEKO_API_BASE}/partner_api/payment_requests`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-API-KEY": apiKey!, "X-API-KEY-ID": apiKeyId! },
        body: JSON.stringify({
          storeId, amountCents, currency: "XOF", reference,
          paymentDetails: { type: "redirect", data: paymentData },
        }),
      });
      const data: any = await response.json().catch(() => ({}));
      if (!response.ok) {
        console.error("[JEKO] Création refusée:", response.status, data);
        return res.status(502).json({ success: false, message: data?.message || "Le paiement n'a pas pu être initié." });
      }

      const now = Date.now();
      if (kind === "order") {
        // Réutilise la ligne de paiement de la commande (une seule par commande) : une nouvelle
        // tentative remplace simplement la référence Jèko précédente.
        const upd = await pool!.query(
          `UPDATE payments SET provider = 'jeko', provider_reference = $1, external_id = $2, status = 'processing', amount = $3
           WHERE kind = 'order' AND ref_id = $4 AND status <> 'paid'`,
          [reference, data?.id || null, amountXof, orderId]
        );
        if (!upd.rowCount) {
          await pool!.query(
            `INSERT INTO payments (phone, kind, ref_id, provider, provider_reference, external_id, amount, status, created_at)
             VALUES ($1,'order',$2,'jeko',$3,$4,$5,'processing',$6)`,
            [phone, orderId, reference, data?.id || null, amountXof, now]
          );
        }
        await pool!.query("UPDATE orders SET payment_status = 'processing' WHERE id = $1", [orderId]);
      } else {
        await pool!.query(
          `INSERT INTO payments (phone, kind, plan, provider, provider_reference, external_id, amount, status, created_at)
           VALUES ($1,'subscription',$2,'jeko',$3,$4,$5,'processing',$6)`,
          [phone, plan, reference, data?.id || null, amountXof, now]
        );
      }

      res.json({ success: true, reference, redirectUrl: data.redirectUrl, amount: amountXof });
    } catch (err: any) {
      console.error("[JEKO] Erreur lors de la création du paiement:", err.message);
      res.status(502).json({ success: false, message: "Impossible de contacter le service de paiement." });
    }
  });

  // Statut vu par le client pendant qu'il paie chez son opérateur (avec rattrapage auprès de Jèko).
  app.get("/api/payments/jeko/status/:reference", deps.requireAuth, async (req: any, res) => {
    if (!pool) return res.status(503).json({ success: false });
    const reference = String(req.params.reference || "");
    const { rows } = await pool.query(
      "SELECT phone FROM payments WHERE provider = 'jeko' AND provider_reference = $1",
      [reference]
    );
    if (!rows.length || rows[0].phone !== req.session.phone) {
      return res.status(404).json({ success: false, message: "Paiement introuvable." });
    }
    const status = await reconcile(reference);
    res.json({ success: true, status: status === "paid" ? "success" : status === "failed" ? "error" : "pending" });
  });

  app.post("/api/admin/jeko/payments/:reference/reconcile", deps.requireAdminAuth, async (req, res) => {
    const status = await reconcile(String(req.params.reference || ""));
    res.json({ success: true, status });
  });

  // Webhook Jèko : la signature HMAC porte sur les octets EXACTS reçus (req.rawBody).
  app.post("/api/payments/jeko/webhook", async (req: any, res) => {
    if (!isConfigured()) return res.status(503).end();
    const signature = String(req.headers["jeko-signature"] || "").toLowerCase();
    const rawBody: Buffer | undefined = req.rawBody;
    if (!rawBody || !signature) return res.status(400).end();

    const valid = webhookSecrets.some((secret) => {
      const computed = crypto.createHmac("sha256", secret).update(rawBody).digest("hex");
      return computed.length === signature.length && crypto.timingSafeEqual(Buffer.from(computed), Buffer.from(signature));
    });
    if (!valid) {
      console.warn("[JEKO][Webhook] Signature invalide.");
      return res.status(401).end();
    }

    const body = req.body || {};
    const reference = String(body?.transactionDetails?.reference || body?.reference || "");
    const status = String(body.status || "").toLowerCase();
    if (!reference) return res.status(200).end();
    // Les références SkinDiag commencent par « skdg- » : tout le reste (ex. DiagAssist, si le même
    // magasin Jèko est partagé) est ignoré sans erreur.
    if (!reference.startsWith("skdg-")) return res.status(200).end();

    try {
      const { rows } = await pool!.query(
        "SELECT amount, status, external_id FROM payments WHERE provider = 'jeko' AND provider_reference = $1",
        [reference]
      );
      const record = rows[0];
      if (!record) {
        console.warn(`[JEKO][Webhook] Référence inconnue : ${reference}`);
        return res.status(200).end();
      }
      if (record.status !== "processing") return res.status(200).end(); // déjà traité

      if (body.transactionType && String(body.transactionType) !== "PaymentRequest") return res.status(200).end();
      if (record.external_id && body?.transactionDetails?.id && String(body.transactionDetails.id) !== String(record.external_id)) {
        console.warn(`[JEKO][Webhook] ID Jèko différent pour ${reference}.`);
        return res.status(200).end();
      }
      // Même avec une signature valide, le montant doit correspondre à ce que NOUS avons demandé.
      const webhookAmount = Number(body?.amount?.amount);
      if (Number.isFinite(webhookAmount) && webhookAmount !== Number(record.amount) * 100) {
        console.warn(`[JEKO][Webhook] Montant différent pour ${reference} : reçu=${webhookAmount}, attendu=${Number(record.amount) * 100}.`);
        return res.status(200).end();
      }

      if (status === "success" || status === "completed") await markPaid(reference);
      else await markFailed(reference);
    } catch (err: any) {
      console.error("[JEKO][Webhook] Erreur:", err.message);
      return res.status(500).end(); // Jèko réessaiera
    }
    res.status(200).end();
  });
}
