/**
 * Unit suite for `src/ApiToken.ts` (issue #198) — out-of-host, `vscode` stubbed by `_setup.ts`.
 */
import * as assert from "assert";
import * as sinon from "sinon";
import type { SecretStorage } from "vscode";
import { loadOrCreateApiToken } from "../../ApiToken";
import { standardTeardown } from "./_helpers";

function fakeSecrets(initial?: string): { secrets: SecretStorage; store: sinon.SinonStub } {
    const values = new Map<string, string>();
    const store = sinon.stub().callsFake(async (key: string, value: string) => {
        values.set(key, value);
    });
    if (initial !== undefined) {
        values.set("fhirMapBuilder.apiToken", initial);
    }
    const secrets = {
        get: async (key: string) => values.get(key),
        store,
    } as unknown as SecretStorage;
    return { secrets, store };
}

suite("ApiToken", () => {
    teardown(standardTeardown);

    test("creates a 256-bit hex token on first use and stores it", async () => {
        const { secrets, store } = fakeSecrets();

        const token = await loadOrCreateApiToken(secrets);

        assert.match(token, /^[0-9a-f]{64}$/);
        assert.strictEqual(store.calledOnceWith("fhirMapBuilder.apiToken", token), true);
    });

    test("returns the stored token, without writing, so every window shares it", async () => {
        const { secrets, store } = fakeSecrets("already-there");

        assert.strictEqual(await loadOrCreateApiToken(secrets), "already-there");
        assert.strictEqual(store.called, false);
    });

    test("generates a different token for a different user", async () => {
        const first = await loadOrCreateApiToken(fakeSecrets().secrets);
        const second = await loadOrCreateApiToken(fakeSecrets().secrets);

        assert.notStrictEqual(first, second);
    });
});
