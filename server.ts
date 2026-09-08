import express from "express";
import cors from "cors";
import pg from "pg";
import path from "path";
import crypto from "crypto";
import { GoogleGenAI, Type } from "@google/genai";
import rateLimit from "express-rate-limit";

const app = express();
const PORT = Number(process.env.PORT) || 3000;

app.set("trust proxy", 1);

const pool = process.env.DATABASE_URL
  ? new pg.Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false }, max: 5 })
  : null;

// --- Authentification : comptes créés par l'admin, connexion numéro + mot de passe ---
// (même schéma que DiagAssist : sessions et comptes en mémoire, rechargés depuis PostgreSQL
// au démarrage pour survivre aux redémarrages du serveur)
const userAccounts = new Map<string, { passwordHash: string; salt: string; createdAt: number; isAdmin: boolean }>();
const sessions = new Map<string, { phone: string; createdAt: number }>();

function hashPassword(password: string, salt: string): string {
  return crypto.pbkdf2Sync(password, salt, 100000, 64, "sha512").toString("hex");
}

function createAccount(phone: string, password: string, isAdmin = false): void {
  const salt = crypto.randomBytes(16).toString("hex");
  const passwordHash = hashPassword(password, salt);
  const existing = userAccounts.get(phone);
  userAccounts.set(phone, { passwordHash, salt, createdAt: existing?.createdAt ?? Date.now(), isAdmin });
  persistAccount(phone).catch(() => {});
}

function verifyAccountPassword(phone: string, password: string): boolean {
  const acc = userAccounts.get(phone);
  if (!acc) return false;
  return hashPassword(password, acc.salt) === acc.passwordHash;
}

function createSession(phone: string): string {
  const token = crypto.randomBytes(32).toString("hex");
  sessions.set(token, { phone, createdAt: Date.now() });
  persistSession(token).catch(() => {});
  return token;
}

async function persistAccount(phone: string): Promise<void> {
  if (!pool) return;
  const acc = userAccounts.get(phone);
  if (!acc) return;
  try {
    await pool.query(
      `INSERT INTO accounts (phone, password_hash, salt, created_at, is_admin) VALUES ($1,$2,$3,$4,$5)
       ON CONFLICT (phone) DO UPDATE SET password_hash=$2, salt=$3, is_admin=$5`,
      [phone, acc.passwordHash, acc.salt, acc.createdAt, acc.isAdmin]
    );
  } catch (err: any) {
    console.error("[DB] Échec sauvegarde compte:", err.message);
  }
}

async function persistSession(token: string): Promise<void> {
  if (!pool) return;
  const s = sessions.get(token);
  if (!s) return;
  try {
    await pool.query(
      `INSERT INTO sessions (token, phone, created_at) VALUES ($1,$2,$3) ON CONFLICT (token) DO NOTHING`,
      [token, s.phone, s.createdAt]
    );
  } catch (err: any) {
    console.error("[DB] Échec sauvegarde session:", err.message);
  }
}

function requireAuth(req: any, res: any, next: any) {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!token || !sessions.has(token)) {
    return res.status(401).json({ success: false, message: "Session invalide ou expirée. Veuillez vous reconnecter." });
  }
  req.session = sessions.get(token);
  next();
}

function requireAdminAuth(req: any, res: any, next: any) {
  const code = req.headers["x-admin-code"];
  if (code && code === process.env.ADMIN_SECRET) return next();
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  const session = token ? sessions.get(token) : null;
  if (session && userAccounts.get(session.phone)?.isAdmin) return next();
  return res.status(401).json({ success: false, message: "Accès admin refusé." });
}

// --- Forfaits : Essai gratuit, Pass Jour (300F/24h), Mensuel (5000F), Premium (12000F/mois) ---
// Correspond exactement au cahier des charges validé pour SkinDiag.
const PLAN_DURATIONS_MS: Record<string, number> = {
  free_trial: 3 * 24 * 60 * 60 * 1000,  // 3 jours d'essai
  payg_day: 24 * 60 * 60 * 1000,        // Pass Jour 300F
  monthly: 30 * 24 * 60 * 60 * 1000,    // Mensuel 5000F
  premium: 30 * 24 * 60 * 60 * 1000,    // Premium 12000F/mois
};
const PLAN_LIMITS: Record<string, number> = {
  free_trial: 3,
  free_expired: 0,
  payg_day: Infinity,
  monthly: 30,
  premium: Infinity,
};
// phone -> { plan, activatedAt }
const userPlans = new Map<string, { plan: string; activatedAt: number }>();
// phone -> { count, periodStart }
const usageTracking = new Map<string, { count: number; periodStart: number }>();
// Demandes d'activation en attente de validation manuelle (paiement Wave)
const pendingActivations = new Map<string, { phone: string; plan: string; amount: number; requestedAt: number }>();

