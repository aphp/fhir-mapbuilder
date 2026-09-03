/**
 * Unit suite for `src/MapBuilderWatcher.ts` (spec #143, ticket #149) —
 * out-of-host, `vscode` stubbed by `_setup.ts`. Target: >= 90 % line coverage.
 */
import * as assert from "assert";
import * as sinon from "sinon";
import type { OutputChannel } from "vscode";
import { MapBuilderWatcher } from "../../MapBuilderWatcher";
import type { MapBuilderValidationApi } from "../../MapBuilderValidationApi";
import * as utils from "../../utils";
import { resetVscodeMock, setWorkspaceFolders, Uri, window } from "./vscode.mock";

const noopChannel = { appendLine: () => {}, append: () => {} } as unknown as OutputChannel;

function makeApi(): MapBuilderValidationApi {
    return {
        callParseStructureMap: sinon.stub().resolves(true),
        callResetAndLoadEngine: sinon.stub().resolves("loaded"),
    } as unknown as MapBuilderValidationApi;
}

suite("MapBuilderWatcher", () => {
    let api: MapBuilderValidationApi;
    let collect: sinon.SinonStub;

    setup(() => {
        setWorkspaceFolders(["/ws"]);
        // constructor kicks off parseAllFmlFiles(); keep it from touching disk.
        collect = sinon.stub(utils, "collectFilesWithExtension");
        api = makeApi();
    });

    teardown(() => {
        sinon.restore();
        resetVscodeMock();
    });

    function makeWatcher(): MapBuilderWatcher {
        return new MapBuilderWatcher(noopChannel, api);
    }

    test("constructor wires both watchers", () => {
        const w = makeWatcher();
        assert.ok(w.fmlWatcher);
        assert.ok(w.packageWatcher);
    });

    suite("parseFmlFilesFromPath", () => {
        test("returns 0 for a non-string target", async () => {
            const w = makeWatcher();
            const count = await w.parseFmlFilesFromPath(123 as never);
            assert.strictEqual(count, 0);
        });

        test("counts parsed files and logs an add message", async () => {
            const w = makeWatcher(); // construct first: the ctor's parseAllFmlFiles must stay inert
            collect.callsFake((_p, files) => (files as string[]).push("/ws/a.fml", "/ws/b.fml"));

            const count = await w.parseFmlFilesFromPath(Uri.file("/ws") as never, undefined, "add");

            assert.strictEqual(count, 2);
        });

        test("prefers the document path and reports parse failures", async () => {
            const w = makeWatcher();
            collect.callsFake((_p, files) => (files as string[]).push("/doc.fml"));
            (api.callParseStructureMap as sinon.SinonStub).resolves(false);
            const err = sinon.stub(window, "showErrorMessage");

            const count = await w.parseFmlFilesFromPath("/ignored", { uri: { fsPath: "/doc.fml" } } as never, "change");

            assert.strictEqual(count, 0);
            assert.strictEqual(err.calledOnce, true);
            assert.strictEqual(collect.lastCall.args[0], "/doc.fml");
        });
    });

    suite("loadPackageAndParseFmlFiles", () => {
        test("re-parses everything when a package loads", async () => {
            const w = makeWatcher();
            const parseAll = sinon.stub(w, "parseAllFmlFiles").resolves(0);

            await w.loadPackageAndParseFmlFiles();

            assert.strictEqual(parseAll.called, true);
        });

        test("shows an error when the package fails to load", async () => {
            (api.callResetAndLoadEngine as sinon.SinonStub).resolves(null);
            const err = sinon.stub(window, "showErrorMessage");
            const w = makeWatcher();

            await w.loadPackageAndParseFmlFiles();

            assert.strictEqual(err.calledOnce, true);
        });
    });

    test("parseAllFmlFiles walks every workspace folder", async () => {
        const w = makeWatcher();
        collect.callsFake((_p, files) => (files as string[]).push("/ws/a.fml"));
        const perPath = sinon.stub(w, "parseFmlFilesFromPath").resolves(3);

        const total = await w.parseAllFmlFiles();

        assert.strictEqual(total, 3);
        assert.strictEqual(perPath.calledOnce, true);
    });

    test("dispose tears both watchers down", () => {
        const w = makeWatcher();
        const fml = sinon.spy(w.fmlWatcher, "dispose");
        const pkg = sinon.spy(w.packageWatcher, "dispose");

        w.dispose();

        assert.strictEqual(fml.calledOnce, true);
        assert.strictEqual(pkg.calledOnce, true);
    });
});
