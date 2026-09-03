/**
 * Unit suite for `src/FhirDefinition.ts` (spec #143, ticket #146) — out-of-host,
 * `vscode` stubbed by `_setup.ts`. Target: >= 80 % line coverage.
 *
 * couverture: FhirDefinition.ts lines 80-81 (`return null` inside the
 * fhirVersion `.map`) are unreachable — the regex `/^#?(\S*)/` matches every
 * string, so `versionMatch` is never falsy.
 */
import * as assert from "assert";
import * as sinon from "sinon";
import fs from "fs";
import type { OutputChannel } from "vscode";
import { FhirDefinition } from "../../FhirDefinition";
import * as utils from "../../utils";
import { FileType, resetVscodeMock, Uri, window, workspace } from "./vscode.mock";
import { makeLogger, priv } from "./_helpers";

function encode(text: string): Uint8Array {
    return new TextEncoder().encode(text);
}

suite("FhirDefinition", () => {
    let logger: OutputChannel;
    let def: FhirDefinition;

    setup(() => {
        logger = makeLogger();
        sinon.stub(console, "error");
        def = new FhirDefinition(logger);
    });

    teardown(() => {
        sinon.restore();
        resetVscodeMock();
    });

    test("constructor wires a sushi-config watcher", () => {
        assert.ok(def.fsWatcher);
        assert.strictEqual(typeof def.fsWatcher.dispose, "function");
    });

    suite("buildElementsFromSnapshot", () => {
        test("returns [] for no elements", () => {
            assert.deepStrictEqual(def.buildElementsFromSnapshot([]), []);
        });

        test("adds a top-level element with its types", () => {
            const tree = def.buildElementsFromSnapshot([
                { path: "Patient.name", max: "1", type: [{ code: "HumanName" }] },
            ]);
            assert.deepStrictEqual(tree, [{ path: "name", types: ["HumanName"], children: [] }]);
        });

        test("nests a child under an existing parent", () => {
            const tree = def.buildElementsFromSnapshot([
                { path: "Patient.name", max: "1", type: [{ code: "HumanName" }] },
                { path: "Patient.name.given", max: "*", type: [{ code: "string" }] },
            ]);
            assert.strictEqual(tree[0].children[0].path, "given");
        });

        test("skips elements whose max is 0 (string or number)", () => {
            const tree = def.buildElementsFromSnapshot([
                { path: "Patient.a", max: "0", type: [] },
                { path: "Patient.b", max: 0, type: [] },
            ]);
            assert.deepStrictEqual(tree, []);
        });

        test("keeps elements whose max is a positive number and strips the [x] suffix", () => {
            const tree = def.buildElementsFromSnapshot([
                { path: "Patient.value[x]", max: 3, type: [{ code: "Quantity" }] },
            ]);
            assert.strictEqual(tree[0].path, "value");
        });

        test("ignores elements with no path and defaults missing types to []", () => {
            const tree = def.buildElementsFromSnapshot([{ max: "1" }, { path: "Patient.gender", max: "1" }]);
            assert.deepStrictEqual(tree, [{ path: "gender", types: [], children: [] }]);
        });
    });

    suite("resolvePatchVersion", () => {
        test("returns the highest cached version matching the range", async () => {
            workspace.fs.readDirectory = () =>
                Promise.resolve([
                    ["hl7.fhir.r4.core#4.0.1", FileType.Directory],
                    ["hl7.fhir.r4.core#4.0.5", FileType.Directory],
                    ["other#1.0.0", FileType.Directory],
                    ["loose-file", FileType.File],
                ]);

            const resolved = await priv(def).resolvePatchVersion("hl7.fhir.r4.core", "4.0.x");
            assert.strictEqual(resolved, "4.0.5");
        });

        test("falls back to the requested version when nothing matches", async () => {
            workspace.fs.readDirectory = () => Promise.resolve([]);
            const resolved = await priv(def).resolvePatchVersion("pkg", "9.9.x");
            assert.strictEqual(resolved, "9.9.x");
        });
    });

    suite("getPackagesRegistry", () => {
        test("returns the two official registries when there is no fhir-settings.json", async () => {
            sinon.stub(fs, "existsSync").returns(false);
            const registries = (await priv(def).getPackagesRegistry()) as string[];
            assert.deepStrictEqual(registries, ["http://packages.fhir.org/", "http://packages2.fhir.org/"]);
        });

        test("appends server urls from fhir-settings.json", async () => {
            sinon.stub(fs, "existsSync").returns(true);
            workspace.fs.readFile = () => Promise.resolve(encode("servers:\n  - url: http://s1\n  - url: http://s2\n"));
            const registries = (await priv(def).getPackagesRegistry()) as string[];
            assert.deepStrictEqual(registries.slice(2), ["http://s1", "http://s2"]);
        });
    });

    suite("updateFhirEntities", () => {
        setup(() => {
            sinon.stub(priv(def), "getPackagesRegistry").resolves(["http://p"]);
            sinon.stub(priv(def), "makeItemsFromDependencies").resolves(new Map());
        });

        test("throws when the cache path cannot be stat'd", async () => {
            workspace.fs.stat = () => Promise.reject(new Error("nope"));
            await assert.rejects(def.updateFhirEntities(), /Couldn't load FHIR definitions/);
        });

        test("defaults to hl7.fhir.r4.core 4.0.1 when there is no sushi-config", async () => {
            workspace.fs.stat = () => Promise.resolve({ type: FileType.File, ctime: 0, mtime: 0, size: 0 });
            workspace.findFiles = () => Promise.resolve([]);

            await def.updateFhirEntities();

            const last = def.parsedDependencies.at(-1);
            assert.deepStrictEqual(last, { packageId: "hl7.fhir.r4.core", version: "4.0.1" });
            assert.strictEqual((priv(def).makeItemsFromDependencies as sinon.SinonStub).calledOnce, true);
        });

        async function runWithConfig(yaml: string): Promise<void> {
            workspace.fs.stat = () => Promise.resolve({ type: FileType.File, ctime: 0, mtime: 0, size: 0 });
            workspace.findFiles = () => Promise.resolve([Uri.file("/ws/sushi-config.yaml")]);
            workspace.fs.readFile = () => Promise.resolve(encode(yaml));
            await def.updateFhirEntities();
        }

        test("reads canonical / id / fhirVersion from sushi-config", async () => {
            await runWithConfig("canonical: http://acme/ig\nid: acme.ig\nfhirVersion: 4.0.1\n");
            assert.strictEqual(def.canonicalURL, "http://acme/ig");
            assert.strictEqual(def.igId, "acme.ig");
            assert.strictEqual(def.fhirVersion, "4.0.1");
            assert.ok(def.parsedDependencies.some((d) => d.packageId === "acme.ig" && d.version === "dev"));
        });

        test("selects the r4b core package for a 4.1.x fhirVersion", async () => {
            await runWithConfig("fhirVersion: 4.1.0\n");
            assert.strictEqual(def.parsedDependencies.at(-1)?.packageId, "hl7.fhir.r4b.core");
        });

        test("selects the r5 core package for a 5.x fhirVersion", async () => {
            await runWithConfig("fhirVersion: 5.0.0\n");
            assert.strictEqual(def.parsedDependencies.at(-1)?.packageId, "hl7.fhir.r5.core");
        });

        test("takes the first recognised version from a fhirVersion list", async () => {
            await runWithConfig("fhirVersion:\n  - foo\n  - 4.0.1\n");
            assert.strictEqual(def.fhirVersion, "4.0.1");
        });

        test("falls back to 4.0.1 when no listed version is recognised", async () => {
            await runWithConfig("fhirVersion: not-a-version\n");
            assert.strictEqual(def.parsedDependencies.at(-1)?.version, "4.0.1");
        });

        test("maps string / number / null / object dependency declarations", async () => {
            await runWithConfig(
                "fhirVersion: 4.0.1\ndependencies:\n  pkg.a: 1.2.3\n  pkg.b: 2\n  pkg.c:\n  pkg.d:\n    version: 3.4.5\n",
            );
            const byId = Object.fromEntries(def.parsedDependencies.map((d) => [d.packageId, d.version]));
            assert.strictEqual(byId["pkg.a"], "1.2.3");
            assert.strictEqual(byId["pkg.b"], "2");
            assert.strictEqual(byId["pkg.c"], undefined);
            assert.strictEqual(byId["pkg.d"], "3.4.5");
        });

        test("swallows a sushi-config that cannot be read", async () => {
            workspace.fs.stat = () => Promise.resolve({ type: FileType.File, ctime: 0, mtime: 0, size: 0 });
            workspace.findFiles = () => Promise.resolve([Uri.file("/ws/sushi-config.yaml")]);
            workspace.fs.readFile = () => Promise.reject(new Error("EIO"));

            await def.updateFhirEntities();

            assert.strictEqual(def.parsedDependencies.at(-1)?.packageId, "hl7.fhir.r4.core");
        });
    });

    suite("makeItemsFromDependencies", () => {
        const sd = JSON.stringify({
            url: "http://acme/Patient",
            type: "Patient",
            snapshot: { element: [{ path: "Patient.name", max: "1", type: [{ code: "HumanName" }] }] },
        });

        test("reads StructureDefinition files from an already-cached package", async () => {
            sinon.stub(fs, "existsSync").returns(true);
            workspace.fs.readDirectory = () =>
                Promise.resolve([
                    ["StructureDefinition-patient.json", FileType.File],
                    ["notes.txt", FileType.File],
                    ["sub", FileType.Directory],
                ]);
            workspace.fs.readFile = () => Promise.resolve(encode(sd));

            const entities = await def.makeItemsFromDependencies([{ packageId: "acme.core", version: "1.0.0" }]);

            const item = entities.get("http://acme/Patient");
            assert.ok(item);
            assert.strictEqual(item?.detail, "acme.core");
            assert.strictEqual(item?.type, "Patient");
            assert.strictEqual((item?.elements as unknown[]).length, 1);
        });

        test("resolves a .x version through resolvePatchVersion", async () => {
            const resolve = sinon.stub(priv(def), "resolvePatchVersion").resolves("1.2.9");
            sinon.stub(fs, "existsSync").returns(true);
            workspace.fs.readDirectory = () => Promise.resolve([]);

            await def.makeItemsFromDependencies([{ packageId: "acme.core", version: "1.2.x" }]);

            assert.strictEqual(resolve.calledOnceWithExactly("acme.core", "1.2.x"), true);
        });

        test("downloads and extracts a package that is not cached", async () => {
            sinon.stub(fs, "existsSync").returns(false);
            const download = sinon.stub(utils, "downloadFHIRPackage").returns(true);
            const extract = sinon.stub(utils, "extractTGZ").resolves();
            workspace.fs.readDirectory = () => Promise.resolve([]);

            await def.makeItemsFromDependencies([{ packageId: "acme.core", version: "1.0.0" }]);

            assert.strictEqual(download.calledOnce, true);
            assert.strictEqual(extract.calledOnce, true);
        });

        test("ignores an unparseable StructureDefinition without failing the batch", async () => {
            sinon.stub(fs, "existsSync").returns(true);
            workspace.fs.readDirectory = () => Promise.resolve([["StructureDefinition-bad.json", FileType.File]]);
            workspace.fs.readFile = () => Promise.resolve(encode("{ not json"));

            const entities = await def.makeItemsFromDependencies([{ packageId: "acme.core", version: "1.0.0" }]);

            assert.strictEqual(entities.size, 0);
        });

        test("reports a package whose directory cannot be read", async () => {
            const info = sinon.stub(window, "showInformationMessage");
            sinon.stub(fs, "existsSync").returns(true);
            workspace.fs.readDirectory = () => Promise.reject(new Error("ENOENT"));

            const entities = await def.makeItemsFromDependencies([{ packageId: "acme.core", version: "1.0.0" }]);

            assert.strictEqual(entities.size, 0);
            assert.strictEqual(info.called, true);
        });
    });
});