function getEffectivePlan(phone: string): string {
  const record = userPlans.get(phone);
  if (!record) return "free_trial";
  const duration = PLAN_DURATIONS_MS[record.plan];
  if (duration && Date.now() - record.activatedAt > duration) {
    return record.plan === "free_trial" ? "free_expired" : record.plan; // forfaits payants : accès conservé, à renouveler manuellement
  }
  return record.plan;
}

async function persistPlan(phone: string): Promise<void> {
  if (!pool) return;
  const p = userPlans.get(phone);
  if (!p) return;
  try {
    await pool.query(
      `INSERT INTO plans (phone, plan, activated_at) VALUES ($1,$2,$3)
       ON CONFLICT (phone) DO UPDATE SET plan=$2, activated_at=$3`,
      [phone, p.plan, p.activatedAt]
    );
  } catch (err: any) {
    console.error("[DB] Échec sauvegarde forfait:", err.message);
  }
}

function setUserPlan(phone: string, plan: string): void {
  userPlans.set(phone, { plan, activatedAt: Date.now() });
  persistPlan(phone).catch(() => {});
}

let aiClient: GoogleGenAI | null = null;
function getAIClient(): GoogleGenAI {
  if (!aiClient) {
    if (!process.env.GEMINI_API_KEY) throw new Error("GEMINI_API_KEY manquante.");
    aiClient = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  }
  return aiClient;
}

async function initDatabase(): Promise<void> {
  if (!pool) {
    console.warn("[DB] DATABASE_URL non configuré — les produits ne seront pas chargés depuis la base.");
    return;
  }
  await pool.query(`
    CREATE TABLE IF NOT EXISTS beauty_products (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      brand TEXT NOT NULL,
      category TEXT NOT NULL,
      price_fcfa INTEGER NOT NULL,
      suitable_for TEXT[] NOT NULL DEFAULT '{}',
      availability_abidjan BOOLEAN NOT NULL DEFAULT true
    );
    CREATE TABLE IF NOT EXISTS accounts (
      phone TEXT PRIMARY KEY,
      password_hash TEXT NOT NULL,
      salt TEXT NOT NULL,
      created_at BIGINT NOT NULL,
      is_admin BOOLEAN NOT NULL DEFAULT false
    );
    CREATE TABLE IF NOT EXISTS sessions (
      token TEXT PRIMARY KEY,
      phone TEXT NOT NULL,
      created_at BIGINT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS plans (
      phone TEXT PRIMARY KEY,
      plan TEXT NOT NULL,
      activated_at BIGINT NOT NULL
    );
  `);

  const accountsRes = await pool.query("SELECT * FROM accounts");
  for (const row of accountsRes.rows) {
    userAccounts.set(row.phone, {
      passwordHash: row.password_hash,
      salt: row.salt,
      createdAt: Number(row.created_at),
      isAdmin: row.is_admin,
    });
  }
  const SESSION_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;
  const sessionsRes = await pool.query("SELECT * FROM sessions");
  let loadedSessions = 0;
  for (const row of sessionsRes.rows) {
    if (Date.now() - Number(row.created_at) <= SESSION_MAX_AGE_MS) {
      sessions.set(row.token, { phone: row.phone, createdAt: Number(row.created_at) });
      loadedSessions++;
    }
  }
  console.log(`[DB] ${accountsRes.rows.length} compte(s), ${loadedSessions} session(s) rechargé(s).`);

  const plansRes = await pool.query("SELECT * FROM plans");
  for (const row of plansRes.rows) {
    userPlans.set(row.phone, { plan: row.plan, activatedAt: Number(row.activated_at) });
  }

  // Compte admin "graine" créé une seule fois depuis les variables d'environnement
  if (process.env.ADMIN_SEED_PHONE && process.env.ADMIN_SEED_PASSWORD && !userAccounts.has(process.env.ADMIN_SEED_PHONE)) {
    createAccount(process.env.ADMIN_SEED_PHONE, process.env.ADMIN_SEED_PASSWORD, true);
    setUserPlan(process.env.ADMIN_SEED_PHONE, "premium");
    console.log(`[Démarrage] Compte admin créé pour ${process.env.ADMIN_SEED_PHONE}.`);
  }

  const { rows } = await pool.query("SELECT COUNT(*) FROM beauty_products");
  if (Number(rows[0].count) === 0) {
    await pool.query(`
      INSERT INTO beauty_products (name, brand, category, price_fcfa, suitable_for, availability_abidjan) VALUES
      ('Cetaphil Gentle Skin Cleanser', 'Cetaphil', 'cleanser', 8500, ARRAY['oily','dry','combination','sensitive'], true),
      ('CeraVe Hydrating Cleanser', 'CeraVe', 'cleanser', 10000, ARRAY['dry','sensitive'], true),
      ('La Roche-Posay Toleriane Hydrating Cleansing Milk', 'La Roche-Posay', 'cleanser', 12000, ARRAY['dry','sensitive'], true),
      ('CeraVe Facial Moisturizing Lotion', 'CeraVe', 'moisturizer', 12000, ARRAY['dry','sensitive','combination'], true),
      ('Cetaphil Rich Hydrating Night Cream', 'Cetaphil', 'moisturizer', 13500, ARRAY['dry','sensitive'], true),
      ('La Roche-Posay Toleriane Fluid', 'La Roche-Posay', 'moisturizer', 11000, ARRAY['oily','combination'], true),
      ('BeautyCI Shea Butter Moisturizer', 'BeautyCI', 'moisturizer', 5000, ARRAY['all'], true),
      ('Vitamin C Serum 20% with Hyaluronic Acid', 'Generic', 'serum', 6000, ARRAY['all'], true),
      ('Hyaluronic Acid Serum 99%', 'Generic', 'serum', 4000, ARRAY['all'], true),
      ('Neutrogena Ultra Sheer Dry-Touch SPF 30', 'Neutrogena', 'sunscreen', 11000, ARRAY['all'], true)
      ON CONFLICT DO NOTHING;
    `);
    console.log("[DB] 10 produits d'amorçage insérés.");
  }
  console.log("[DB] Table beauty_products vérifiée.");
}

