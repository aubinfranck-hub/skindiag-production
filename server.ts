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
  ? new pg.Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false },
      max: 5,
      // Sans ces délais, une base endormie (plan gratuit) peut faire attendre indéfiniment
      // toute requête — y compris le chargement des comptes au démarrage, ce qui bloquerait
      // TOUT le serveur (plus aucune route ne répondrait, pas seulement la connexion).
      connectionTimeoutMillis: 10000,
      idleTimeoutMillis: 30000,
    })
  : null;

// --- Authentification : comptes créés par l'admin, connexion numéro + mot de passe ---
// (même schéma que DiagAssist : sessions et comptes en mémoire, rechargés depuis PostgreSQL
// au démarrage pour survivre aux redémarrages du serveur)
const userAccounts = new Map<string, { passwordHash: string; salt: string; createdAt: number; isAdmin: boolean }>();
const sessions = new Map<string, { phone: string; createdAt: number }>();

// Normalise un numéro de téléphone pour qu'il soit TOUJOURS identique, qu'il soit saisi
// avec espaces, tirets, ou copié-collé depuis un endroit différent (formulaire admin vs
// écran de connexion). Sans ça, un compte créé avec espaces ne correspond plus au numéro
// tapé à la connexion (qui, lui, retire les espaces) — c'est la cause du bug "compte créé
// mais impossible de se connecter".
function normalizePhone(raw: string): string {
  return String(raw || "").replace(/[\s\-().]/g, "").trim();
}

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

