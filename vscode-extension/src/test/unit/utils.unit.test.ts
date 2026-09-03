/**
 * Unit suite for `src/utils.ts` (spec #143, ticket #145) — out-of-host, `vscode`
 * stubbed by `_setup.ts`. Target: >= 85 % line coverage.
 */
import * as assert from "assert";
import * as sinon from "sinon";
import fs from "fs";
import axios from "axios";
import type { OutputChannel } from "vscode";
import type { FhirDefinition } from "../../FhirDefinition";
import {
    collectFilesWithExtension,
    downloadFHIRPackage,
    executeWithProgress,
    extractTGZ,
    getAllParamsFromUrl,
    getDataFile,
    isEmptyOrBlank,
    logData,
    retrieveAllLines,
    retrieveLines,
    retrieveNameAndAlias,
    retrieveSourceAndTargetFromGroupLine,
    retrieveType,
    retrieveUrlAliasAs,
    testPath,
} from "../../utils";
import { setConfig, window } from "./vscode.mock";
import { makeLogger, standardTeardown } from "./_helpers";

suite("utils", () => {
    let logger: OutputChannel;

    setup(() => {
        logger = makeLogger();
        sinon.stub(console, "log");
        sinon.stub(console, "error");
    });

    teardown(standardTeardown);

    suite("string parsing helpers", () => {
        test("retrieveLines keeps only lines starting with the prefix", () => {
            const lines = ["uses a", "group g", "uses b", "  uses c"];
            assert.deepStrictEqual(retrieveLines(logger, lines, "uses"), ["uses a", "uses b"]);
        });

        test("retrieveSourceAndTargetFromGroupLine splits the parenthesised list", () => {
            assert.deepStrictEqual(retrieveSourceAndTargetFromGroupLine(logger, "group x(a, b)"), ["a", " b"]);
        });

        test("retrieveSourceAndTargetFromGroupLine with no parentheses yields one empty entry", () => {
            assert.deepStrictEqual(retrieveSourceAndTargetFromGroupLine(logger, "group x"), [""]);
        });

        test("retrieveNameAndAlias parses a source line", () => {
            assert.deepStrictEqual(retrieveNameAndAlias(logger, "source patient : Patient"), [
                "patient",
                "Patient",
                "source",
            ]);
        });

        test("retrieveNameAndAlias parses a target line", () => {
            assert.deepStrictEqual(retrieveNameAndAlias(logger, "target bundle : Bundle"), [
                "bundle",
                "Bundle",
                "target",
            ]);
        });

        test("retrieveUrlAliasAs reads uses/alias/as tokens", () => {
            assert.deepStrictEqual(retrieveUrlAliasAs(logger, 'uses "http://acme/Patient" alias Pat as source'), [
                "http://acme/Patient",
                "Pat",
                "source",
            ]);
        });

        test("retrieveUrlAliasAs leaves alias/as empty when only uses is present", () => {
            assert.deepStrictEqual(retrieveUrlAliasAs(logger, 'uses "http://acme/Obs"'), ["http://acme/Obs", "", ""]);
        });

        test("retrieveType returns the last url segment", () => {
            assert.strictEqual(retrieveType(logger, "http://acme/fhir/StructureDefinition/Patient"), "Patient");
        });

        test("isEmptyOrBlank", () => {
            assert.strictEqual(isEmptyOrBlank(""), true);
            assert.strictEqual(isEmptyOrBlank("   "), true);
            assert.strictEqual(isEmptyOrBlank("x"), false);
        });
    });

    suite("filesystem helpers", () => {
        test("collectFilesWithExtension walks directories recursively", () => {
            sinon.stub(fs, "statSync").callsFake(
                (p: fs.PathLike) =>
                    ({
                        isDirectory: () => String(p).endsWith("root") || String(p).endsWith("sub"),
                    }) as fs.Stats,
            );
            sinon
                .stub(fs, "readdirSync")
                .callsFake(((p: fs.PathLike) =>
                    String(p).endsWith("root")
                        ? ["sub", "a.fml", "b.txt"]
                        : ["c.fml"]) as unknown as typeof fs.readdirSync);

            const out: string[] = [];
            collectFilesWithExtension("root", out, ".fml");

            assert.strictEqual(out.length, 2);
            assert.ok(out.some((f) => f.endsWith("a.fml")));
            assert.ok(out.some((f) => f.endsWith("c.fml")));
        });

        test("retrieveAllLines splits file content on newlines", () => {
            sinon.stub(fs, "readFileSync").returns("line1\nline2\r\nline3");
            assert.deepStrictEqual(retrieveAllLines(logger, "/x.fml"), ["line1", "line2", "line3"]);
        });

        test("retrieveAllLines returns [] when the read throws", () => {
            sinon.stub(fs, "readFileSync").throws(new Error("ENOENT"));
            assert.deepStrictEqual(retrieveAllLines(logger, "/missing.fml"), []);
        });

        test("testPath is true when accessSync succeeds, false when it throws", () => {
            const access = sinon.stub(fs, "accessSync");
            access.returns(undefined);
            assert.strictEqual(testPath("/exists"), true);
            access.throws(new Error("EACCES"));
            assert.strictEqual(testPath("/nope"), false);
        });
    });

    suite("logData", () => {
        test("prefixes the message with a timestamp", () => {
            logData("hello", logger);
            const line = (logger.appendLine as sinon.SinonSpy).firstCall.args[0] as string;
            assert.ok(line.endsWith(" : hello"));
        });
    });

    suite("executeWithProgress", () => {
        test("runs the task inside window.withProgress at Notification location", async () => {
            const withProgress = sinon.spy(window, "withProgress");
            let ran = false;
            await executeWithProgress("working", async () => {
                ran = true;
            });
            assert.strictEqual(ran, true);
            assert.strictEqual(withProgress.calledOnce, true);
        });
    });

    suite("getDataFile", () => {
        test("reads FhirMapBuilder.dataFile from configuration", () => {
            setConfig("dataFile", "/data/input.json");
            assert.strictEqual(getDataFile(), "/data/input.json");
        });
    });

    suite("getAllParamsFromUrl", () => {
        function definitionProvider(overrides: Partial<FhirDefinition>): FhirDefinition {
            return {
                canonicalURL: "http://canon/ig",
                fhirEntities: new Map(),
                ...overrides,
            } as unknown as FhirDefinition;
        }

        test("returns [] for an empty url", async () => {
            const items = await getAllParamsFromUrl(logger, "", definitionProvider({}));
            assert.deepStrictEqual(items, []);
        });

        test("maps snapshot elements of a known entity to completion items", async () => {
            const provider = definitionProvider({
                fhirEntities: new Map([
                    ["http://acme/Patient", { elements: [{ path: "name" }, { path: "gender" }] }],
                ]) as unknown as FhirDefinition["fhirEntities"],
            });
            const items = await getAllParamsFromUrl(logger, "http://acme/Patient", provider);
            assert.deepStrictEqual(
                items.map((i) => i.label),
                ["name", "gender"],
            );
        });

        test("prompts to build the IG for an unknown url under the canonical", async () => {
            const items = await getAllParamsFromUrl(logger, "http://canon/ig/Foo", definitionProvider({}));
            assert.strictEqual(items.length, 1);
            assert.match(String(items[0].label), /build IG/i);
        });

        test("returns [] for an unknown url outside the canonical", async () => {
            const items = await getAllParamsFromUrl(logger, "http://elsewhere/Bar", definitionProvider({}));
            assert.deepStrictEqual(items, []);
        });
    });

    suite("downloadFHIRPackage", () => {
        test("writes the archive and reports success on HTTP 200", () => {
            const write = sinon.stub(fs, "writeFileSync");
            sinon.stub(axios, "get").returns({
                then: (onFulfilled: (r: unknown) => void) => onFulfilled({ status: 200, data: Buffer.from("pkg") }),
            } as unknown as Promise<unknown>);

            const ok = downloadFHIRPackage(logger, ["http://reg"], "hl7.fhir.r4.core", "4.0.1");

            assert.strictEqual(ok, true);
            assert.strictEqual(write.calledOnce, true);
        });

        test("stops after the first registry that succeeds", () => {
            sinon.stub(fs, "writeFileSync");
            const get = sinon.stub(axios, "get").returns({
                then: (onFulfilled: (r: unknown) => void) => onFulfilled({ status: 200, data: Buffer.from("pkg") }),
            } as unknown as Promise<unknown>);

            downloadFHIRPackage(logger, ["http://reg1", "http://reg2"], "pkg", "1.0.0");

            assert.strictEqual(get.callCount, 1);
        });

        test("logs and keeps going when a registry rejects", () => {
            sinon.stub(axios, "get").returns({
                then: (_onFulfilled: unknown, onRejected: (e: unknown) => void) => onRejected(new Error("network")),
            } as unknown as Promise<unknown>);

            const ok = downloadFHIRPackage(logger, ["http://reg"], "pkg", "1.0.0");

            assert.strictEqual(ok, false);
            assert.ok(
                (logger.appendLine as sinon.SinonSpy)
                    .getCalls()
                    .some((c) => /Error downloading package/.test(c.args[0])),
            );
        });

        test("catches a synchronous failure from axios", () => {
            sinon.stub(axios, "get").throws(new Error("boom"));
            const ok = downloadFHIRPackage(logger, ["http://reg"], "pkg", "1.0.0");
            assert.strictEqual(ok, false);
        });
    });

    suite("extractTGZ", () => {
        function stubStreamChain() {
            // `chain.pipe` ignores its argument, so the real `zlib.createGunzip()`
            // / `tar.extract()` results are simply dropped — no need to stub those
            // (and `zlib` is non-configurable anyway).
            const handlers: Record<string, (arg?: unknown) => void> = {};
            const chain = {
                pipe: () => chain,
                on: (event: string, cb: (arg?: unknown) => void) => {
                    handlers[event] = cb;
                    return chain;
                },
            };
            sinon.stub(fs, "createReadStream").returns(chain as unknown as fs.ReadStream);
            return handlers;
        }

        test("unlinks the archive and resolves on finish", async () => {
            sinon.stub(fs, "mkdirSync");
            const unlink = sinon.stub(fs, "unlinkSync");
            const handlers = stubStreamChain();

            const done = extractTGZ(logger, "/tmp/p.tgz", "/out");
            handlers.finish();
            await done;

            assert.strictEqual(unlink.calledOnceWithExactly("/tmp/p.tgz"), true);
        });

        test("rejects on stream error", async () => {
            sinon.stub(fs, "mkdirSync");
            const handlers = stubStreamChain();

            const done = extractTGZ(logger, "/tmp/p.tgz", "/out");
            handlers.error(new Error("corrupt"));

            await assert.rejects(done, /corrupt/);
        });
    });
});
