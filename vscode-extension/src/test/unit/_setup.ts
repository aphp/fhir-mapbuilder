/**
 * Mocha `--require` hook for the out-of-host unit layer (spec #143).
 *
 * Patches `Module._load` so `require("vscode")` resolves to the hand-written
 * stub in `./vscode.mock` when the suites run in plain Node — the same
 * interception `@vscode/test-electron` performs internally. Zero dependencies.
 *
 * If a future suite needs per-test control that a global patch makes awkward,
 * the fallback on record (spec #143) is the `proxyquire` devDependency.
 */
import Module from "module";
import * as vscodeMock from "./vscode.mock";

type ModuleLoad = (request: string, parent: unknown, isMain: boolean) => unknown;

const moduleRef = Module as unknown as { _load: ModuleLoad };
const originalLoad = moduleRef._load;

moduleRef._load = function patchedLoad(request, parent, isMain) {
    if (request === "vscode") {
        return vscodeMock;
    }
    return originalLoad.call(this, request, parent, isMain);
};
