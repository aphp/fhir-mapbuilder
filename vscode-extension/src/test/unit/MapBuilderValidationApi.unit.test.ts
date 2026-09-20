/**
 * Unit suite for `src/MapBuilderValidationApi.ts` (spec #143, ticket #149) —
 * out-of-host, `vscode` stubbed by `_setup.ts`. Target: >= 85 % line coverage.
 */
import * as assert from "assert";
import * as sinon from "sinon";
import axios from "axios";
import { MapBuilderValidationApi } from "../../MapBuilderValidationApi";
import { ApiConstants } from "../../constants/ApiConstants";
import { setConfig, setWorkspaceFolders, window } from "./vscode.mock";
import { noopChannel, priv, standardTeardown } from "./_helpers";

suite("MapBuilderValidationApi", () => {
    let get: sinon.SinonStub;
    let api: MapBuilderValidationApi;

    setup(() => {
        get = sinon.stub(axios, "get");
        api = new MapBuilderValidationApi(noopChannel, "test-token");
    });

    teardown(standardTeardown);

    suite("API token", () => {
        const tokenHeader = { headers: { "X-MapBuilder-Token": "test-token" } };

        function okEverywhere() {
            get.resolves({ status: 200, data: "OK" });
        }

        function callFor(pattern: RegExp) {
            return get.getCalls().find((c) => pattern.test(c.args[0] as string));
        }

        test("validate sends the token", async () => {
            okEverywhere();
            await api.callValidateStructureMap();
            assert.deepStrictEqual(callFor(/matchbox\/validate/)?.args[1], tokenHeader);
        });

        test("parse sends the token", async () => {
            okEverywhere();
            await api.callParseStructureMap("/ws/map.fml");
            assert.deepStrictEqual(callFor(/matchbox\/parse/)?.args[1], tokenHeader);
        });

        test("reset and load engine sends the token", async () => {
            okEverywhere();
            await api.callResetAndLoadEngine();
            assert.deepStrictEqual(callFor(/resetAndLoadEngine/)?.args[1], tokenHeader);
        });

        test("shutdown sends the token", () => {
            okEverywhere();
            api.callShutDownProcess();
            assert.deepStrictEqual(callFor(/shutdown/)?.args[1], tokenHeader);
        });

        test("the open health endpoint never receives the token", async () => {
            okEverywhere();
            await api.isAppRunning();
            assert.strictEqual(callFor(/health/)?.args[1], undefined);
        });
    });

    suite("token mismatch", () => {
        let onMismatch: sinon.SinonStub;
        let mismatchApi: MapBuilderValidationApi;

        setup(() => {
            onMismatch = sinon.stub();
            mismatchApi = new MapBuilderValidationApi(noopChannel, "test-token", onMismatch);
        });

        function unauthorized() {
            return Object.assign(new Error("Request failed with status code 401"), {
                isAxiosError: true,
                response: { status: 401 },
            });
        }

        function healthyButRejecting() {
            get.callsFake((url: string) =>
                /health/.test(url) ? Promise.resolve({ status: 200 }) : Promise.reject(unauthorized()),
            );
        }

        const calls: [string, (api: MapBuilderValidationApi) => Promise<unknown>][] = [
            ["validate", (a) => a.callValidateStructureMap()],
            ["parse", (a) => a.callParseStructureMap("/ws/map.fml")],
            ["reset and load engine", (a) => a.callResetAndLoadEngine()],
        ];

        suite("a 401 on a regular call", () => {
            for (const [name, call] of calls) {
                test(`${name} reports a mismatch`, async () => {
                    healthyButRejecting();
                    await call(mismatchApi);
                    assert.strictEqual(onMismatch.callCount, 1);
                });
            }

            test("reports once across a rejected probe and rejected calls", async () => {
                get.resolves({ status: 401 });
                await mismatchApi.probeToken();
                healthyButRejecting();
                await mismatchApi.callParseStructureMap("/ws/map.fml");
                await mismatchApi.callParseStructureMap("/ws/map.fml");
                assert.strictEqual(onMismatch.callCount, 1);
            });

            test("ignores other failures", async () => {
                get.callsFake((url: string) =>
                    /health/.test(url) ? Promise.resolve({ status: 200 }) : Promise.reject(new Error("boom")),
                );
                await mismatchApi.callParseStructureMap("/ws/map.fml");
                assert.strictEqual(onMismatch.called, false);
            });
        });

        suite("once a mismatch is reported", () => {
            let lines: string[];

            setup(async () => {
                lines = [];
                const channel = { appendLine: (l: string) => lines.push(l), append: () => {} } as never;
                mismatchApi = new MapBuilderValidationApi(channel, "test-token", onMismatch);
                get.resolves({ status: 401 });
                await mismatchApi.probeToken();
                get.resetHistory();
            });

            test("validate, parse and reset make no request and return their failure value", async () => {
                assert.strictEqual(await mismatchApi.callValidateStructureMap(), false);
                assert.strictEqual(await mismatchApi.callParseStructureMap("/ws/map.fml"), false);
                assert.strictEqual(await mismatchApi.callResetAndLoadEngine(), null);
                assert.strictEqual(get.called, false);
            });

            test("each skipped call logs why", async () => {
                await mismatchApi.callParseStructureMap("/ws/map.fml");
                assert.strictEqual(lines.length, 1);
                assert.match(lines[0], /Skipped: the server on port .* rejected the API token\./);
                assert.ok(lines[0].includes(`port ${ApiConstants.apiServerPort} `));
            });

            test("the probe does not run again", async () => {
                await mismatchApi.probeToken();
                assert.strictEqual(get.called, false);
                assert.strictEqual(onMismatch.callCount, 1);
            });
        });

        suite("probeToken", () => {
            test("reports a mismatch once when the probe is answered 401", async () => {
                get.resolves({ status: 401 });
                await mismatchApi.probeToken();
                assert.strictEqual(onMismatch.callCount, 1);
            });

            test("sends the token to a parameterless protected call, never to /health", async () => {
                get.resolves({ status: 400 });
                await mismatchApi.probeToken();
                assert.strictEqual(get.callCount, 1);
                assert.match(get.firstCall.args[0] as string, /matchbox\/parse$/);
                assert.deepStrictEqual(get.firstCall.args[1].headers, { "X-MapBuilder-Token": "test-token" });
            });

            // axios rejects 4xx by default, which the probe would swallow as "inconclusive": a stubbed get cannot
            // show that, so pin the options that make a 401 arrive as a response
            test("asks axios to resolve on any status and bounds the wait", async () => {
                get.resolves({ status: 400 });
                await mismatchApi.probeToken();
                const options = get.firstCall.args[1];
                assert.strictEqual(options.validateStatus(401), true);
                assert.strictEqual(options.validateStatus(400), true);
                assert.ok(options.timeout > 0);
            });

            for (const status of [200, 400]) {
                test(`stays silent when the probe is answered ${status}`, async () => {
                    get.resolves({ status });
                    await mismatchApi.probeToken();
                    assert.strictEqual(onMismatch.called, false);
                });
            }

            test("stays silent when the server cannot be reached", async () => {
                get.rejects(new Error("ECONNRESET"));
                await mismatchApi.probeToken();
                assert.strictEqual(onMismatch.called, false);
            });
        });
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
