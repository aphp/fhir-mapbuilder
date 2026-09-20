/**
 * Unit suite for the API token wiring in `src/extension.ts` (issue #198) —
 * out-of-host, `vscode` stubbed by `_setup.ts`. Activation is observed at its
 * seams: what the spawned server receives and what `/shutdown` is called with.
 */
import * as assert from "assert";
import * as sinon from "sinon";
import axios from "axios";
import { EventEmitter } from "events";
import type * as ChildProcessNS from "node:child_process";
import type { ExtensionContext } from "vscode";
import { MapBuilderJavaProcess } from "../../MapBuilderJavaProcess";
import { activate, deactivate } from "../../extension";
import { window } from "./vscode.mock";
import { standardTeardown } from "./_helpers";

// Raw require, as in MapBuilderJavaProcess.unit.test.ts: sinon cannot stub the `import * as` copy.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const childProcess: typeof ChildProcessNS = require("node:child_process");

const SECRET_KEY = "fhirMapBuilder.apiToken";

function contextWithSecrets(initial?: string): { context: ExtensionContext; stored: Map<string, string> } {
    const stored = new Map<string, string>();
    if (initial !== undefined) {
        stored.set(SECRET_KEY, initial);
    }
    const context = {
        subscriptions: [],
        secrets: {
            get: async (key: string) => stored.get(key),
            store: async (key: string, value: string) => {
                stored.set(key, value);
            },
        },
    } as unknown as ExtensionContext;
    return { context, stored };
}

function fakeProcess(): ChildProcessNS.ChildProcess {
    const cp = new EventEmitter() as ChildProcessNS.ChildProcess;
    (cp as unknown as { stdout: EventEmitter }).stdout = new EventEmitter();
    (cp as unknown as { stderr: EventEmitter }).stderr = new EventEmitter();
    return cp;
}

suite("extension API token wiring", () => {
    let get: sinon.SinonStub;
    let spawn: sinon.SinonStub;

    setup(() => {
        get = sinon.stub(axios, "get");
        spawn = sinon.stub(childProcess, "spawn").returns(fakeProcess());
        sinon
            .stub(MapBuilderJavaProcess.prototype as unknown as Record<string, unknown>, "buildShellCommand")
            .returns({ command: "java", args: ["-jar", "x.jar"] });
    });

    teardown(standardTeardown);

    function serverIs(running: boolean) {
        get.callsFake((url: string) =>
            /health/.test(url) && !running ? Promise.reject(new Error("down")) : Promise.resolve({ status: 200 }),
        );
    }

    function shutdownCall() {
        return get.getCalls().find((c) => /shutdown/.test(c.args[0] as string));
    }

    test("first activation creates a token, stores it, and starts the server with it", async () => {
        serverIs(false);
        const { context, stored } = contextWithSecrets();

        await activate(context);

        const token = stored.get(SECRET_KEY);
        assert.match(token ?? "", /^[0-9a-f]{64}$/);
        assert.strictEqual(spawn.calledOnce, true);
        assert.strictEqual((spawn.firstCall.args[2] as ChildProcessNS.SpawnOptions).env?.MAPBUILDER_API_TOKEN, token);
    });

    test("a later window reuses the stored token instead of creating another", async () => {
        serverIs(false);
        const { context, stored } = contextWithSecrets("shared-token");

        await activate(context);

        assert.strictEqual(stored.get(SECRET_KEY), "shared-token");
        assert.strictEqual(
            (spawn.firstCall.args[2] as ChildProcessNS.SpawnOptions).env?.MAPBUILDER_API_TOKEN,
            "shared-token",
        );
    });

    test("does not start a second server when one already answers, and still authenticates the shutdown", async () => {
        serverIs(true);
        const { context } = contextWithSecrets("shared-token");

        await activate(context);
        deactivate();

        assert.strictEqual(spawn.called, false);
        assert.deepStrictEqual(shutdownCall()?.args[1], { headers: { "X-MapBuilder-Token": "shared-token" } });
    });

    suite("a running server started with another token (#203)", () => {
        let showError: sinon.SinonStub;

        setup(() => {
            showError = sinon.stub(window, "showErrorMessage").resolves(undefined);
        });

        function serverRejectsToken() {
            get.callsFake((url: string) =>
                Promise.resolve({ status: /health/.test(url) ? 200 : /matchbox\/parse/.test(url) ? 401 : 200 }),
            );
        }

        test("tells the user once and does not start a second server", async () => {
            serverRejectsToken();
            const { context } = contextWithSecrets("shared-token");

            await activate(context);

            assert.strictEqual(showError.callCount, 1);
            assert.match(showError.firstCall.args[0] as string, /different API token/);
            assert.strictEqual(spawn.called, false);
        });

        test("stays silent when the running server accepts the token", async () => {
            serverIs(true);
            const { context } = contextWithSecrets("shared-token");

            await activate(context);

            assert.strictEqual(showError.called, false);
        });

        test("does not probe a server the extension starts itself", async () => {
            serverIs(false);
            const { context } = contextWithSecrets("shared-token");

            await activate(context);

            assert.strictEqual(showError.called, false);
            assert.strictEqual(
                get.getCalls().some((c) => /matchbox\/parse/.test(c.args[0] as string)),
                false,
            );
        });
    });
});
