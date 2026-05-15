import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { loadFiscalData } from "@/lib/fiscalite";

// --- Structured report shape -------------------------------------------

const declarationLineSchema = z.object({
  form: z.string(), // e.g. "2042", "2074", "2086", "2042 C"
  box: z.string(), // e.g. "3VG", "2DC", "2TR", "3AN"
  label: z.string(),
  amount: z.number(),
  basis: z.string(), // how this figure was derived
});

const foreignAccountSchema = z.object({
  form: z.string(), // "3916" or "3916-bis"
  institution: z.string(),
  country: z.string(),
  detail: z.string(),
});

const questionSchema = z.object({
  topic: z.string(),
  question: z.string(),
  why: z.string(),
});

const reportSchema = z.object({
  taxYear: z.number(),
  confidence: z.enum(["low", "medium", "high"]),
  summary: z.string(),
  declarationLines: z.array(declarationLineSchema),
  foreignAccounts: z.array(foreignAccountSchema),
  questions: z.array(questionSchema),
  warnings: z.array(z.string()),
  missingDocuments: z.array(z.string()),
});

export type FiscalReport = z.infer<typeof reportSchema>;

export type FiscalAssistantResult =
  | { ok: true; report: FiscalReport }
  | { ok: false; error: string };

// Largest single document we inline into the prompt.
const MAX_DOC_BYTES = 4 * 1024 * 1024;
const MAX_DOCS = 12;

const SYSTEM_PROMPT = `Tu es un assistant de préparation à la déclaration de revenus française, intégré à une application de suivi de portefeuille (actions, ETF, crypto) répartie en wallets (CTO, PEA, crypto, livret).

Ton rôle : à partir des données structurées de l'application ET des documents fournis (relevés bancaires, exports de courtiers, relevés de dividendes…), produire un BROUILLON de déclaration : les montants à reporter, dans quelles cases de quels formulaires, et les questions à poser quand quelque chose manque ou ne se rapproche pas.

Règles fiscales françaises à appliquer (rappel — tu restes prudent et tu signales toute incertitude) :
- CTO (compte-titres ordinaire) : les plus/moins-values de cession sont imposables. Détail sur le formulaire 2074, report du résultat net sur la 2042 (case 3VG pour une plus-value, 3VH pour une moins-value). Les moins-values sont reportables 10 ans.
- Dividendes : case 2DC (montant brut) de la 2042 ; intérêts : case 2TR. Prélèvements sociaux et abattements éventuels relèvent de l'administration.
- PEA : les arbitrages internes (ventes au sein du PEA) ne sont PAS à déclarer. Un PEA de plus de 5 ans est exonéré d'impôt sur le revenu (hors prélèvements sociaux) ; un retrait avant 5 ans rend le gain imposable et clôture le plan — à signaler comme événement à déclarer.
- Crypto : seules les cessions crypto → euros (ou crypto → biens/services) sont imposables. Les conversions crypto ↔ crypto ne sont PAS un fait générateur. Plus-values sur le formulaire 2086, report sur la 2042 C (cases 3AN gain / 3BN perte).
- Comptes à l'étranger : tout compte bancaire ou de courtage détenu à l'étranger doit être déclaré sur le formulaire 3916. Les comptes d'actifs numériques (plateformes crypto étrangères) sur le 3916-bis.

Tu produis un objet JSON structuré. Sois explicite sur la méthode de calcul de chaque ligne (champ "basis"). Quand une donnée manque, qu'une transaction ne se rapproche pas, ou qu'un choix dépend de l'utilisateur (ex. une vente crypto est-elle une sortie en fiat ?), pose une question claire plutôt que de deviner. Indique un niveau de confiance global honnête. Ce brouillon doit être vérifié par l'utilisateur ou un conseiller — ne le présente jamais comme définitif.`;

type AppContext = {
  taxYear: number;
  wallets: {
    name: string;
    type: string;
    currency: string;
    openedAt: string | null;
    taxRateOverride: number | null;
  }[];
  appComputedSales: unknown;
  appComputedIncome: unknown;
  appComputedWithdrawals: unknown;
  carryForwardLosses: unknown;
};

async function gatherAppContext(
  profileId: string,
  taxYear: number,
): Promise<AppContext> {
  const [wallets, fiscalData] = await Promise.all([
    prisma.wallet.findMany({
      where: { profileId },
      select: {
        name: true,
        type: true,
        currency: true,
        openedAt: true,
        taxRate: true,
      },
    }),
    loadFiscalData(profileId),
  ]);

  const inYear = (iso: string) => new Date(iso).getFullYear() === taxYear;

  return {
    taxYear,
    wallets: wallets.map((wallet) => ({
      name: wallet.name,
      type: wallet.type,
      currency: wallet.currency,
      openedAt: wallet.openedAt?.toISOString().slice(0, 10) ?? null,
      taxRateOverride: wallet.taxRate,
    })),
    appComputedSales: fiscalData.sales.filter((s) => inYear(s.executedAt)),
    appComputedIncome: fiscalData.income.filter((i) => inYear(i.receivedAt)),
    appComputedWithdrawals: fiscalData.withdrawals.filter((w) =>
      inYear(w.occurredAt),
    ),
    carryForwardLosses: fiscalData.adjustments,
  };
}

