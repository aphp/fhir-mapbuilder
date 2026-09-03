import { defineConfig } from '@vscode/test-cli';

export default defineConfig({
	tests: [
		{
			// Suite d'intégration seule (hôte d'extension). Le glob reste au
			// premier niveau de `out/test/` : la couche unitaire hors-hôte
			// (`out/test/unit/**/*.unit.test.js`) tourne sous `npm run test:unit`
			// avec le stub `vscode`, elle ne doit pas être chargée ici.
			files: 'out/test/*.test.js',
			// Répertoire source scanné par `includeAll` ci-dessous.
			srcDir: 'src',
		},
	],
	// Couverture : avec `vscode-test --coverage`, @vscode/test-cli collecte le
	// format V8 pendant le run et c8 le convertit. Le rapport `lcov` atterrit
	// dans ./coverage/lcov.info — c'est ce fichier que le job `test-ts` de
	// ci.yml pousse vers Codecov (flag `ts`). Les sources sont remappées sur
	// `src/**` via les source maps ; le scope fin (dossiers hors couverture)
	// est tenu côté Codecov par `ignore:` dans codecov.yml.
	coverage: {
		reporter: ['text-summary', 'lcov'],
		output: './coverage',
		exclude: ['**/node_modules/**', '**/test/**'],
		// `includeAll` : chaque fichier de `srcDir` (`src`, défini sur l'entrée
		// `tests` ci-dessus) apparaît dans le lcov même s'il n'est chargé par
		// aucun test, avec son vrai dénominateur de lignes (sinon un fichier non
		// chargé compterait comme 100 %). Voir spec #143 / wayfinder #137.
		includeAll: true,
	},
});
