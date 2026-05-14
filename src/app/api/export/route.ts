import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth-server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

function csvField(value: string | number): string {
  return `"${String(value).replace(/"/g, '""')}"`;
}

// Full data export: a JSON backup of everything, or a flat CSV of the
// transactions. Both download as a file via Content-Disposition.
export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  const format =
    request.nextUrl.searchParams.get("format") === "csv" ? "csv" : "json";

  const [wallets, assets, transactions, taxAdjustments] = await Promise.all([
    prisma.wallet.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "asc" },
    }),
    prisma.asset.findMany({
      where: { userId: user.id },
      orderBy: { name: "asc" },
    }),
    prisma.transaction.findMany({
      where: { wallet: { userId: user.id } },
      orderBy: { executedAt: "asc" },
      include: {
        wallet: { select: { name: true, currency: true } },
        asset: { select: { name: true, symbol: true, quoteCurrency: true } },
      },
    }),
    prisma.taxAdjustment.findMany({
      where: { userId: user.id },
      orderBy: { year: "asc" },
    }),
  ]);

  const stamp = new Date().toISOString().slice(0, 10);

  if (format === "csv") {
    const header = [
      "Date",
      "Type",
      "Wallet",
      "Asset",
      "Symbole",
      "Quantité",
      "Prix unitaire",
      "Devise cotation",
      "Montant",
      "Devise wallet",
      "Frais",
      "Note",
    ];
    const rows = transactions.map((tx) => [
      tx.executedAt.toISOString().slice(0, 10),
      tx.type,
      tx.wallet.name,
      tx.asset.name,
      tx.asset.symbol,
      tx.quantity.toString(),
      tx.unitPrice.toString(),
      tx.asset.quoteCurrency,
      tx.amountInvested.toString(),
      tx.wallet.currency,
      tx.fees.toString(),
      tx.notes ?? "",
    ]);
    const csv = [header, ...rows]
      .map((row) => row.map(csvField).join(","))
      .join("\n");

    return new NextResponse(csv, {
      headers: {
        "content-type": "text/csv; charset=utf-8",
        "content-disposition": `attachment; filename="easywallet-transactions-${stamp}.csv"`,
      },
    });
  }

  const backup = {
    exportedAt: new Date().toISOString(),
    wallets: wallets.map((wallet) => ({
      name: wallet.name,
      type: wallet.type,
      currency: wallet.currency,
      taxRate: wallet.taxRate,
      openedAt: wallet.openedAt,
    })),
    assets: assets.map((asset) => ({
      name: asset.name,
      symbol: asset.symbol,
      type: asset.type,
      quoteCurrency: asset.quoteCurrency,
      coingeckoId: asset.coingeckoId,
      yahooSymbol: asset.yahooSymbol,
    })),
    transactions: transactions.map((tx) => ({
      executedAt: tx.executedAt.toISOString(),
      type: tx.type,
      wallet: tx.wallet.name,
      asset: tx.asset.name,
      symbol: tx.asset.symbol,
      quantity: tx.quantity.toNumber(),
      unitPrice: tx.unitPrice.toNumber(),
      amountInvested: tx.amountInvested.toNumber(),
      fees: tx.fees.toNumber(),
      taxExempt: tx.taxExempt,
      notes: tx.notes,
    })),
    taxAdjustments: taxAdjustments.map((adjustment) => ({
      year: adjustment.year,
      carryForwardLoss: adjustment.carryForwardLoss.toNumber(),
    })),
  };

  return new NextResponse(JSON.stringify(backup, null, 2), {
    headers: {
      "content-type": "application/json; charset=utf-8",
      "content-disposition": `attachment; filename="easywallet-backup-${stamp}.json"`,
    },
  });
}