app.use(cors());
app.use(express.json({ limit: "15mb" }));

const analyzeLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 30 });

app.get("/api/health", (req, res) => {
  res.json({ status: "ok", app: "skindiag" });
});

// --- Authentification ---
const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 20 });
const loginAttempts = new Map<string, { count: number; firstAttempt: number }>();

app.post("/api/auth/login", authLimiter, (req, res) => {
  const { phoneNumber, countryCode, password } = req.body;
  if (!phoneNumber || !password) {
    return res.status(400).json({ success: false, message: "Numéro et mot de passe requis." });
  }
  const fullPhone = `${countryCode || "+225"}${String(phoneNumber).replace(/\s+/g, "")}`;

  const attempts = loginAttempts.get(fullPhone);
  if (attempts && attempts.count >= 8 && Date.now() - attempts.firstAttempt < 15 * 60 * 1000) {
    return res.status(429).json({ success: false, message: "Trop de tentatives. Réessayez dans 15 minutes." });
  }

  if (!verifyAccountPassword(fullPhone, password)) {
    const a = loginAttempts.get(fullPhone) || { count: 0, firstAttempt: Date.now() };
    a.count++;
    loginAttempts.set(fullPhone, a);
    return res.status(401).json({ success: false, message: "Numéro ou mot de passe incorrect." });
  }
  loginAttempts.delete(fullPhone);

  // Session unique : une nouvelle connexion déconnecte les précédentes (sauf comptes admin)
  const isAdminAccount = userAccounts.get(fullPhone)?.isAdmin === true;
  if (!isAdminAccount) {
    for (const [oldToken, s] of sessions) {
      if (s.phone === fullPhone) sessions.delete(oldToken);
    }
  }

  const token = createSession(fullPhone);
  res.json({ success: true, sessionToken: token, isAdmin: isAdminAccount });
});

