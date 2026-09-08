import express from "express";
import cors from "cors";
import pg from "pg";
import path from "path";
import { GoogleGenAI, Type } from "@google/genai";
import rateLimit from "express-rate-limit";

const app = express();
const PORT = Number(process.env.PORT) || 3000;

app.set("trust proxy", 1);

const pool = process.env.DATABASE_URL
  ? new pg.Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false }, max: 5 })
  : null;

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
  `);
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

app.post("/api/skindiag/analyze", analyzeLimiter, async (req, res) => {
  try {
    const { zone, image, mimeType } = req.body;
    if (!image || !mimeType) {
      return res.status(400).json({ success: false, message: "Photo requise pour l'analyse." });
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
