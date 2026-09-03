/**
 * Smoke test for the out-of-host unit layer (spec #143, ticket #144).
 *
 * Proves the chain works end to end: the `Module._load` hook injects the
 * `vscode` stub, a real `src/**` module imports and runs, and c8 attributes the
 * coverage. Real per-file suites land in the sibling tickets (#145–#149); this
 * file can be dropped once they exist.
 */
import * as assert from "assert";
import { isEmptyOrBlank } from "../../utils";
import { resetVscodeMock, window } from "./vscode.mock";

suite("unit layer smoke", () => {
    teardown(() => resetVscodeMock());

    test('require("vscode") is redirected to the stub', () => {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const vscode = require("vscode");
        assert.strictEqual(vscode.window, window);
        assert.strictEqual(typeof vscode.workspace.getConfiguration, "function");
    });

    test("a real src module (utils.isEmptyOrBlank) runs under the stub", () => {
        assert.strictEqual(isEmptyOrBlank(""), true);
        assert.strictEqual(isEmptyOrBlank("   "), true);
        assert.strictEqual(isEmptyOrBlank("x"), false);
    });
});
