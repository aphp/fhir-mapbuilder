/**
 * Unit suite for `src/MapBuilderValidationApi.ts` (spec #143, ticket #149) —
 * out-of-host, `vscode` stubbed by `_setup.ts`. Target: >= 85 % line coverage.
 */
import * as assert from "assert";
import * as sinon from "sinon";
import axios from "axios";
import { MapBuilderValidationApi } from "../../MapBuilderValidationApi";
import { resetVscodeMock, setConfig, setWorkspaceFolders, window } from "./vscode.mock";
import { noopChannel, priv } from "./_helpers";

suite("MapBuilderValidationApi", () => {
    let get: sinon.SinonStub;
    let api: MapBuilderValidationApi;

    setup(() => {
        get = sinon.stub(axios, "get");
        api = new MapBuilderValidationApi(noopChannel);
    });

    teardown(() => {
        sinon.restore();
        resetVscodeMock();
    });

    suite("isAppRunning", () => {
        test("true on HTTP 200", async () => {
            get.resolves({ status: 200 });
            assert.strictEqual(await api.isAppRunning(), true);
        });

        test("false when the health call throws", async () => {
            get.rejects(new Error("ECONNREFUSED"));
            assert.strictEqual(await api.isAppRunning(), false);
        });
    });

    suite("callValidateStructureMap", () => {
        test("builds the url from the active document, workspace and dataFile, and returns true", async () => {
            setWorkspaceFolders(["/ws"]);
            setConfig("dataFile", "/data/in.json");
            window.activeTextEditor = { document: { uri: { fsPath: "/ws/map.fml" } } };
            get.callsFake((url: string) =>
                /health/.test(url) ? Promise.resolve({ status: 200 }) : Promise.resolve({ status: 200, data: "OK" }),
            );

            assert.strictEqual(await api.callValidateStructureMap(), true);

            const validateCall = get.getCalls().find((c) => /matchbox\/validate/.test(c.args[0] as string));
            assert.ok(validateCall);
            assert.match(validateCall!.args[0] as string, /source=.*map\.fml/);
            assert.match(validateCall!.args[0] as string, /data=/);
            assert.match(validateCall!.args[0] as string, /output=/);
        });

        test("waits for the java app when it is not yet running", async () => {
            const wait = sinon.stub(priv(api), "waitForJavaAppReady").resolves();
            get.callsFake((url: string) =>
                /health/.test(url) ? Promise.reject(new Error("down")) : Promise.resolve({ status: 200, data: "OK" }),
            );

            assert.strictEqual(await api.callValidateStructureMap(), true);
            assert.strictEqual(wait.calledOnce, true);
        });

        test("returns false when the validate call fails", async () => {
            get.callsFake((url: string) =>
                /health/.test(url) ? Promise.resolve({ status: 200 }) : Promise.reject(new Error("boom")),
            );
            assert.strictEqual(await api.callValidateStructureMap(), false);
        });
    });

    suite("callParseStructureMap", () => {
        test("returns true on HTTP 200", async () => {
            get.callsFake((url: string) =>
                /health/.test(url) ? Promise.resolve({ status: 200 }) : Promise.resolve({ status: 200 }),
            );
            assert.strictEqual(await api.callParseStructureMap("/ws/map.fml"), true);
        });

        test("returns false on a non-200 response", async () => {
            get.callsFake((url: string) =>
                /health/.test(url) ? Promise.resolve({ status: 200 }) : Promise.resolve({ status: 422 }),
            );
            assert.strictEqual(await api.callParseStructureMap("/ws/map.fml"), false);
        });

        test("returns false when the parse call throws", async () => {
            get.callsFake((url: string) =>
                /health/.test(url) ? Promise.resolve({ status: 200 }) : Promise.reject(new Error("boom")),
            );
            assert.strictEqual(await api.callParseStructureMap("/ws/map.fml"), false);
        });

        test("waits for the java app when it is not running", async () => {
            const wait = sinon.stub(priv(api), "waitForJavaAppReady").resolves();
            get.callsFake((url: string) =>
                /health/.test(url) ? Promise.reject(new Error("down")) : Promise.resolve({ status: 200 }),
            );
            assert.strictEqual(await api.callParseStructureMap("/ws/map.fml"), true);
            assert.strictEqual(wait.calledOnce, true);
        });
    });

    suite("callResetAndLoadEngine", () => {
        test("returns the success message when a package loaded", async () => {
            setWorkspaceFolders(["/ws"]);
            get.callsFake((url: string) =>
                /health/.test(url) ? Promise.resolve({ status: 200 }) : Promise.resolve({ status: 200, data: true }),
            );
            const message = await api.callResetAndLoadEngine();
            assert.match(String(message), /New package loading completed/);
        });

        test("returns null when the call throws", async () => {
            get.callsFake((url: string) =>
                /health/.test(url) ? Promise.resolve({ status: 200 }) : Promise.reject(new Error("boom")),
            );
            assert.strictEqual(await api.callResetAndLoadEngine(), null);
        });

        test("returns null when nothing was loaded", async () => {
            get.callsFake((url: string) =>
                /health/.test(url) ? Promise.resolve({ status: 200 }) : Promise.resolve({ status: 200, data: false }),
            );
            assert.strictEqual(await api.callResetAndLoadEngine(), null);
        });

        test("waits for the java app when it is not running", async () => {
            setWorkspaceFolders(["/ws"]);
            const wait = sinon.stub(priv(api), "waitForJavaAppReady").resolves();
            get.callsFake((url: string) =>
                /health/.test(url) ? Promise.reject(new Error("down")) : Promise.resolve({ status: 200, data: true }),
            );
            assert.match(String(await api.callResetAndLoadEngine()), /New package loading completed/);
            assert.strictEqual(wait.calledOnce, true);
        });
    });

    test("callShutDownProcess fires a GET at the shutdown url", () => {
        api.callShutDownProcess();
        assert.match(get.firstCall.args[0] as string, /shutdown/);
    });

    suite("waitForJavaAppReady", () => {
        test("returns once the health check answers 200", async () => {
            const clock = sinon.useFakeTimers();
            get.onFirstCall().rejects(new Error("down"));
            get.onSecondCall().resolves({ status: 200 });

            const done = priv(api).waitForJavaAppReady(5, 1000) as Promise<void>;
            await clock.tickAsync(2000);
            await done;

            clock.restore();
        });

        test("throws after exhausting the retries", async () => {
            const clock = sinon.useFakeTimers();
            get.rejects(new Error("down"));

            const done = priv(api).waitForJavaAppReady(2, 1000) as Promise<void>;
            const assertion = assert.rejects(done, /failed to start/);
            await clock.tickAsync(5000);
            await assertion;

            clock.restore();
        });
    });
});