app.get("/api/admin/accounts", requireAdminAuth, (req, res) => {
  const accounts = Array.from(userAccounts.entries()).map(([phone, acc]) => ({
    phone, createdAt: acc.createdAt, isAdmin: acc.isAdmin, plan: getEffectivePlan(phone),
  }));
  res.json({ success: true, accounts });
});

app.post("/api/admin/create-account", requireAdminAuth, (req, res) => {
  const { phone, password, isAdmin, plan } = req.body;
  if (!phone || !password) {
    return res.status(400).json({ success: false, message: "Numéro et mot de passe requis." });
  }
  createAccount(phone, password, isAdmin === true);
  if (plan) setUserPlan(phone, plan);
  res.json({ success: true });
});

app.post("/api/admin/set-plan", requireAdminAuth, (req, res) => {
  const { phone, plan } = req.body;
  if (!phone || !plan) return res.status(400).json({ success: false, message: "Numéro et forfait requis." });
  setUserPlan(phone, plan);
  res.json({ success: true });
});

app.get("/api/admin/pending-activations", requireAdminAuth, (req, res) => {
  res.json({ success: true, pending: Array.from(pendingActivations.values()) });
});

app.post("/api/admin/activate-plan/:phone", requireAdminAuth, (req, res) => {
  const { phone } = req.params;
  const pending = pendingActivations.get(phone);
  if (!pending) return res.status(404).json({ success: false, message: "Aucune demande en attente pour ce numéro." });
  setUserPlan(phone, pending.plan);
  pendingActivations.delete(phone);
  res.json({ success: true });
});

app.get("/api/user/status", requireAuth, (req: any, res) => {
  const acc = userAccounts.get(req.session.phone);
  const plan = getEffectivePlan(req.session.phone);
  const usage = usageTracking.get(req.session.phone);
  res.json({
    success: true,
    phone: req.session.phone,
    isAdmin: acc?.isAdmin === true,
    plan,
    // Infinity ne se sérialise pas en JSON (devient null) — on envoie -1 pour "illimité"
    limit: PLAN_LIMITS[plan] === Infinity ? -1 : (PLAN_LIMITS[plan] ?? 0),
    used: usage?.count ?? 0,
  });
});

app.post("/api/user/request-activation", requireAuth, (req: any, res) => {
  const { plan, amount } = req.body;
  if (!plan || !amount) return res.status(400).json({ success: false, message: "Forfait et montant requis." });
  pendingActivations.set(req.session.phone, { phone: req.session.phone, plan, amount, requestedAt: Date.now() });
  res.json({ success: true });
});