// Builds the document content blocks: PDFs and images inline as native
// blocks, text/CSV inline as text. Returns the blocks plus a note listing
// anything that couldn't be included.
async function gatherDocumentBlocks(
  profileId: string,
  taxYear: number,
): Promise<{ blocks: Anthropic.ContentBlockParam[]; skipped: string[] }> {
  const docs = await prisma.document.findMany({
    where: { profileId, OR: [{ year: taxYear }, { year: null }] },
    orderBy: { createdAt: "desc" },
    take: MAX_DOCS,
    select: {
      name: true,
      mimeType: true,
      size: true,
      category: true,
      year: true,
      content: true,
    },
  });

  const blocks: Anthropic.ContentBlockParam[] = [];
  const skipped: string[] = [];

  for (const doc of docs) {
    if (doc.size > MAX_DOC_BYTES) {
      skipped.push(`${doc.name} (trop volumineux)`);
      continue;
    }
    const label = `${doc.name} — catégorie ${doc.category}${
      doc.year ? `, année ${doc.year}` : ""
    }`;
    const data = Buffer.from(doc.content).toString("base64");

    if (doc.mimeType === "application/pdf") {
      blocks.push({
        type: "text",
        text: `--- Document : ${label} ---`,
      });
      blocks.push({
        type: "document",
        source: {
          type: "base64",
          media_type: "application/pdf",
          data,
        },
      });
    } else if (
      doc.mimeType === "image/png" ||
      doc.mimeType === "image/jpeg"
    ) {
      blocks.push({ type: "text", text: `--- Document : ${label} ---` });
      blocks.push({
        type: "image",
        source: { type: "base64", media_type: doc.mimeType, data },
      });
    } else if (
      doc.mimeType === "text/csv" ||
      doc.mimeType === "text/plain"
    ) {
      const text = Buffer.from(doc.content).toString("utf-8").slice(0, 60000);
      blocks.push({
        type: "text",
        text: `--- Document : ${label} ---\n${text}`,
      });
    } else {
      skipped.push(`${doc.name} (format ${doc.mimeType} non lisible)`);
    }
  }

  return { blocks, skipped };
}

export async function runFiscalAssistant(
  profileId: string,
  taxYear: number,
  userAnswers: string,
): Promise<FiscalAssistantResult> {
  if (!process.env.ANTHROPIC_API_KEY) {
    return {
      ok: false,
      error:
        "Clé API Anthropic non configurée. Ajoutez ANTHROPIC_API_KEY dans les variables d'environnement (Vercel) pour activer l'assistant.",
    };
  }

  const [appContext, documents] = await Promise.all([
    gatherAppContext(profileId, taxYear),
    gatherDocumentBlocks(profileId, taxYear),
  ]);

  const intro =
    `Année fiscale à préparer : ${taxYear}.\n\n` +
    `Données structurées de l'application (déjà converties en euros) :\n` +
    `\`\`\`json\n${JSON.stringify(appContext, null, 2)}\n\`\`\`\n\n` +
    (userAnswers.trim()
      ? `Réponses de l'utilisateur à des questions précédentes :\n${userAnswers.trim()}\n\n`
      : "") +
    (documents.skipped.length > 0
      ? `Documents non analysables : ${documents.skipped.join(", ")}.\n\n`
      : "") +
    (documents.blocks.length > 0
      ? `Documents fournis par l'utilisateur ci-dessous.`
      : `Aucun document n'a été déposé dans le coffre pour cette année — base-toi sur les données de l'application et signale les justificatifs manquants.`);

  const client = new Anthropic();

  try {
    const stream = client.messages.stream({
      model: "claude-opus-4-7",
      max_tokens: 24000,
      thinking: { type: "adaptive" },
      output_config: {
        effort: "high",
        format: zodOutputFormat(reportSchema),
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
          content: [{ type: "text", text: intro }, ...documents.blocks],
        },
      ],
    });

    const message = await stream.finalMessage();
    const textBlock = message.content.find((b) => b.type === "text");
    if (!textBlock || textBlock.type !== "text") {
      return { ok: false, error: "Réponse vide du modèle." };
    }

    const parsed = reportSchema.safeParse(JSON.parse(textBlock.text));
    if (!parsed.success) {
      return {
        ok: false,
        error: "Le rapport renvoyé n'a pas le format attendu.",
      };
    }
    return { ok: true, report: parsed.data };
  } catch (error) {
    if (error instanceof Anthropic.AuthenticationError) {
      return { ok: false, error: "Clé API Anthropic invalide." };
    }
    if (error instanceof Anthropic.RateLimitError) {
      return {
        ok: false,
        error: "Limite de requêtes atteinte — réessayez dans un moment.",
      };
    }
    const message =
      error instanceof Error ? error.message : "Erreur inconnue.";
    return { ok: false, error: `L'analyse a échoué : ${message}` };
  }
}