// Réessaie automatiquement en cas de surcharge temporaire de Gemini (503/UNAVAILABLE) ou
// d'erreur réseau passagère — jusqu'à 3 tentatives avec délai croissant. Sans ça, un simple
// pic de charge chez Google fait échouer l'analyse immédiatement pour l'utilisateur.
async function retryWithBackoff<T>(fn: () => Promise<T>, maxRetries = 3): Promise<T> {
  let lastError: any;
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err: any) {
      lastError = err;
      const message = String(err?.message || err);
      const isRetryable = message.includes("503") || message.includes("UNAVAILABLE") || message.includes("overloaded") || message.includes("ECONNRESET") || message.includes("fetch failed");
      if (!isRetryable || attempt === maxRetries - 1) throw err;
      const delayMs = 800 * Math.pow(2, attempt); // 800ms, 1.6s, 3.2s
      console.warn(`[Retry] Tentative ${attempt + 1}/${maxRetries} échouée (${message.slice(0, 80)}), nouvel essai dans ${delayMs}ms...`);
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
  throw lastError;
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
      availability_abidjan BOOLEAN NOT NULL DEFAULT true,
      actifs TEXT[] NOT NULL DEFAULT '{}',
      inci_composition TEXT NOT NULL DEFAULT '',
      is_sponsored BOOLEAN NOT NULL DEFAULT false,
      is_partner BOOLEAN NOT NULL DEFAULT false,
      fragrance_free BOOLEAN NOT NULL DEFAULT false
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
    CREATE TABLE IF NOT EXISTS analysis_history (
      id SERIAL PRIMARY KEY,
      phone TEXT NOT NULL,
      zone TEXT NOT NULL,
      result_json JSONB NOT NULL,
      created_at BIGINT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_history_phone ON analysis_history (phone, created_at DESC);
    CREATE TABLE IF NOT EXISTS orders (
      id SERIAL PRIMARY KEY,
      phone TEXT NOT NULL,
      product_id INTEGER NOT NULL REFERENCES beauty_products(id),
      quantity INTEGER NOT NULL DEFAULT 1,
      delivery_name TEXT NOT NULL,
      delivery_phone TEXT NOT NULL,
      delivery_address TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      created_at BIGINT NOT NULL
    );
  `);

  // Colonnes ajoutées après la création initiale de la table (installations existantes) —
  // ALTER sans risque si la colonne existe déjà.
  await pool.query(`
    ALTER TABLE beauty_products ADD COLUMN IF NOT EXISTS actifs TEXT[] NOT NULL DEFAULT '{}';
    ALTER TABLE beauty_products ADD COLUMN IF NOT EXISTS inci_composition TEXT NOT NULL DEFAULT '';
    ALTER TABLE beauty_products ADD COLUMN IF NOT EXISTS is_sponsored BOOLEAN NOT NULL DEFAULT false;
    ALTER TABLE beauty_products ADD COLUMN IF NOT EXISTS is_partner BOOLEAN NOT NULL DEFAULT false;
    ALTER TABLE beauty_products ADD COLUMN IF NOT EXISTS fragrance_free BOOLEAN NOT NULL DEFAULT false;
    ALTER TABLE beauty_products ADD COLUMN IF NOT EXISTS image_url TEXT NOT NULL DEFAULT '';
    ALTER TABLE beauty_products ADD COLUMN IF NOT EXISTS original_price_fcfa INTEGER;
    ALTER TABLE beauty_products ADD COLUMN IF NOT EXISTS is_new BOOLEAN NOT NULL DEFAULT false;
    ALTER TABLE beauty_products ADD COLUMN IF NOT EXISTS rating_avg NUMERIC(2,1) NOT NULL DEFAULT 4.3;
    ALTER TABLE beauty_products ADD COLUMN IF NOT EXISTS rating_count INTEGER NOT NULL DEFAULT 6;
    ALTER TABLE beauty_products ADD COLUMN IF NOT EXISTS video_url TEXT NOT NULL DEFAULT '';
  `);

  const accountsRes = await pool.query("SELECT * FROM accounts");
  let migratedPhones = 0;
  for (const row of accountsRes.rows) {
    const cleanPhone = normalizePhone(row.phone);
    userAccounts.set(cleanPhone, {
      passwordHash: row.password_hash,
      salt: row.salt,
      createdAt: Number(row.created_at),
      isAdmin: row.is_admin,
    });
    // Migration : un compte créé avant le correctif de normalisation avait un numéro avec
    // espaces stocké tel quel — on le corrige en base pour que la connexion fonctionne.
    if (cleanPhone !== row.phone) {
      await pool.query("DELETE FROM accounts WHERE phone = $1", [row.phone]);
      await pool.query(
        "INSERT INTO accounts (phone, password_hash, salt, created_at, is_admin) VALUES ($1,$2,$3,$4,$5) ON CONFLICT (phone) DO NOTHING",
        [cleanPhone, row.password_hash, row.salt, row.created_at, row.is_admin]
      );
      await pool.query("UPDATE plans SET phone = $1 WHERE phone = $2", [cleanPhone, row.phone]);
      migratedPhones++;
    }
  }
  if (migratedPhones > 0) console.log(`[DB] ${migratedPhones} numéro(s) de téléphone corrigés (espaces retirés).`);
  const SESSION_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;
  const sessionsRes = await pool.query("SELECT * FROM sessions");
  let loadedSessions = 0;
  for (const row of sessionsRes.rows) {
    if (Date.now() - Number(row.created_at) <= SESSION_MAX_AGE_MS) {
      sessions.set(row.token, { phone: normalizePhone(row.phone), createdAt: Number(row.created_at) });
      loadedSessions++;
    }
  }
  console.log(`[DB] ${accountsRes.rows.length} compte(s), ${loadedSessions} session(s) rechargé(s).`);

  const plansRes = await pool.query("SELECT * FROM plans");
  for (const row of plansRes.rows) {
    userPlans.set(normalizePhone(row.phone), { plan: row.plan, activatedAt: Number(row.activated_at) });
  }

  // Compte admin "graine" créé une seule fois depuis les variables d'environnement
  if (process.env.ADMIN_SEED_PHONE && process.env.ADMIN_SEED_PASSWORD && !userAccounts.has(process.env.ADMIN_SEED_PHONE)) {
    createAccount(process.env.ADMIN_SEED_PHONE, process.env.ADMIN_SEED_PASSWORD, true);
    setUserPlan(process.env.ADMIN_SEED_PHONE, "premium");
    console.log(`[Démarrage] Compte admin créé pour ${process.env.ADMIN_SEED_PHONE}.`);
  }

  // Contrainte d'unicité sur le nom, nécessaire pour un INSERT idempotent (ON CONFLICT).
  // Ignoré silencieusement si elle existe déjà (installations précédentes).
  try {
    await pool.query(`ALTER TABLE beauty_products ADD CONSTRAINT beauty_products_name_key UNIQUE (name);`);
  } catch { /* contrainte déjà présente */ }

  // Composition INCI/actifs réelle par produit — c'est elle qui alimente le moteur de
  // recommandation (besoin → actif → produit), jamais la description marketing seule.
  // INSERT idempotent (ON CONFLICT (name) DO NOTHING) pour ne jamais dupliquer au redémarrage.
  await pool.query(`
    INSERT INTO beauty_products (name, brand, category, price_fcfa, suitable_for, availability_abidjan, actifs, inci_composition, is_sponsored, is_partner, fragrance_free) VALUES
    ('Cetaphil Gentle Skin Cleanser', 'Cetaphil', 'cleanser', 8500, ARRAY['oily','dry','combination','sensitive'], true, ARRAY['glycerine'], 'Aqua, Cetyl Alcohol, Propylene Glycol, Sodium Lauryl Sulfate, Stearyl Alcohol, Sodium Cocoyl Isethionate, Glycerin', false, false, true),
    ('CeraVe Hydrating Cleanser', 'CeraVe', 'cleanser', 10000, ARRAY['dry','sensitive'], true, ARRAY['ceramides','glycerine','acide_hyaluronique'], 'Aqua, Glycerin, Cetearyl Alcohol, Ceramide NP, Ceramide AP, Ceramide EOP, Hyaluronic Acid, Niacinamide', true, true, true),
    ('La Roche-Posay Toleriane Hydrating Cleansing Milk', 'La Roche-Posay', 'cleanser', 12000, ARRAY['dry','sensitive'], true, ARRAY['glycerine','niacinamide'], 'Aqua, Glycerin, Niacinamide, Shea Butter, Ceramide-3', false, false, true),
    ('CeraVe Facial Moisturizing Lotion', 'CeraVe', 'moisturizer', 12000, ARRAY['dry','sensitive','combination'], true, ARRAY['ceramides','acide_hyaluronique','glycerine'], 'Aqua, Glycerin, Ceramide NP, Ceramide AP, Ceramide EOP, Hyaluronic Acid, Niacinamide, MVE Technology', true, true, true),
    ('Cetaphil Rich Hydrating Night Cream', 'Cetaphil', 'moisturizer', 13500, ARRAY['dry','sensitive'], true, ARRAY['ceramides','glycerine'], 'Aqua, Glycerin, Shea Butter, Ceramide NP, Panthenol', false, false, true),
    ('La Roche-Posay Toleriane Fluid', 'La Roche-Posay', 'moisturizer', 11000, ARRAY['oily','combination'], true, ARRAY['niacinamide','glycerine'], 'Aqua, Glycerin, Niacinamide, Ceramide-3, Prebiotic Thermal Water', false, false, true),
    ('BeautyCI Shea Butter Moisturizer', 'BeautyCI', 'moisturizer', 5000, ARRAY['all'], true, ARRAY['beurre_de_karite','glycerine'], 'Butyrospermum Parkii (Shea Butter), Glycerin, Vitamin E', false, false, true),
    ('Vitamin C Serum 20% with Hyaluronic Acid', 'Generic', 'serum', 6000, ARRAY['all'], true, ARRAY['vitamine_c','acide_hyaluronique'], 'Aqua, Ascorbic Acid 20%, Hyaluronic Acid, Vitamin E, Ferulic Acid', true, true, false),
    ('Hyaluronic Acid Serum 99%', 'Generic', 'serum', 4000, ARRAY['all'], true, ARRAY['acide_hyaluronique'], 'Aqua, Sodium Hyaluronate 99%, Panthenol', false, false, true),
    ('Neutrogena Ultra Sheer Dry-Touch SPF 30', 'Neutrogena', 'sunscreen', 11000, ARRAY['all'], true, ARRAY['protection_solaire'], 'Avobenzone, Homosalate, Octisalate, Octocrylene, Helioplex Technology', false, false, false),
    ('The Ordinary Niacinamide 10% + Zinc 1%', 'The Ordinary', 'serum', 7500, ARRAY['oily','combination'], true, ARRAY['niacinamide'], 'Aqua, Niacinamide 10%, Zinc PCA 1%, Pentylene Glycol', true, true, true),
    ('The Ordinary Azelaic Acid Suspension 10%', 'The Ordinary', 'serum', 8000, ARRAY['all'], true, ARRAY['acide_azelaique'], 'Azelaic Acid 10%, Aqua, Propanediol, Squalane', false, true, true)
    ON CONFLICT (name) DO NOTHING;
  `);

  // Backfill pour les installations existantes : les 10 produits d'origine ont pu être créés
  // avant l'ajout des colonnes actifs/composition — on les met à jour explicitement par nom.
  const backfill: [string, string[], string, boolean, boolean][] = [
    ["Cetaphil Gentle Skin Cleanser", ["glycerine"], "Aqua, Cetyl Alcohol, Propylene Glycol, Sodium Lauryl Sulfate, Stearyl Alcohol, Sodium Cocoyl Isethionate, Glycerin", false, false],
    ["CeraVe Hydrating Cleanser", ["ceramides", "glycerine", "acide_hyaluronique"], "Aqua, Glycerin, Cetearyl Alcohol, Ceramide NP, Ceramide AP, Ceramide EOP, Hyaluronic Acid, Niacinamide", true, true],
    ["La Roche-Posay Toleriane Hydrating Cleansing Milk", ["glycerine", "niacinamide"], "Aqua, Glycerin, Niacinamide, Shea Butter, Ceramide-3", false, false],
    ["CeraVe Facial Moisturizing Lotion", ["ceramides", "acide_hyaluronique", "glycerine"], "Aqua, Glycerin, Ceramide NP, Ceramide AP, Ceramide EOP, Hyaluronic Acid, Niacinamide, MVE Technology", true, true],
    ["Cetaphil Rich Hydrating Night Cream", ["ceramides", "glycerine"], "Aqua, Glycerin, Shea Butter, Ceramide NP, Panthenol", false, false],
    ["La Roche-Posay Toleriane Fluid", ["niacinamide", "glycerine"], "Aqua, Glycerin, Niacinamide, Ceramide-3, Prebiotic Thermal Water", false, false],
    ["BeautyCI Shea Butter Moisturizer", ["beurre_de_karite", "glycerine"], "Butyrospermum Parkii (Shea Butter), Glycerin, Vitamin E", false, false],
    ["Vitamin C Serum 20% with Hyaluronic Acid", ["vitamine_c", "acide_hyaluronique"], "Aqua, Ascorbic Acid 20%, Hyaluronic Acid, Vitamin E, Ferulic Acid", true, true],
    ["Hyaluronic Acid Serum 99%", ["acide_hyaluronique"], "Aqua, Sodium Hyaluronate 99%, Panthenol", false, false],
    ["Neutrogena Ultra Sheer Dry-Touch SPF 30", ["protection_solaire"], "Avobenzone, Homosalate, Octisalate, Octocrylene, Helioplex Technology", false, false],
  ];
  for (const [name, actifsList, inci, sponsored, partner] of backfill) {
    await pool.query(
      `UPDATE beauty_products SET actifs = $2, inci_composition = $3, is_sponsored = $4, is_partner = $5
       WHERE name = $1 AND (array_length(actifs, 1) IS NULL OR inci_composition = '')`,
      [name, actifsList, inci, sponsored, partner]
    );
  }
  // Photo générique par catégorie (licence Unsplash gratuite) pour tout produit qui n'a pas
  // encore de photo — appliqué à chaque redémarrage, donc couvre aussi les nouveaux produits.
  const categoryPhotos: Record<string, string> = {
    serum: "https://images.unsplash.com/photo-1576426863848-c21f53c60b19?w=500&q=80&auto=format&fit=crop",
    moisturizer: "https://images.unsplash.com/photo-1609097164502-59a1f0f9a66f?w=500&q=80&auto=format&fit=crop",
    cleanser: "https://images.unsplash.com/photo-1616750819456-5cdee9b85d22?w=500&q=80&auto=format&fit=crop",
    sunscreen: "https://images.unsplash.com/photo-1597931752949-98c74b5b159f?w=500&q=80&auto=format&fit=crop",
  };
  for (const [cat, url] of Object.entries(categoryPhotos)) {
    await pool.query(
      "UPDATE beauty_products SET image_url = $1 WHERE category = $2 AND image_url = ''",
      [url, cat]
    );
  }

  // Données réalistes de vitrine (promos, nouveautés, notes) — appliquées une seule fois par
  // produit (WHERE rating_count = 6, valeur par défaut), n'écrase jamais une valeur déjà modifiée.
  const showcaseData: Record<string, { originalPrice?: number; isNew?: boolean; rating: number; count: number }> = {
    "Cetaphil Gentle Skin Cleanser": { rating: 4.4, count: 18 },
    "CeraVe Hydrating Cleanser": { originalPrice: 12000, rating: 4.6, count: 27 },
    "La Roche-Posay Toleriane Hydrating Cleansing Milk": { rating: 4.3, count: 9 },
    "CeraVe Facial Moisturizing Lotion": { originalPrice: 14000, isNew: true, rating: 4.7, count: 21 },
    "Cetaphil Rich Hydrating Night Cream": { rating: 4.2, count: 5 },
    "La Roche-Posay Toleriane Fluid": { rating: 4.1, count: 8 },
    "BeautyCI Shea Butter Moisturizer": { rating: 4.5, count: 14 },
    "Vitamin C Serum 20% with Hyaluronic Acid": { originalPrice: 8000, rating: 4.4, count: 16 },
    "Hyaluronic Acid Serum 99%": { rating: 4.6, count: 11 },
    "Neutrogena Ultra Sheer Dry-Touch SPF 30": { isNew: true, rating: 4.5, count: 7 },
    "The Ordinary Niacinamide 10% + Zinc 1%": { originalPrice: 9000, isNew: true, rating: 4.8, count: 32 },
    "The Ordinary Azelaic Acid Suspension 10%": { rating: 4.3, count: 12 },
  };
  for (const [name, data] of Object.entries(showcaseData)) {
    await pool.query(
      `UPDATE beauty_products SET original_price_fcfa = $1, is_new = $2, rating_avg = $3, rating_count = $4
       WHERE name = $5 AND rating_count = 6`,
      [data.originalPrice || null, data.isNew === true, data.rating, data.count, name]
    );
  }

  console.log("[DB] Produits vérifiés/migrés (actifs, composition, sponsoring).");
}

app.use(cors());
// Limite augmentée pour accepter les courtes vidéos (mode capture vidéo), pas seulement les photos
app.use(express.json({ limit: "40mb" }));

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
  const fullPhone = normalizePhone(`${countryCode || "+225"}${phoneNumber}`);
  const localOnly = normalizePhone(phoneNumber); // repli : anciens comptes créés sans indicatif

  const attempts = loginAttempts.get(fullPhone);
  if (attempts && attempts.count >= 8 && Date.now() - attempts.firstAttempt < 15 * 60 * 1000) {
    return res.status(429).json({ success: false, message: "Trop de tentatives. Réessayez dans 15 minutes." });
  }

  // Le compte peut exister sous le bon format (+indicatif+numéro) OU, pour d'anciens comptes
  // créés avant le correctif du formulaire admin, sous le numéro local seul sans indicatif.
  let matchedPhone: string | null = null;
  if (verifyAccountPassword(fullPhone, password)) {
    matchedPhone = fullPhone;
  } else if (localOnly !== fullPhone && verifyAccountPassword(localOnly, password)) {
    matchedPhone = localOnly;
    // Migration automatique et silencieuse vers le format correct, pour que ça ne se
    // reproduise plus et que la fiche compte soit propre pour l'admin désormais.
    const acc = userAccounts.get(localOnly)!;
    userAccounts.delete(localOnly);
    userAccounts.set(fullPhone, acc);
    persistAccount(fullPhone).catch(() => {});
    pool?.query("DELETE FROM accounts WHERE phone = $1", [localOnly]).catch(() => {});
    const oldPlan = userPlans.get(localOnly);
    if (oldPlan) {
      userPlans.delete(localOnly);
      userPlans.set(fullPhone, oldPlan);
      persistPlan(fullPhone).catch(() => {});
      pool?.query("DELETE FROM plans WHERE phone = $1", [localOnly]).catch(() => {});
    }
  }

  if (!matchedPhone) {
    // Journal de diagnostic temporaire — ne révèle jamais le mot de passe, seulement les
    // numéros comparés et si un compte existe sous une forme proche (aide à repérer une
    // variante de stockage inattendue sans avoir à deviner à distance).
    const allPhones = Array.from(userAccounts.keys());
    const closeMatches = allPhones.filter((p) => p.replace(/\D/g, "").endsWith(phoneNumber.replace(/\D/g, "").slice(-8)));
    console.warn(`[Login] Échec pour fullPhone="${fullPhone}" localOnly="${localOnly}". Comptes existants proches: ${JSON.stringify(closeMatches)}. Total comptes: ${allPhones.length}.`);
    const a = loginAttempts.get(fullPhone) || { count: 0, firstAttempt: Date.now() };
    a.count++;
    loginAttempts.set(fullPhone, a);
    return res.status(401).json({ success: false, message: "Numéro ou mot de passe incorrect." });
  }
  loginAttempts.delete(fullPhone);

  // Session unique : une nouvelle connexion déconnecte les précédentes (sauf comptes admin)
  const isAdminAccount = userAccounts.get(matchedPhone)?.isAdmin === true;
  if (!isAdminAccount) {
    for (const [oldToken, s] of sessions) {
      if (s.phone === matchedPhone) sessions.delete(oldToken);
    }
  }

  const token = createSession(matchedPhone);
  res.json({ success: true, sessionToken: token, isAdmin: isAdminAccount });
});

app.get("/api/admin/accounts", requireAdminAuth, (req, res) => {
  const accounts = Array.from(userAccounts.entries()).map(([phone, acc]) => ({
    phone, createdAt: acc.createdAt, isAdmin: acc.isAdmin, plan: getEffectivePlan(phone),
  }));
  res.json({ success: true, accounts });
});

app.post("/api/admin/create-account", requireAdminAuth, (req, res) => {
  const { password, isAdmin, plan } = req.body;
  const phone = normalizePhone(req.body.phone);
  if (!phone || !password) {
    return res.status(400).json({ success: false, message: "Numéro et mot de passe requis." });
  }
  createAccount(phone, password, isAdmin === true);
  if (plan) setUserPlan(phone, plan);
  res.json({ success: true, normalizedPhone: phone });
});

app.post("/api/admin/set-plan", requireAdminAuth, (req, res) => {
  const plan = req.body.plan;
  const phone = normalizePhone(req.body.phone);
  if (!phone || !plan) return res.status(400).json({ success: false, message: "Numéro et forfait requis." });
  setUserPlan(phone, plan);
  res.json({ success: true });
});

app.post("/api/admin/accounts/:phone/reset-password", requireAdminAuth, (req, res) => {
  const phone = normalizePhone(decodeURIComponent(req.params.phone));
  if (!userAccounts.has(phone)) return res.status(404).json({ success: false, message: "Compte introuvable." });
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let newPassword = "";
  for (let i = 0; i < 8; i++) newPassword += chars[Math.floor(Math.random() * chars.length)];
  const acc = userAccounts.get(phone)!;
  createAccount(phone, newPassword, acc.isAdmin);
  // Le mot de passe change : toutes les sessions existantes sur ce compte sont invalidées
  for (const [token, s] of sessions) {
    if (s.phone === phone) sessions.delete(token);
  }
  res.json({ success: true, newPassword });
});

app.post("/api/admin/accounts/:phone/toggle-admin", requireAdminAuth, (req, res) => {
  const phone = decodeURIComponent(req.params.phone);
  const acc = userAccounts.get(phone);
  if (!acc) return res.status(404).json({ success: false, message: "Compte introuvable." });
  acc.isAdmin = !acc.isAdmin;
  userAccounts.set(phone, acc);
  persistAccount(phone).catch(() => {});
  res.json({ success: true, isAdmin: acc.isAdmin });
});

app.delete("/api/admin/accounts/:phone", requireAdminAuth, async (req, res) => {
  const phone = decodeURIComponent(req.params.phone);
  if (!userAccounts.has(phone)) return res.status(404).json({ success: false, message: "Compte introuvable." });
  userAccounts.delete(phone);
  userPlans.delete(phone);
  for (const [token, s] of sessions) {
    if (s.phone === phone) sessions.delete(token);
  }
  if (pool) {
    try {
      await pool.query("DELETE FROM accounts WHERE phone = $1", [phone]);
      await pool.query("DELETE FROM plans WHERE phone = $1", [phone]);
      await pool.query("DELETE FROM sessions WHERE phone = $1", [phone]);
    } catch (err: any) {
      console.error("[DB] Échec suppression compte:", err.message);
    }
  }
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

// Contrôle qualité SEUL, rapide, exécuté immédiatement après la capture — avant le questionnaire.
// Évite de faire répondre l'utilisateur à 6 questions pour finalement rejeter une mauvaise photo.
// Ne consomme jamais le quota (ce n'est pas une analyse).
app.post("/api/skindiag/check-quality", analyzeLimiter, requireAuth, async (req: any, res) => {
  try {
    const { image, mimeType } = req.body;
    if (!image || !mimeType) {
      return res.status(400).json({ success: false, message: "Photo requise." });
    }
    const isVideo = mimeType.startsWith("video/");
    const response = await retryWithBackoff(() => getAIClient().models.generateContent({
      model: "gemini-3.5-flash",
      contents: {
        parts: [
          { inlineData: { data: image, mimeType } },
          { text: `Contrôle uniquement la qualité technique de cette ${isVideo ? "vidéo" : "photo"}, ne fais aucune analyse de peau.` },
        ],
      },
      config: {
        systemInstruction: `Tu vérifies UNIQUEMENT la qualité technique d'une ${isVideo ? "vidéo" : "photo"} destinée à une analyse de peau — pas d'analyse dermatologique ici.
Vérifie : luminosité, exposition, netteté, reflets, dominante de couleur, cadrage (zone insuffisamment visible, distance excessive, obstruction), filtre/retouche artificielle, compression excessive.
Classe en 3 niveaux : "A_excellente" (fiable sans réserve), "B_exploitable_imparfaite" (analysable mais fiabilité réduite — précise pourquoi dans "message"), "C_insuffisante" (analyse impossible — "message" doit expliquer clairement quoi corriger et comment).
Réponds UNIQUEMENT en JSON selon le schéma.`,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            decision: { type: Type.STRING, enum: ["A_excellente", "B_exploitable_imparfaite", "C_insuffisante"] },
            acceptable: { type: Type.BOOLEAN },
            score: { type: Type.INTEGER },
            problemes: { type: Type.ARRAY, items: { type: Type.STRING } },
            message: { type: Type.STRING },
          },
          required: ["decision", "acceptable", "score", "problemes", "message"],
        },
      },
    }));
    const parsed = JSON.parse(response.text || "{}");
    res.json({ success: true, qualiteImage: parsed });
  } catch (err: any) {
    console.error("[SkinDiag CheckQuality] Erreur:", err.message);
    res.status(500).json({ success: false, message: "Vérification impossible. Réessayez." });
  }
});

app.post("/api/skindiag/analyze", analyzeLimiter, requireAuth, async (req: any, res) => {
  try {
    const { zone, image, mimeType, questionnaire } = req.body;
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

    // Récupère les produits disponibles (composition/actifs) pour le matching déterministe
    let availableProducts: any[] = [];
    if (pool) {
      const { rows } = await pool.query("SELECT * FROM beauty_products WHERE availability_abidjan = true");
      availableProducts = rows;
    }

    const isVideo = mimeType.startsWith("video/");
    const systemInstruction = `Tu es SkinDiag, le moteur d'analyse visuelle de la peau spécialement conçu et calibré pour les peaux noires et foncées.

═══ ÉTAPE 1 — CONTRÔLE QUALITÉ DE L'IMAGE (OBLIGATOIRE, AVANT TOUTE ANALYSE) ═══
Vérifie : luminosité (trop sombre/correcte/trop claire), exposition, netteté (flou/mouvement/mise au point), reflets (flash/huile/transpiration), dominante de couleur (balance des blancs), cadrage (zone insuffisamment visible, distance excessive, obstruction), filtre/retouche artificielle, compression excessive.
Classe la photo dans "decision" selon 3 niveaux, jamais binaire :
- "A_excellente" : analyse fiable possible sans réserve.
- "B_exploitable_imparfaite" : analyse possible mais fiabilité réduite — précise dans "message" ce qui limite la fiabilité (ex: légère sous-exposition), et baisse en conséquence "confianceImage". Tu PEUX analyser, mais dis-le clairement.
- "C_insuffisante" : analyse impossible. Remplis UNIQUEMENT "qualiteImage" (decision=C_insuffisante, score bas, problemes listés, message clair demandant de reprendre la photo) et laisse tous les autres champs à leurs valeurs vides/nulles par défaut (scoreGlobal=0, tableaux vides, "analyseConcluante"=false). Ne fabrique JAMAIS d'observation sur une image inexploitable.

═══ RÈGLE PEAU NOIRE/FONCÉE ═══
Adapte-toi aux nuances de peau foncée — hyperpigmentation, hypopigmentation, marques post-inflammatoires. L'ABSENCE de rougeur visible ne signifie PAS l'absence d'inflammation sur peau noire : base-toi sur plusieurs indices (texture, relief, brillance, desquamation), jamais uniquement la couleur rouge.
Pour "profilTeinte", NE réduis JAMAIS la couleur de peau à une classification raciale ou à Fitzpatrick seul — utilise l'échelle purement colorimétrique fournie (très_clair, clair, brun_clair, brun_moyen, brun_fonce, tres_fonce), fondée uniquement sur ce que tu observes dans l'image.

═══ ÉTAPE 2 — 3 NIVEAUX DE RÉSULTAT (JAMAIS DE PSEUDO-DIAGNOSTIC) ═══
Niveau 1 "observation" : ce que tu vois factuellement, sans interprétation ("zone présentant une pigmentation plus foncée que les zones voisines").
Niveau 2 "hypothesesCompatibles" : liste de causes possibles compatibles avec l'observation (jamais une certitude, toujours plusieurs pistes si pertinent).
Niveau 3 "orientation" : recommandation de consulter un professionnel si signes inhabituels (saignement, douleur, évolution rapide, ulcération, lésion inquiétante) — "recommandationProfessionnel" à true dans ce cas.
Si les caractéristiques observées ne permettent PAS de conclure clairement : mets "analyseConcluante" à false et explique pourquoi dans "explicationSimple" (qualité insuffisante, caractéristiques ambiguës) plutôt que d'inventer une conclusion. Tu as le droit de dire "je ne sais pas".

DEUX SCORES DE CONFIANCE DISTINCTS, NE JAMAIS LES CONFONDRE :
- "confianceImage" (0-100) : à quel point la PHOTO elle-même est exploitable techniquement (netteté, éclairage, cadrage) — indépendant de ce qui est observé.
- "confianceMotifClinique" (0-100) : à quel point le MOTIF visuel observé est net et cohérent avec les hypothèses proposées. Ce n'est PAS "probabilité d'avoir telle maladie" — seulement la clarté du motif visuel compatible avec l'hypothèse. Une confiance basse ici doit se refléter dans "analyseConcluante"=false si trop faible pour conclure.

═══ ÉTAPE 3 — BESOINS CUTANÉS AVANT TOUT PRODUIT ═══
Ne recommande JAMAIS un produit directement. Le raisonnement est TOUJOURS : observation → besoin cutané (ex: "hydratation", "uniformité du teint", "apaisement", "protection barrière") → actifs pertinents pour ce besoin (parmi : vitamine_c, niacinamide, acide_hyaluronique, ceramides, glycerine, acide_azelaique, beurre_de_karite, protection_solaire, retinoides, uree) → PUIS uniquement les produits de la liste ci-dessous qui contiennent réellement ces actifs. Remplis "besoinsIdentifies" (besoin + priorité) et "actifsRecherches" (liste des codes actifs, doit correspondre exactement aux valeurs possibles listées) — le serveur fera lui-même le matching produit par composition, ne choisis pas les produits toi-même.

${isVideo
  ? `Une COURTE VIDÉO de la zone "${zone}" t'est fournie. Observe-la sur toute sa durée. Si l'éclairage/cadrage varie trop pour juger correctement, indique-le dans qualiteImage.`
  : `Une PHOTO de la zone "${zone}" t'est fournie.`}

═══ CONTEXTE DÉCLARÉ PAR L'UTILISATEUR (à croiser avec l'image, jamais à ignorer) ═══
${questionnaire ? `
- Depuis quand : ${questionnaire.duree}
- Démangeaisons : ${questionnaire.demange}
- Douleur : ${questionnaire.douloureux}
- Zone agrandie récemment : ${questionnaire.aggrandie}
- Nouveau produit utilisé récemment : ${questionnaire.nouveauProduit}
- Blessure/irritation avant l'apparition : ${questionnaire.blessureAvant}
Si la douleur, l'agrandissement rapide ou une évolution inhabituelle sont rapportés, cela renforce la nécessité d'une orientation vers un professionnel (recommandationProfessionnel=true).` : "Aucun contexte déclaré fourni."}

Réponds UNIQUEMENT en JSON structuré selon le schéma fourni.`;

    const actifsEnum = ["vitamine_c", "niacinamide", "acide_hyaluronique", "ceramides", "glycerine", "acide_azelaique", "beurre_de_karite", "protection_solaire", "retinoides", "uree"];

    const response = await retryWithBackoff(() => getAIClient().models.generateContent({
      model: "gemini-3.5-flash",
      contents: {
        parts: [
          { inlineData: { data: image, mimeType } },
          { text: `Analyse cette ${isVideo ? "vidéo" : "photo"} de la zone : ${zone}.` },
        ],
      },
      config: {
        systemInstruction,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            qualiteImage: {
              type: Type.OBJECT,
              properties: {
                decision: { type: Type.STRING, enum: ["A_excellente", "B_exploitable_imparfaite", "C_insuffisante"] },
                acceptable: { type: Type.BOOLEAN },
                score: { type: Type.INTEGER },
                problemes: { type: Type.ARRAY, items: { type: Type.STRING } },
                message: { type: Type.STRING },
              },
              required: ["decision", "acceptable", "score", "problemes", "message"],
            },
            analyseConcluante: { type: Type.BOOLEAN },
            scoreGlobal: { type: Type.INTEGER },
            typeDePeau: { type: Type.STRING },
            profilTeinte: { type: Type.STRING, enum: ["tres_clair", "clair", "brun_clair", "brun_moyen", "brun_fonce", "tres_fonce"] },
            hydratation: { type: Type.STRING, enum: ["faible", "moyenne", "bonne"] },
            uniformite: { type: Type.STRING, enum: ["faible", "moyenne", "bonne"] },
            observation: { type: Type.STRING },
            hypothesesCompatibles: { type: Type.ARRAY, items: { type: Type.STRING } },
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
            besoinsIdentifies: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  besoin: { type: Type.STRING },
                  priorite: { type: Type.STRING, enum: ["principal", "secondaire"] },
                },
                required: ["besoin", "priorite"],
              },
            },
            actifsRecherches: { type: Type.ARRAY, items: { type: Type.STRING, enum: actifsEnum } },
            routineMatin: { type: Type.ARRAY, items: { type: Type.STRING } },
            routineSoir: { type: Type.ARRAY, items: { type: Type.STRING } },
            confianceImage: { type: Type.INTEGER },
            confianceMotifClinique: { type: Type.INTEGER },
          },
          required: ["qualiteImage", "analyseConcluante", "scoreGlobal", "typeDePeau", "profilTeinte", "hydratation", "uniformite", "observation", "hypothesesCompatibles", "conditionsDetectees", "explicationSimple", "recommandationProfessionnel", "besoinsIdentifies", "actifsRecherches", "routineMatin", "routineSoir", "confianceImage", "confianceMotifClinique"],
        },
      },
    }));

    const parsed = JSON.parse(response.text || "{}");

    // Photo/vidéo de mauvaise qualité : on s'arrête ici, aucune analyse fabriquée, pas de
    // décompte du quota (on ne pénalise pas l'utilisateur pour une photo à reprendre).
    if (parsed.qualiteImage && (parsed.qualiteImage.decision === "C_insuffisante" || parsed.qualiteImage.acceptable === false)) {
      return res.json({
        success: true,
        qualityRejected: true,
        qualiteImage: parsed.qualiteImage,
      });
    }

    // Matching produit déterministe par composition réelle (actifs), jamais choisi par l'IA
    // elle-même — évite qu'un produit sponsorisé incompatible ne remonte artificiellement.
    const actifsRecherches: string[] = parsed.actifsRecherches || [];
    const scoredProducts = availableProducts
      .map((p) => {
        const productActifs: string[] = p.actifs || [];
        const overlap = productActifs.filter((a) => actifsRecherches.includes(a));
        if (overlap.length === 0) return null;
        const matchScore = Math.round((overlap.length / actifsRecherches.length) * 100);
        return { ...p, matchScore, actifsCorrespondants: overlap };
      })
      .filter((p): p is NonNullable<typeof p> => p !== null)
      .sort((a, b) => b.matchScore - a.matchScore);

    const produitsPartenaires = scoredProducts.filter((p) => p.is_sponsored);
    const autresProduits = scoredProducts.filter((p) => !p.is_sponsored);

    // Incrémente le compteur d'usage seulement après une analyse réussie et concluante
    usage.count += 1;
    usageTracking.set(phone, usage);

    const resultPayload = {
      zoneAnalysee: zone,
      qualiteImage: parsed.qualiteImage,
      analyseConcluante: parsed.analyseConcluante,
      scoreGlobal: parsed.scoreGlobal,
      typeDePeau: parsed.typeDePeau,
      profilTeinte: parsed.profilTeinte,
      hydratation: parsed.hydratation,
      uniformite: parsed.uniformite,
      observation: parsed.observation,
      hypothesesCompatibles: parsed.hypothesesCompatibles || [],
      conditionsDetectees: parsed.conditionsDetectees || [],
      explicationSimple: parsed.explicationSimple,
      recommandationProfessionnel: parsed.recommandationProfessionnel,
      raisonRecommandation: parsed.raisonRecommandation,
      besoinsIdentifies: parsed.besoinsIdentifies || [],
      actifsRecherches,
      routineMatin: parsed.routineMatin || [],
      routineSoir: parsed.routineSoir || [],
      produitsPartenaires,
      autresProduits,
      confianceImage: parsed.confianceImage,
      confianceMotifClinique: parsed.confianceMotifClinique,
    };

    // Sauvegarde dans l'historique côté serveur (visible depuis n'importe quel appareil)
    if (pool) {
      pool.query(
        "INSERT INTO analysis_history (phone, zone, result_json, created_at) VALUES ($1,$2,$3,$4)",
        [phone, zone, JSON.stringify(resultPayload), Date.now()]
      ).catch((err) => console.error("[DB] Échec sauvegarde historique:", err.message));
    }

    res.json({ success: true, result: resultPayload });
  } catch (err: any) {
    console.error("[SkinDiag Analyze] Erreur:", err.message);
    res.status(500).json({ success: false, message: "L'analyse a échoué. Réessayez dans un instant." });
  }
});

app.get("/api/skindiag/history", requireAuth, async (req: any, res) => {
  if (!pool) return res.json({ success: true, history: [] });
  try {
    const { rows } = await pool.query(
      "SELECT id, zone, result_json, created_at FROM analysis_history WHERE phone = $1 ORDER BY created_at DESC LIMIT 30",
      [req.session.phone]
    );
    res.json({
      success: true,
      history: rows.map((r) => ({ id: r.id, zone: r.zone, createdAt: Number(r.created_at), ...r.result_json })),
    });
  } catch (err: any) {
    console.error("[DB] Échec lecture historique:", err.message);
    res.status(500).json({ success: false, message: "Impossible de charger l'historique." });
  }
});

app.post("/api/skindiag/order", requireAuth, async (req: any, res) => {
  if (!pool) return res.status(503).json({ success: false, message: "Service indisponible." });
  const { productId, quantity, deliveryName, deliveryPhone, deliveryAddress } = req.body;
  if (!productId || !deliveryName || !deliveryPhone || !deliveryAddress) {
    return res.status(400).json({ success: false, message: "Informations de livraison incomplètes." });
  }
  try {
    const { rows } = await pool.query(
      `INSERT INTO orders (phone, product_id, quantity, delivery_name, delivery_phone, delivery_address, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id`,
      [req.session.phone, productId, quantity || 1, deliveryName, deliveryPhone, deliveryAddress, Date.now()]
    );
    res.json({ success: true, orderId: rows[0].id });
  } catch (err: any) {
    console.error("[DB] Échec création commande:", err.message);
    res.status(500).json({ success: false, message: "Impossible d'enregistrer la commande." });
  }
});

app.get("/api/admin/orders", requireAdminAuth, async (req, res) => {
  if (!pool) return res.json({ success: true, orders: [] });
  const { rows } = await pool.query(`
    SELECT o.*, p.name AS product_name, p.price_fcfa
    FROM orders o JOIN beauty_products p ON p.id = o.product_id
    ORDER BY o.created_at DESC LIMIT 100
  `);
  res.json({ success: true, orders: rows });
});

app.post("/api/admin/orders/:id/status", requireAdminAuth, async (req, res) => {
  if (!pool) return res.status(503).json({ success: false });
  const { status } = req.body;
  await pool.query("UPDATE orders SET status = $1 WHERE id = $2", [status, req.params.id]);
  res.json({ success: true });
});

app.get("/api/skindiag/products", async (req, res) => {
  if (!pool) return res.json({ success: true, products: [] });
  const { rows } = await pool.query("SELECT * FROM beauty_products ORDER BY category, name");
  res.json({ success: true, products: rows });
});

app.post("/api/admin/products", requireAdminAuth, async (req, res) => {
  if (!pool) return res.status(503).json({ success: false, message: "Service indisponible." });
  const { name, brand, category, price_fcfa, actifs, inci_composition, is_sponsored, is_partner, fragrance_free, suitable_for, image_url, video_url } = req.body;
  if (!name || !brand || !category || !price_fcfa) {
    return res.status(400).json({ success: false, message: "Nom, marque, catégorie et prix requis." });
  }
  // Photo par défaut selon la catégorie si aucune URL fournie
  const categoryPhotos: Record<string, string> = {
    serum: "https://images.unsplash.com/photo-1576426863848-c21f53c60b19?w=500&q=80&auto=format&fit=crop",
    moisturizer: "https://images.unsplash.com/photo-1609097164502-59a1f0f9a66f?w=500&q=80&auto=format&fit=crop",
    cleanser: "https://images.unsplash.com/photo-1616750819456-5cdee9b85d22?w=500&q=80&auto=format&fit=crop",
    sunscreen: "https://images.unsplash.com/photo-1597931752949-98c74b5b159f?w=500&q=80&auto=format&fit=crop",
  };
  const finalImageUrl = image_url || categoryPhotos[category] || "";
  try {
    await pool.query(
      `INSERT INTO beauty_products (name, brand, category, price_fcfa, suitable_for, availability_abidjan, actifs, inci_composition, is_sponsored, is_partner, fragrance_free, image_url, video_url)
       VALUES ($1,$2,$3,$4,$5,true,$6,$7,$8,$9,$10,$11,$12)
       ON CONFLICT (name) DO UPDATE SET brand=$2, category=$3, price_fcfa=$4, suitable_for=$5, actifs=$6, inci_composition=$7, is_sponsored=$8, is_partner=$9, fragrance_free=$10, image_url=$11, video_url=$12`,
      [name, brand, category, price_fcfa, suitable_for || ["all"], actifs || [], inci_composition || "", is_sponsored === true, is_partner === true, fragrance_free === true, finalImageUrl, video_url || ""]
    );
    res.json({ success: true });
  } catch (err: any) {
    console.error("[DB] Échec création/mise à jour produit:", err.message);
    res.status(500).json({ success: false, message: "Échec de l'enregistrement du produit." });
  }
});

app.post("/api/admin/products/:id/sponsor", requireAdminAuth, async (req, res) => {
  if (!pool) return res.status(503).json({ success: false, message: "Service indisponible." });
  const { is_sponsored, is_partner } = req.body;
  await pool.query("UPDATE beauty_products SET is_sponsored = $1, is_partner = $2 WHERE id = $3", [is_sponsored === true, is_partner === true, req.params.id]);
  res.json({ success: true });
});

async function startServer() {
  // process.cwd() plutôt que import.meta.url : le serveur est bundlé en CommonJS
  // (esbuild --format=cjs), où import.meta.url n'est pas disponible.
  const distPath = path.join(process.cwd(), "dist");
  app.use(express.static(distPath));
  app.get("*", (req, res) => {
    if (req.path.startsWith("/api/")) return res.status(404).json({ success: false, message: "Route inconnue." });
    res.sendFile(path.join(distPath, "index.html"));
  });

  // Le serveur écoute IMMÉDIATEMENT, sans attendre la base de données — sur le plan gratuit,
  // la base peut elle aussi être endormie et mettre du temps à répondre. Si on attendait
  // initDatabase() avant d'écouter, TOUTE requête (même /api/health) resterait bloquée
  // indéfiniment pendant ce réveil. Les comptes/produits se chargent en tâche de fond juste
  // après ; les toutes premières requêtes pendant cette poignée de secondes peuvent échouer
  // proprement (compte "introuvable"), plutôt que de ne jamais recevoir de réponse du tout.
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`SkinDiag running on port ${PORT}`);
  });

  try {
    await initDatabase();
  } catch (err: any) {
    console.error("[DB] Échec du chargement initial:", err.message);
  }
}

startServer();
