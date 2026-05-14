export function TransactionTypeBadge({ type }: { type: string }) {
  const isSell = type === "SELL";
  return (
    <span
      className={`inline-block rounded-md px-2 py-0.5 text-xs font-medium ${
        isSell
          ? "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300"
          : "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"
      }`}
    >
      {isSell ? "Vente" : "Achat"}
    </span>
  );
}
