# easyWallet

Suivi d'investissements en temps réel — actions, ETF et cryptomonnaies
répartis dans plusieurs wallets (CTO, PEA, crypto…), avec calcul en direct
des plus et moins-values à quatre niveaux : par achat, par asset, par wallet
et sur l'ensemble du patrimoine.

## Fonctionnalités

- **Comptes utilisateurs** — inscription / connexion par email + mot de passe.
- **Wallets** — CTO, PEA, portefeuille crypto, livret… chacun dans sa devise.
- **Transactions** — achats et ventes : asset, date, prix unitaire, montant,
  quantité et frais.
- **Prix en direct** — CoinGecko (crypto), Yahoo Finance (actions/ETF) et
  taux de change Frankfurter, mis en cache et rafraîchis chaque minute.
- **Tableau de bord live** — plus/moins-value latente par achat, par asset,
  par wallet et au global, plus-value réalisée et estimation fiscale.
- **Historique** — courbe d'évolution de la valeur du portefeuille.

## Stack

Next.js 16 (App Router) · TypeScript · Tailwind CSS · Prisma · PostgreSQL ·
TanStack Query · Recharts.

## Développement local

Prérequis : Node.js 22+ et une base PostgreSQL (par exemple un projet
Supabase, ou un PostgreSQL local).

```bash
# 1. Dépendances
npm install

# 2. Variables d'environnement
cp .env.example .env
# puis renseignez DATABASE_URL, DIRECT_URL et AUTH_SECRET dans .env
# (générez le secret : node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")

# 3. Schéma de base de données
npx prisma migrate deploy

# 4. Serveur de développement
npm run dev
```

L'application est disponible sur http://localhost:3000.

## Déploiement (Vercel + Supabase)

1. Créer un projet **Supabase** et récupérer les chaînes de connexion Prisma
   (onglet *Connect → ORMs*).
2. Importer le dépôt dans **Vercel** (le framework Next.js est détecté
   automatiquement ; la commande de build est définie dans `vercel.json`).
3. Dans les variables d'environnement Vercel, renseigner :
   - `DATABASE_URL` — connexion poolée Supabase (port 6543, `?pgbouncer=true`)
   - `DIRECT_URL` — connexion directe Supabase (port 5432)
   - `AUTH_SECRET` — secret aléatoire de 32 octets
   - `COINGECKO_API_KEY` *(optionnel)* — clé démo CoinGecko pour relever la
     limite de requêtes
4. Le build Vercel exécute automatiquement les migrations Prisma
   (`prisma migrate deploy`) avant de compiler l'application.

## Structure

```
src/
  app/
    (auth)/          inscription, connexion
    (app)/           espace authentifié — dashboard, wallets, assets, transactions
    api/             routes API (prix, tableau de bord)
  components/        composants UI
  lib/
    portfolio.ts     moteur de calcul des plus/moins-values (pur, testable)
    prices/          service de prix (CoinGecko, Yahoo, change)
    auth.ts          sessions JWT
prisma/
  schema.prisma      modèle de données
  migrations/        migrations PostgreSQL
```

## Notes

Les estimations fiscales (PFU 30 % en CTO/crypto, 17,2 % en PEA) sont
purement indicatives — la fiscalité réelle dépend de votre situation et de
la durée de détention.
