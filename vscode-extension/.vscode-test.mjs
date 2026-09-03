import { defineConfig } from '@vscode/test-cli';

export default defineConfig({
	tests: [
		{
			files: 'out/test/**/*.test.js',
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
		// `all` + `src` : chaque fichier de `src/**` apparaît dans le lcov même
		// s'il n'est chargé par aucun test, avec son vrai dénominateur de lignes
		// (sinon un fichier non chargé compterait comme 100 %). Voir spec #143 /
		// wayfinder #137.
		all: true,
		src: ['src'],
	},
});
