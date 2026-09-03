# Inventaire des signaux qualité gratuits (Codecov + GitHub + CI)

Recherche pour l'issue [#159](https://github.com/aphp/fhir-mapbuilder/issues/159),
carte wayfinder [#155](https://github.com/aphp/fhir-mapbuilder/issues/155)
« Pilotage de la qualité du code ». Alimente le ticket
[#160](https://github.com/aphp/fhir-mapbuilder/issues/160) (tableau de bord).

**Question.** Sans nouveau SaaS (SonarCloud / Codacy hors périmètre — levier D
écarté à la Q2 du charting), quels signaux qualité ce dépôt peut-il obtenir
**gratuitement**, depuis quelle source, à quel coût d'extraction et à quelle
fraîcheur, pour un tableau de bord de tendance ?

**Ce document est un inventaire, pas une décision.** Il ne tranche pas le
sous-ensemble de métriques ni le support du tableau de bord — c'est le travail de
#160.

## Résumé exécutif

- **Le plus rentable, quasi gratuit à extraire :** (1) tendance de couverture par
  flag `ts` / `java` via l'API Codecov v2 ; (2) taux d'échec CI par workflow +
  durée des jobs via l'API GitHub Actions ; (3) compteur de warnings ESLint,
  déjà produit à chaque run CI, à agréger ; (4) churn par fichier via `git log`,
  purement local.
- **Coût de mise en place unique :** un jeton d'API Codecov (personnel, gratuit)
  en secret de dépôt — l'upload OIDC sans token **ne donne aucun accès en
  lecture** à l'API.
- **Angles morts sans nouvel outillage :** cycle-time / âge des PR et bugs
  échappés ne sont pas des endpoints prêts à l'emploi — il faut les calculer
  depuis l'API `pulls` / `issues`. La détection de tests flaky fiable demande un
  upload JUnit (Codecov Test Analytics, gratuit) qui n'existe pas aujourd'hui.
- **Complexité sans outil lourd :** règles `complexity` / `max-*` du cœur
  d'ESLint (aucune dépendance nouvelle) côté TS ; côté Java, compteur SpotBugs
  déjà là, PMD possible en rapport non bloquant (plugin Maven gratuit).

## Tableau : signal → source → coût d'extraction → fraîcheur → actionnable

Coût d'extraction : **Faible** = un appel API ou une commande ; **Moyen** =
script d'agrégation à écrire (pagination, calcul de deltas) ; **Élevé** = nouvel
outillage / nouvelle étape CI à ajouter.

### Couverture (Codecov)

| Signal | Source | Coût | Fraîcheur | Actionnable ? |
|---|---|---|---|---|
| Tendance couverture par **flag** `ts` / `java` (min/max/avg par intervalle 1d / 7d / 30d) | Codecov API v2 `GET /api/v2/github/aphp/repos/fhir-mapbuilder/flags/{flag}/coverage/?interval=7d&branch=main` | Faible | Par commit, ~minutes après le run CI ; l'API agrège en buckets 1d/7d/30d | Oui — c'est la métrique de tendance centrale, une par stack |
| Tendance couverture **dépôt** (globale, tous flags) | Codecov API v2 `GET /api/v2/github/aphp/repos/fhir-mapbuilder/coverage/?interval=7d` | Faible | idem | Moyen — mélange TS + Java, moins parlant que par flag |
| Couverture **par composant** `ts` / `java` à l'instant T | Codecov API v2 `GET .../repos/fhir-mapbuilder/totals/?component_id=ts` (et `flag=`) | Faible | Snapshot du dernier commit de la branche | Oui — mais **pas de tendance** : aucun endpoint timeseries par composant (cf. notes). Ici flag ≈ composant, donc la tendance par flag couvre le besoin |
| Historique couverture reconstruit commit par commit | Codecov API v2 `GET .../repos/fhir-mapbuilder/commits/?branch=main` — chaque commit porte `totals.coverage` + `ci_passed` | Moyen | Par commit | Oui — série fine si les buckets 1d/7d/30d ne suffisent pas ; nécessite pagination |
| Comparaison de couverture par composant sur une PR | Codecov API v2 `GET .../repos/fhir-mapbuilder/compare/components?pullid=N` | Faible | Par PR | Moyen — utile pour un rapport par PR, pas pour une tendance |
| Delta de couverture sur le code neuf (`patch`) | Statut de commit `codecov/patch` (API GitHub `GET /repos/.../commits/{sha}/status`) ; déjà bloquant à 80 % | Faible | Par PR | Déjà une barrière (ADR 0002) — à afficher, pas à re-décider |

### Flux GitHub (PR / CI / issues)

| Signal | Source | Coût | Fraîcheur | Actionnable ? |
|---|---|---|---|---|
| **Taux d'échec CI par workflow** (`ci.yml`, `commit-policy.yml`, `audit.yml`, `release.yml`) | GitHub REST `GET /repos/aphp/fhir-mapbuilder/actions/workflows/{id}/runs` → champs `conclusion`, `created_at`, `run_started_at`, `run_attempt` | Faible (1 appel paginé / workflow) + agrégation Moyenne | Temps réel | Oui — signal de santé CI et de bruit ; `run_attempt > 1` = re-run manuel |
| **Durée des jobs** (`lint-ts`, `test-ts`, `test-java`, `build`…) | GitHub REST `GET /repos/.../actions/runs/{run_id}/jobs` → `started_at` / `completed_at` par job et par step | Faible + agrégation Moyenne | Temps réel | Oui — repère les jobs qui dérivent (ex. smoke-test du jar ~40 s local / 120 s CI) |
| Temps facturé par run / OS | GitHub REST `GET /repos/.../actions/runs/{run_id}/timing` | Faible | Temps réel | Faible — endpoint en cours de fermeture par GitHub ; préférer le calcul via `jobs` |
| **Fréquence de merge** (PR mergées / semaine) | GitHub REST `GET /repos/.../pulls?state=closed&base=main` → `merged_at` non nul | Faible + agrégation Moyenne | Temps réel | Oui — cadence de livraison, mainteneur solo |
| **Cycle-time de PR** (création → merge) | idem : `merged_at - created_at` | Moyen (calcul) | Temps réel | Oui — mais dépôt solo à faible volume : bruité, à lisser sur 30–90 j |
| **Âge des PR ouvertes** | GitHub REST `GET /repos/.../pulls?state=open` → `now - created_at` | Faible | Temps réel | Oui — repère les PR qui stagnent (Dependabot inclus) |
| **Issues `bug` ouvertes / fermées + temps de résolution** | GitHub REST `GET /repos/.../issues?labels=bug&state=all` → `created_at`, `closed_at` | Faible + agrégation Moyenne | Temps réel | Oui — proxy « bugs échappés » ; suppose une discipline de label `bug` (à instaurer) |
| Débit d'issues global, cycle-time, backlog | Onglet **Insights** (Pulse, graphes) | — | UI hebdo | **Non extractible** — les graphes Insights (cycle-time PR, débit) n'ont pas d'API REST/GraphQL ; seules les données brutes (`pulls`, `issues`, `events`) le sont, il faut recalculer |
| Fréquence de commits, additions/suppressions hebdo | GitHub REST `GET /repos/.../stats/commit_activity`, `/stats/code_frequency`, `/stats/participation` | Faible | Cache par SHA du défaut ; **202 puis 200** au premier appel ; buckets **hebdo**, hors merges | Moyen — churn agrégé du dépôt, pas par fichier |

### Sorties CI existantes (à agréger)

| Signal | Source | Coût | Fraîcheur | Actionnable ? |
|---|---|---|---|---|
| **Compteur de warnings ESLint** | `eslint.config.js` met toutes les règles projet en `warn` ; `ci.yml` lance `npx eslint src` **sans `--max-warnings`** → les warnings passent. Extraction : `npx eslint src -f json` puis somme des `warningCount` | Faible (local) / Moyen (étape CI qui écrit un artefact ou un résumé) | À la demande, ou par run si étape CI ajoutée | Oui — c'est le signal du **burn-down ESLint** attendu par la carte #155 ; règles `warn` connues : `prefer-const` (~45 occ. auto-fixables), `@typescript-eslint/no-explicit-any`, `no-unused-vars`, `no-unused-expressions`, `curly`, `eqeqeq`, `no-throw-literal`, `naming-convention` |
| **Compteur de findings SpotBugs** | `pom.xml` : `spotbugs-maven-plugin` effort Max / seuil Medium, `spotbugs:check` lié à `verify` (**bloquant**). `mvn spotbugs:spotbugs` produit `target/spotbugsXml.xml` sans échouer ; compter les `<BugInstance>` | Faible (local) / Moyen (étape CI) | À la demande / par run | Faible en tendance — `check` étant bloquant, le compte sur `main` vert est structurellement ~0 ; utile seulement comme garde « toujours 0 » ou si on desserre le seuil |
| **Signaux de tests flaky** | Aucun `retries` configuré : `.vscode-test.mjs` n'en définit pas, pas de `.mocharc`. Signaux disponibles aujourd'hui : `run_attempt > 1` sur les runs (re-run manuel), et divergence de `conclusion` `test-ts` vs `test-java` d'un run à l'autre à SHA égal | Moyen (corrélation) | Temps réel | Faible — proxy grossier ; la carte #155 note que la politique flaky est un sous-point non mûr de T6 |
| Détection flaky fiable | Codecov **Test Analytics** — upload d'un rapport JUnit XML (`repos/.../test-results/` + `GET /api/v2/.../test-results/`), gratuit, marque les tests flaky | Élevé — nouvelle étape CI (générer + uploader le JUnit pour `test-ts` et `test-java`) | Par run une fois en place | Oui, à terme — hors périmètre de cet inventaire, à noter pour #160 / T6 |
| Durée `test-ts` vs `test-java` (déséquilibre de suite) | dérivé de « Durée des jobs » ci-dessus | Faible | Temps réel | Moyen — informe le découpage des suites |

### git (local, zéro SaaS)

| Signal | Source | Coût | Fraîcheur | Actionnable ? |
|---|---|---|---|---|
| **Churn par fichier** (nb de commits touchant un fichier ; lignes ±) | `git log --no-merges --numstat --pretty=format: -- <path>` puis agrégation ; ou `git log --pretty=format: --name-only \| sort \| uniq -c \| sort -rn` | Faible / Moyen (script) | À la demande, temps réel | Oui — révèle les fichiers instables ; borner la fenêtre (ex. 90–180 j) |
| **Hotspots = churn × complexité** | croiser le churn ci-dessus avec la complexité par fichier (règle ESLint `complexity` en sortie JSON côté TS ; rapport PMD côté Java) | Moyen — un script de jointure | À la demande | Oui — cible le refactoring ; classique « hotspot map » sans outil dédié |
| Âge du code / bus factor par fichier | `git log --format='%an' -- <path>`, `git blame` | Faible | Temps réel | Faible pour un mainteneur solo |

### Complexité sans outil lourd

| Signal | Source | Coût | Fraîcheur | Actionnable ? |
|---|---|---|---|---|
| Complexité cyclomatique TS, profondeur, longueur de fonction/fichier, nb de params | Règles **du cœur d'ESLint** : `complexity`, `max-depth`, `max-lines`, `max-lines-per-function`, `max-params`, `max-nested-callbacks` — **aucune dépendance nouvelle** (ESLint + `typescript-eslint` déjà présents). En `warn` (rapport only) ou local via `-f json` | Faible — ajouter les règles en `warn` dans `eslint.config.js` | Par run (si en `warn`) ou à la demande | Oui — donne un compteur de fonctions au-dessus d'un seuil, à faire décroître |
| `eslint-plugin-sonarjs` (complexité cognitive, code dupliqué) | **Absent** de `vscode-extension/package.json` — serait une **nouvelle dépendance de dev** (gratuite, MIT). Peut tourner en local uniquement sans l'ajouter au lint CI | Moyen — nouvelle devDependency + config | — | Optionnel — à arbitrer en #160 ; le cœur d'ESLint couvre déjà l'essentiel |
| Complexité / métriques Java | `maven-pmd-plugin` (gratuit) en **rapport** (`pmd:pmd`, `pmd:check` non lié) → `target/pmd.xml`, règles `CyclomaticComplexity`, `NcssCount`, `CognitiveComplexity` | Élevé — nouveau plugin Maven + fichier de règles | Par run une fois en place | Oui — seul moyen simple d'avoir la complexité Java chiffrée ; SpotBugs ne la donne pas |
| Findings SpotBugs par catégorie (already-on) | `target/spotbugsXml.xml` (cf. plus haut) | Faible | Par run | Faible en tendance (bloquant → ~0) |

## Notes sur les 3–4 signaux « cheap » les plus rentables

### 1. Tendance de couverture par flag `ts` / `java` — API Codecov v2

- **Endpoint :** `GET https://api.codecov.io/api/v2/github/aphp/repos/fhir-mapbuilder/flags/{ts|java}/coverage/?interval=7d&branch=main`.
  Réponse paginée de mesures `{ timestamp, min, max, avg }` agrégées par
  `interval` (`1d`, `7d`, `30d`). Si aucune mesure à `start_date`, l'API renvoie
  une mesure plus ancienne pour permettre le report (carryforward) — cohérent
  avec `carryforward: true` sur les deux flags dans `codecov.yml`.
- **Endpoints voisins utiles :** `/flags/` (liste des flags),
  `/coverage/` (tendance dépôt, sans `component_id`), `/totals/?component_id=&flag=`
  (snapshot), `/commits/` (chaque commit porte `totals.coverage` → reconstruction
  d'historique fin), `/compare/components?pullid=` (delta par composant sur PR).
- **Auth — point d'attention :** l'API v2 exige un **jeton d'API Codecov**
  (`Authorization: bearer <token>`), créé dans Codecov → avatar → Settings →
  Access → *Generate Token*. Le dépôt publie aujourd'hui en **OIDC sans token**
  (`use_oidc: true` dans `ci.yml`) : c'est de l'**upload uniquement**, ça ne
  confère **aucun** droit de lecture. Il faut donc un secret de dépôt
  supplémentaire (`CODECOV_API_TOKEN`), gratuit, mais c'est le seul coût de
  mise en place non nul de tout cet inventaire.
- **Pas de timeseries par composant :** il n'existe pas d'endpoint de tendance
  par `component_id` ; la tendance par composant n'est visible que dans l'UI
  Codecov. Ici ce n'est pas gênant : le flag `ts` recouvre le composant `ts`
  (`vscode-extension/src/**`) et `java` le composant `java`, donc la tendance
  par flag répond au besoin « par stack ».
- **Fraîcheur :** une mesure par upload, soit à chaque PR et à chaque push
  `main`, disponible quelques minutes après le run CI.
- **Actionnable :** c'est la métrique de tendance de référence de la carte #155,
  déjà tenue > 80 % en absolu (`project` bloquant, ADR 0002) — le tableau de
  bord montre la marge et la pente, pas une nouvelle barrière.

### 2. Santé CI : taux d'échec par workflow + durée des jobs — API GitHub Actions

- **Runs :** `GET /repos/aphp/fhir-mapbuilder/actions/workflows/{workflow_file}/runs?branch=main&per_page=100`
  → `conclusion` (`success` / `failure` / `cancelled`), `created_at`,
  `run_started_at`, `updated_at`, `run_attempt`. Taux d'échec = ratio de
  `conclusion == failure` sur une fenêtre ; `run_attempt > 1` isole les re-runs
  manuels (proxy flaky de premier ordre).
- **Durées :** `GET /repos/.../actions/runs/{run_id}/jobs` → `started_at` /
  `completed_at` par job **et par step**. Permet de suivre `lint-ts`, `typecheck`,
  `test-ts` (avec `xvfb`), `test-java` (`mvn verify`), `build` (package `.vsix` +
  smoke-test du jar). L'endpoint `/timing` (temps facturé/OS) est en cours de
  fermeture par GitHub — ne pas s'appuyer dessus.
- **Coût :** un appel paginé par workflow + un script d'agrégation (ratios,
  moyennes glissantes). Aucune permission au-delà de la lecture ; faisable avec
  le `GITHUB_TOKEN` d'un job planifié ou `gh` en local.
- **Fraîcheur :** temps réel.
- **Actionnable :** un pic de `failure` ou de `run_attempt` sur `ci.yml` = bruit
  à investiguer ; une durée de job qui dérive = candidat à optimisation ou à
  découpage de suite (`test-ts` vs `test-java`).

### 3. Compteur de warnings ESLint — sortie CI déjà produite

- **État actuel :** `eslint.config.js` met **toutes** les règles projet en
  `warn` (choix de migration : `no-explicit-any`, `prefer-const`,
  `no-unused-vars`, `curly`, `eqeqeq`, `no-throw-literal`,
  `no-unused-expressions`, `naming-convention`). `ci.yml` exécute
  `npx eslint src` **sans `--max-warnings 0`** → les warnings n'échouent pas le
  build et ne sont donc suivis par personne.
- **Extraction :** `npx eslint src -f json` puis somme des `warningCount` (par
  règle et global). Coût faible en local ; coût moyen si on ajoute une étape CI
  qui publie le compte dans un artefact / un `$GITHUB_STEP_SUMMARY` / un JSON
  versionné.
- **Fraîcheur :** aussi fraîche que la dernière exécution — par run si étape CI,
  sinon à la demande.
- **Actionnable :** oui — c'est le **burn-down ESLint** nommé dans la carte
  #155 ; `prefer-const` (~45 occurrences, auto-fixables via `npm run lint:fix`)
  est un gain rapide. Le même mécanisme s'applique au compteur SpotBugs mais,
  `spotbugs:check` étant bloquant, sa valeur sur `main` vert est ~0 — utile
  seulement comme invariant.

### 4. Churn par fichier et hotspots — git, purement local

- **Churn :** `git log --no-merges --since=<date> --pretty=format: --name-only | sort | uniq -c | sort -rn`
  (fréquence de modification), ou `--numstat` pour les lignes ±. Zéro
  dépendance, zéro API, exécutable en local ou dans un job planifié.
- **Hotspots (churn × complexité) :** joindre le churn ci-dessus à la complexité
  par fichier — règle `complexity` du cœur d'ESLint en sortie JSON côté TS
  (aucune dépendance nouvelle : ESLint + `typescript-eslint` sont déjà là),
  rapport `maven-pmd-plugin` côté Java (plugin gratuit à ajouter si on veut le
  chiffre Java). Un fichier à fort churn **et** forte complexité est la cible de
  refactoring prioritaire.
- **Fraîcheur :** temps réel, bornée par la fenêtre choisie (90–180 j
  recommandé pour un dépôt jeune).
- **Actionnable :** oui — désigne où porter l'effort ; peu bruité même à faible
  volume de commits car cumulatif.

## Angles morts et coûts cachés

- **Insights GitHub (cycle-time, débit, Pulse) :** les *graphes* n'ont pas
  d'API ; seules les données sources (`pulls`, `issues`, `events`) sont
  exposées, tout indicateur de flux doit être recalculé.
- **Jeton d'API Codecov :** seul secret de dépôt à créer ; l'OIDC sans token
  actuel ne lit pas l'API.
- **Label `bug` :** le signal « bugs échappés » suppose une discipline de
  labellisation qui n'est pas encore établie (à décider en #160 / T1).
- **Tests flaky :** pas de `retries` configuré et pas d'upload JUnit — la
  détection fiable (Codecov Test Analytics, gratuit) demande une nouvelle étape
  CI ; aujourd'hui on n'a que `run_attempt > 1`.
- **Compteurs SpotBugs / SpotBugs `check` bloquant :** tendance plate à 0 sur
  `main` vert — ne pas en attendre une courbe.
- **Endpoints GitHub `/stats/*` :** réponse `202` au premier appel (calcul
  asynchrone), buckets hebdomadaires, merges exclus, cache invalidé à chaque
  push sur le défaut.
- **Volume du dépôt :** mainteneur solo, faible débit de PR — cycle-time et
  fréquence de merge sont statistiquement bruités ; à lisser sur 30–90 jours.

## Sources primaires consultées

### Dépôt (à la révision `origin/main`, commit `8623224`)

- `.github/workflows/ci.yml` — jobs `lint-ts` (`npx eslint src`, sans
  `--max-warnings`), `lint-java` (`mvn compile spotless:check spotbugs:check`),
  `typecheck`, `test-ts` (deux uploads Codecov flag `ts` via `use_oidc: true`),
  `test-java` (upload flag `java`), `build`.
- `.github/workflows/audit.yml`, `release.yml`, `commit-policy.yml` — autres
  workflows suivis pour le taux d'échec / la durée.
- `codecov.yml` — flags `ts` / `java` (`carryforward: true`), composants `ts`
  (`vscode-extension/src/**`) et `java` (`fhir-mapbuilder-validation/**`),
  statuts `project` 80 % (bloquants) + `patch` 80 %.
- `vscode-extension/eslint.config.js` — règles projet toutes en `warn`.
- `vscode-extension/package.json` — `eslint`, `typescript-eslint`, `c8`,
  `mocha`, `sinon`, `@vscode/test-cli` ; **pas** de `eslint-plugin-sonarjs`.
- `vscode-extension/.vscode-test.mjs` — couverture V8 → `coverage/lcov.info` ;
  aucun `retries`.
- `fhir-mapbuilder-validation/pom.xml` — `spotbugs-maven-plugin` (effort Max /
  seuil Medium, `check` lié à `verify`), `jacoco-maven-plugin` (`report` en
  phase `test` → `jacoco.xml`), `spotless` ; **pas** de `maven-pmd-plugin`.
- `fhir-mapbuilder-validation/spotbugs-exclude.xml` — filtre de faux positifs.
- `docs/adr/0002-chaine-ci-cd.md` — chaîne CI, barrière de couverture, upload
  OIDC sans token, amendement 2026-09-03 (composant `ts` bloquant).

### Documentation Codecov (docs.codecov.com)

- [Coverage trend — repo](https://docs.codecov.com/reference/repos_coverage_list)
  (`GET /api/v2/{service}/{owner}/repos/{repo}/coverage/`, `interval` 1d/7d/30d,
  `{timestamp, min, max, avg}`, pas de `component_id`).
- [Coverage trend — flag](https://docs.codecov.com/reference/repos_flags_coverage_list)
  (`.../flags/{flag_name}/coverage/`, mêmes paramètres, carryforward).
- [Flag list](https://docs.codecov.com/reference/repos_flags_list).
- [Component list](https://docs.codecov.com/reference/repos_components_list).
- [Commit coverage totals](https://docs.codecov.com/reference/repos_totals_retrieve)
  (snapshot, filtres `flag` et `component_id`).
- [Commit list](https://docs.codecov.com/reference/repos_commits_list)
  (chaque commit porte un `CommitTotals` + `ci_passed`).
- [Component comparison](https://docs.codecov.com/reference/repos_compare_components_retrieve).
- [Getting Started with the Codecov API v2](https://about.codecov.io/blog/getting-started-with-the-codecov-api-v2/)
  et [Codecov Tokens](https://docs.codecov.com/docs/codecov-tokens) /
  [Authorization](https://docs.codecov.com/v4.6/reference/authorization)
  (`Authorization: bearer <token>`, jeton généré dans Settings → Access).

### Documentation GitHub (docs.github.com)

- [REST — Workflow runs](https://docs.github.com/en/rest/actions/workflow-runs)
  (`conclusion`, `status`, `created_at`, `run_started_at`, `updated_at`,
  `run_attempt` ; endpoint `/timing` en fin de vie).
- [REST — Workflow jobs](https://docs.github.com/en/rest/actions/workflow-jobs)
  (`started_at` / `completed_at` par job et par step).
- [REST — Pull requests](https://docs.github.com/en/rest/pulls/pulls)
  (`created_at`, `merged_at`, `closed_at`).
- [REST — Issues](https://docs.github.com/en/rest/issues/issues)
  (filtre `labels`, `state`, `created_at`, `closed_at`).
- [REST — Repository statistics](https://docs.github.com/en/rest/metrics/statistics)
  (`code_frequency`, `commit_activity`, `participation` ; `202` puis `200`,
  buckets hebdo, merges exclus).
- [git-log](https://git-scm.com/docs/git-log) (`--numstat`, `--name-only`,
  `--no-merges`, `--since`).
- Règles cœur ESLint [`complexity`](https://eslint.org/docs/latest/rules/complexity),
  [`max-lines-per-function`](https://eslint.org/docs/latest/rules/max-lines-per-function),
  [`max-depth`](https://eslint.org/docs/latest/rules/max-depth),
  [`max-params`](https://eslint.org/docs/latest/rules/max-params).
