export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-1 items-center justify-center bg-zinc-50 px-6 py-16 dark:bg-black">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <span className="text-sm font-medium uppercase tracking-widest text-emerald-600 dark:text-emerald-400">
            easyWallet
          </span>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            Suivi d&apos;investissements en temps réel
          </p>
        </div>
        {children}
      </div>
    </div>
  );
}