app.post("/api/skindiag/analyze", analyzeLimiter, requireAuth, async (req: any, res) => {
  try {
    const { zone, image, mimeType } = req.body;
    if (!image || !mimeType) {
      return res.status(400).json({ success: false, message: "Photo requise pour l'analyse." });
    }

    // Vérification du quota selon le forfait actif
    const phone = req.session.phone;
    const plan = getEffectivePlan(phone);
    const limit = PLAN_LIMITS[plan] ?? 0;
    const usage = usageTracking.get(phone) || { count: 0, periodStart: Date.now() };
    // Réinitialise le compteur mensuel pour les forfaits limités par mois (30 jours glissants)
    if (plan === "monthly" && Date.now() - usage.periodStart > 30 * 24 * 60 * 60 * 1000) {
      usage.count = 0;
      usage.periodStart = Date.now();
    }
    if (usage.count >= limit) {
      return res.status(403).json({
        success: false,
        message: plan === "free_expired"
          ? "Votre essai gratuit est terminé. Choisissez un forfait pour continuer."
          : "Quota atteint pour votre forfait actuel. Passez à un forfait supérieur pour continuer.",
      });
    }

    // Récupère les produits disponibles pour un matching pertinent par l'IA
    let availableProducts: any[] = [];
    if (pool) {
      const { rows } = await pool.query("SELECT * FROM beauty_products WHERE availability_abidjan = true");
      availableProducts = rows;
    }

    const systemInstruction = `Tu es SkinDiag, un assistant d'analyse visuelle de la peau spécialement conçu et calibré pour les peaux noires et foncées.

RÈGLE FONDAMENTALE : ton analyse doit être adaptée aux nuances de peau foncée — hyperpigmentation, hypopigmentation, marques post-inflammatoires, variations naturelles de pigmentation. Ne base jamais ton analyse sur des références pensées pour peaux claires.

TU N'ES PAS UN MÉDECIN. Tu fournis une analyse visuelle indicative uniquement, jamais un diagnostic médical. Si tu observes quelque chose qui pourrait nécessiter un avis médical (lésion suspecte, inflammation sévère, changement rapide), recommande explicitement de consulter un dermatologue.

Analyse la photo de la zone "${zone}" fournie et réponds en JSON structuré selon le schéma. Sois bienveillant, précis, et jamais alarmiste sans raison.

Produits disponibles à recommander (uniquement ceux réellement pertinents pour ce que tu observes) :
${JSON.stringify(availableProducts.map(p => ({ id: p.id, name: p.name, category: p.category, suitable_for: p.suitable_for })))}`;

    const response = await getAIClient().models.generateContent({
      model: "gemini-3.5-flash",
      contents: {
        parts: [
          { inlineData: { data: image, mimeType } },
          { text: `Analyse cette photo de la zone : ${zone}.` },
        ],
      },
      config: {
        systemInstruction,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            scoreGlobal: { type: Type.INTEGER },
            typeDePeau: { type: Type.STRING },
            hydratation: { type: Type.STRING, enum: ["faible", "moyenne", "bonne"] },
            uniformite: { type: Type.STRING, enum: ["faible", "moyenne", "bonne"] },
            conditionsDetectees: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  nom: { type: Type.STRING },
                  severite: { type: Type.STRING, enum: ["légère", "modérée", "marquée"] },
                  description: { type: Type.STRING },
                },
                required: ["nom", "severite", "description"],
              },
            },
            explicationSimple: { type: Type.STRING },
            recommandationProfessionnel: { type: Type.BOOLEAN },
            raisonRecommandation: { type: Type.STRING },
            routineMatin: { type: Type.ARRAY, items: { type: Type.STRING } },
            routineSoir: { type: Type.ARRAY, items: { type: Type.STRING } },
            produitIdsRecommandes: { type: Type.ARRAY, items: { type: Type.INTEGER } },
            confiance: { type: Type.INTEGER },
          },
          required: ["scoreGlobal", "typeDePeau", "hydratation", "uniformite", "conditionsDetectees", "explicationSimple", "recommandationProfessionnel", "routineMatin", "routineSoir", "produitIdsRecommandes", "confiance"],
        },
      },
    });

    const parsed = JSON.parse(response.text || "{}");
    const produitsRecommandes = availableProducts.filter((p) => parsed.produitIdsRecommandes?.includes(p.id));

    // Incrémente le compteur d'usage seulement après une analyse réussie
    usage.count += 1;
    usageTracking.set(phone, usage);

    res.json({
      success: true,
      result: {
        zoneAnalysee: zone,
        scoreGlobal: parsed.scoreGlobal,
        typeDePeau: parsed.typeDePeau,
        hydratation: parsed.hydratation,
        uniformite: parsed.uniformite,
        conditionsDetectees: parsed.conditionsDetectees || [],
        explicationSimple: parsed.explicationSimple,
        recommandationProfessionnel: parsed.recommandationProfessionnel,
        raisonRecommandation: parsed.raisonRecommandation,
        routineMatin: parsed.routineMatin || [],
        routineSoir: parsed.routineSoir || [],
        produitsRecommandes,
        confiance: parsed.confiance,
      },
    });
  } catch (err: any) {
    console.error("[SkinDiag Analyze] Erreur:", err.message);
    res.status(500).json({ success: false, message: "L'analyse a échoué. Réessayez dans un instant." });
  }
});

app.get("/api/skindiag/products", async (req, res) => {
  if (!pool) return res.json({ success: true, products: [] });
  const { rows } = await pool.query("SELECT * FROM beauty_products ORDER BY category, name");
  res.json({ success: true, products: rows });
});

async function startServer() {
  await initDatabase();

  // process.cwd() plutôt que import.meta.url : le serveur est bundlé en CommonJS
  // (esbuild --format=cjs), où import.meta.url n'est pas disponible.
  const distPath = path.join(process.cwd(), "dist");
  app.use(express.static(distPath));
  app.get("*", (req, res) => {
    if (req.path.startsWith("/api/")) return res.status(404).json({ success: false, message: "Route inconnue." });
    res.sendFile(path.join(distPath, "index.html"));
  });

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`SkinDiag running on port ${PORT}`);
  });
}

startServer();
