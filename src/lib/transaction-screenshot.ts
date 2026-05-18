import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";
import {
  ASSET_TYPES,
  SUPPORTED_CURRENCIES,
  TRANSACTION_TYPES,
} from "@/lib/constants";

// Schema returned by the model. Every field is nullable: a screenshot may
// not show all the data, and we'd rather surface partial extractions to
// the user than make the model fabricate numbers.
const extractionSchema = z.object({
  type: z.enum([...TRANSACTION_TYPES, "UNKNOWN"]),
  executedAt: z.string().nullable(), // ISO YYYY-MM-DD (date the trade was executed)
  assetSymbol: z.string().nullable(), // ticker / symbol as it appears
  assetName: z.string().nullable(),
  assetKind: z.enum([...ASSET_TYPES, "UNKNOWN"]),
  quantity: z.number().nullable(),
  unitPrice: z.number().nullable(),
  amountInvested: z.number().nullable(),
  currency: z.enum([...SUPPORTED_CURRENCIES, "UNKNOWN"]),
  fees: z.number().nullable(),
  confidence: z.enum(["low", "medium", "high"]),
  source: z.string().nullable(), // broker / app name if identifiable
  warnings: z.array(z.string()),
});

export type ScreenshotExtraction = z.infer<typeof extractionSchema>;

export type ExtractionResult =
  | { ok: true; data: ScreenshotExtraction }
  | { ok: false; error: string };

const SYSTEM_PROMPT = `Tu es un assistant d'extraction de transactions financières à partir de captures d'écran (broker, app crypto, relevé bancaire, mail de confirmation…).

À partir de l'image fournie, identifie UNE transaction d'achat ou de vente d'un titre (action, ETF) ou d'une crypto, et renvoie ses champs au format JSON structuré.

Règles strictes :
- Ne devine jamais : si une information n'est pas visible ou est ambiguë, mets le champ à null (ou "UNKNOWN" pour les enums) et ajoute une note dans "warnings".
- "executedAt" : la date d'exécution de la transaction au format ISO YYYY-MM-DD. Si seule une date partielle est visible (mois/jour sans année), mets null.
- "type" : "BUY" pour un achat, "SELL" pour une vente ; "UNKNOWN" si non identifiable.
- "assetSymbol" : ticker court (AAPL, BTC, CW8…). En majuscules.
- "assetName" : nom lisible (Apple Inc., Bitcoin, Amundi MSCI World…).
- "assetKind" : "STOCK" / "ETF" / "CRYPTO" / "UNKNOWN".
- "quantity" : nombre d'unités achetées/vendues (peut être décimal, surtout en crypto).
- "unitPrice" : prix unitaire, dans la devise de cotation visible.
- "amountInvested" : montant total (qté × prix), hors frais, dans la devise du compte. Si plusieurs montants apparaissent (avant/après frais), prends le sous-total avant frais.
- "currency" : devise du montant — "EUR" / "USD" / "GBP" / "CHF" ; "UNKNOWN" si autre.
- "fees" : frais de transaction si explicitement visibles (sinon 0).
- "confidence" : "high" si tout est lisible et cohérent, "medium" en cas de doute mineur, "low" si la capture est ambiguë ou s'il manque des champs clés.
- "source" : nom du broker/app si identifiable (Binance, Trade Republic, Boursorama, Crypto.com, Bitstack…).
- "warnings" : courte liste de points incertains ou de champs manquants, en français.

Si l'image ne montre clairement aucune transaction, renvoie tous les champs à null/UNKNOWN, confidence="low", et un warning explicite.`;

export async function extractTransactionFromScreenshot(
  imageBase64: string,
  mimeType: "image/png" | "image/jpeg" | "image/webp" | "image/gif",
): Promise<ExtractionResult> {
  if (!process.env.ANTHROPIC_API_KEY) {
    return {
      ok: false,
      error:
        "Clé API Anthropic non configurée. Ajoutez ANTHROPIC_API_KEY dans les variables d'environnement pour activer l'import par capture.",
    };
  }

  const client = new Anthropic();

  try {
    const stream = client.messages.stream({
      model: "claude-sonnet-4-6",
      max_tokens: 2000,
      output_config: {
        format: zodOutputFormat(extractionSchema),
      },
      system: [
        {
          type: "text",
          text: SYSTEM_PROMPT,
          cache_control: { type: "ephemeral" },
        },
      ],
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: {
                type: "base64",
                media_type: mimeType,
                data: imageBase64,
              },
            },
            {
              type: "text",
              text: "Extrais la transaction visible sur cette capture, en suivant les règles du système.",
            },
          ],
        },
      ],
    });

    const message = await stream.finalMessage();
    const textBlock = message.content.find((block) => block.type === "text");
    if (!textBlock || textBlock.type !== "text") {
      return { ok: false, error: "Réponse vide du modèle." };
    }

    const parsed = extractionSchema.safeParse(JSON.parse(textBlock.text));
    if (!parsed.success) {
      return {
        ok: false,
        error: "Le format renvoyé par le modèle est invalide.",
      };
    }
    return { ok: true, data: parsed.data };
  } catch (error) {
    if (error instanceof Anthropic.AuthenticationError) {
      return { ok: false, error: "Clé API Anthropic invalide." };
    }
    if (error instanceof Anthropic.RateLimitError) {
      return {
        ok: false,
        error: "Limite de requêtes atteinte — réessayez dans un instant.",
      };
    }
    const reason = error instanceof Error ? error.message : "Erreur inconnue.";
    return { ok: false, error: `L'analyse a échoué : ${reason}` };
  }
}
