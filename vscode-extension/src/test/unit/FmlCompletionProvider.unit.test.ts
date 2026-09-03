/**
 * Unit suite for `src/FmlCompletionProvider.ts` (spec #143, ticket #147) —
 * out-of-host, `vscode` stubbed by `_setup.ts`. Target: >= 80 % line coverage.
 */
import * as assert from "assert";
import * as sinon from "sinon";
import fs from "fs";
import path from "path";
import type { OutputChannel } from "vscode";
import { FmlCompletionProvider } from "../../FmlCompletionProvider";
import type { FhirDefinition } from "../../FhirDefinition";
import * as utils from "../../utils";
import { resetVscodeMock, setWorkspaceFolders, Uri } from "./vscode.mock";
import { makeLogger } from "./_helpers";

function makeDefinitionProvider(): FhirDefinition {
    return {
        updateFhirEntities: sinon.stub().resolves(),
        fhirEntities: new Map([["http://acme/Patient", { elements: [{ path: "name" }] }]]),
        canonicalURL: "http://acme",
    } as unknown as FhirDefinition;
}

const FML = ['uses "http://acme/Patient" alias Pat as source', "group g(source patient : Pat)", ""].join("\n");

suite("FmlCompletionProvider", () => {
    let logger: OutputChannel;
    let provider: FhirDefinition;

    setup(() => {
        logger = makeLogger();
        provider = makeDefinitionProvider();
        sinon.stub(console, "error");
    });

    teardown(() => {
        sinon.restore();
        resetVscodeMock();
    });

    suite("constructor", () => {
        test("does nothing without workspace folders", () => {
            const p = new FmlCompletionProvider(provider, logger);
            assert.strictEqual(p.fmlWatcher, undefined);
        });

        test("scans and wires watchers when a folder is open", () => {
            setWorkspaceFolders(["/ws"]);
            sinon.stub(utils, "collectFilesWithExtension");
            const p = new FmlCompletionProvider(provider, logger);
            assert.ok(p.fmlWatcher);
            assert.strictEqual((provider.updateFhirEntities as sinon.SinonStub).called, true);
        });
    });

    suite("scanAll", () => {
        test("parses `uses` and `group` lines into userDefinitions", async () => {
            setWorkspaceFolders(["/ws"]);
            sinon.stub(utils, "collectFilesWithExtension").callsFake((_p, files) => {
                (files as string[]).push("/ws/map.fml");
            });
            sinon.stub(fs, "readFileSync").returns(FML);

            const p = new FmlCompletionProvider(provider, logger);
            await p.scanAll();

            const defs = p.userDefinitions.get("/ws/map.fml");
            assert.ok(defs && defs.length === 1);
            assert.strictEqual(defs[0].url, "http://acme/Patient");
            // the `group` line back-fills the matching userDef's name
            assert.strictEqual(defs[0].name, "patient");
            assert.ok(p.latestHashes.has("/ws/map.fml"));
        });
    });

    suite("provideCompletionItems", () => {
        function doc(text: string): { fileName: string; lineAt: () => { text: string } } {
            return { fileName: "/ws/map.fml", lineAt: () => ({ text }) };
        }
        const position = { character: 100 } as never;

        function build(): FmlCompletionProvider {
            return new FmlCompletionProvider(provider, logger);
        }

        test("rejects when the line prefix matches no source or target", async () => {
            const p = build();
            p.userDefinitions.set("/ws/map.fml", []);
            await assert.rejects(Promise.resolve(p.provideCompletionItems(doc("nothing here") as never, position)));
        });

        test("resolves source completions from the source url", async () => {
            const p = build();
            p.userDefinitions.set("/ws/map.fml", [
                { url: "http://acme/Patient", alias: "Pat", as: "source", name: "patient" },
            ]);
            const items = await p.provideCompletionItems(doc("patient.") as never, position);
            assert.deepStrictEqual(
                (items as { label: unknown }[]).map((i) => i.label),
                ["name"],
            );
        });

        test("resolves target completions from the target url", async () => {
            const p = build();
            // a source entry is needed too: with sourceName === "" any line ending
            // in "." would match the source branch first.
            p.userDefinitions.set("/ws/map.fml", [
                { url: "http://acme/Src", alias: "S", as: "source", name: "src" },
                { url: "http://acme/Patient", alias: "Bun", as: "target", name: "bundle" },
            ]);
            const items = await p.provideCompletionItems(doc("bundle.") as never, position);
            assert.deepStrictEqual(
                (items as { label: unknown }[]).map((i) => i.label),
                ["name"],
            );
        });

        test("rejects (via catch) when the document throws", async () => {
            const p = build();
            const badDoc = {
                fileName: "/ws/map.fml",
                lineAt: () => {
                    throw new Error("no line");
                },
            };
            await assert.rejects(Promise.resolve(p.provideCompletionItems(badDoc as never, position)), /no line/);
        });
    });

    suite("updateFmlDefintion", () => {
        setup(() => {
            sinon.stub(utils, "collectFilesWithExtension").callsFake((_p, files) => {
                (files as string[]).push("/ws/map.fml");
            });
        });

        test("indexes a file passed as a Uri", () => {
            sinon.stub(fs, "readFileSync").returns(FML);
            const p = new FmlCompletionProvider(provider, logger);

            p.updateFmlDefintion(Uri.file("/ws/map.fml") as never);

            assert.ok(p.userDefinitions.has("/ws/map.fml"));
            assert.strictEqual(p.userDefinitions.get("/ws/map.fml")?.[0].url, "http://acme/Patient");
        });

        test("indexes a file passed as a TextDocument, using getText", () => {
            // `retrieveAllLines` still reads from disk even when `getText` is used.
            sinon.stub(fs, "readFileSync").returns(FML);
            const p = new FmlCompletionProvider(provider, logger);
            const file = { uri: { fsPath: "/ws/map.fml" }, getText: () => FML };

            p.updateFmlDefintion("ignored" as never, file as never);

            assert.strictEqual(p.userDefinitions.get("/ws/map.fml")?.length, 1);
        });

        test("skips a file whose hash has not changed", () => {
            sinon.stub(fs, "readFileSync").returns(FML);
            const p = new FmlCompletionProvider(provider, logger);

            p.updateFmlDefintion("/ws/map.fml");
            p.userDefinitions.set("/ws/map.fml", [{ url: "sentinel", as: "source", alias: "s" }]);
            p.updateFmlDefintion("/ws/map.fml");

            assert.strictEqual(p.userDefinitions.get("/ws/map.fml")?.[0].url, "sentinel");
        });

        test("re-indexes (dropping the stale entry) when the content changed", () => {
            const read = sinon.stub(fs, "readFileSync").returns(FML);
            const p = new FmlCompletionProvider(provider, logger);

            p.updateFmlDefintion("/ws/map.fml");
            read.returns('uses "http://acme/Obs" alias Obs as target\n');
            p.updateFmlDefintion("/ws/map.fml");

            assert.strictEqual(p.userDefinitions.get("/ws/map.fml")?.[0].url, "http://acme/Obs");
        });
    });

    suite("handleDeletedFile", () => {
        test("removes an exact match and directory-prefixed entries", () => {
            const p = new FmlCompletionProvider(provider, logger);
            const dir = path.join("ws", "sub");
            const nested = path.join(dir, "b.fml");
            p.userDefinitions.set(path.join("ws", "a.fml"), []);
            p.userDefinitions.set(nested, []);
            p.latestHashes.set(nested, "h");

            p.handleDeletedFile(Uri.file(dir) as never);

            assert.strictEqual(p.userDefinitions.has(nested), false);
            assert.strictEqual(p.latestHashes.has(nested), false);
            assert.strictEqual(p.userDefinitions.has(path.join("ws", "a.fml")), true);

            p.handleDeletedFile(path.join("ws", "a.fml"));
            assert.strictEqual(p.userDefinitions.has(path.join("ws", "a.fml")), false);
        });
    });

    test("resolveCompletionItem is not implemented", () => {
        const p = new FmlCompletionProvider(provider, logger);
        assert.throws(() => p.resolveCompletionItem!({} as never, {} as never), /not implemented/i);
    });
});
