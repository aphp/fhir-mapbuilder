/**
 * Unit suite for `src/FmlValidation.ts` (spec #143, ticket #149) — out-of-host,
 * `vscode` stubbed by `_setup.ts`. Target: >= 85 % line coverage.
 */
import * as assert from "assert";
import * as sinon from "sinon";
import fs from "fs";
import type { OutputChannel } from "vscode";
import { FmlValidation } from "../../FmlValidation";
import type { MapBuilderValidationApi } from "../../MapBuilderValidationApi";
import { resetVscodeMock, setWorkspaceFolders, Uri, window } from "./vscode.mock";

const noopChannel = { appendLine: () => {}, append: () => {} } as unknown as OutputChannel;

function makeApi(): MapBuilderValidationApi {
    return {
        callValidateStructureMap: sinon.stub().resolves(true),
        callResetAndLoadEngine: sinon.stub().resolves("loaded"),
    } as unknown as MapBuilderValidationApi;
}

function priv(instance: FmlValidation): Record<string, (...args: unknown[]) => unknown> {
    return instance as unknown as Record<string, (...args: unknown[]) => unknown>;
}

suite("FmlValidation", () => {
    let api: MapBuilderValidationApi;
    let val: FmlValidation;

    setup(() => {
        api = makeApi();
        val = new FmlValidation(noopChannel, api);
    });

    teardown(() => {
        sinon.restore();
        resetVscodeMock();
    });

    suite("loadPackage", () => {
        test("shows an info message with the returned package message", async () => {
            const info = sinon.stub(window, "showInformationMessage");
            (api.callResetAndLoadEngine as sinon.SinonStub).resolves("New package loaded");
            await val.loadPackage();
            assert.strictEqual(info.calledOnceWith("New package loaded"), true);
        });

        test("shows an error message when nothing was loaded", async () => {
            const err = sinon.stub(window, "showErrorMessage");
            (api.callResetAndLoadEngine as sinon.SinonStub).resolves(null);
            await val.loadPackage();
            assert.strictEqual(err.calledOnce, true);
        });
    });

    suite("performValidation (via validateWithDefaultFiles)", () => {
        test("reports success when the api validates", async () => {
            const info = sinon.stub(window, "showInformationMessage");
            (api.callValidateStructureMap as sinon.SinonStub).resolves(true);
            await val.validateWithDefaultFiles();
            assert.strictEqual(info.calledOnce, true);
        });

        test("reports an error when the api rejects the map", async () => {
            const err = sinon.stub(window, "showErrorMessage");
            (api.callValidateStructureMap as sinon.SinonStub).resolves(false);
            await val.validateWithDefaultFiles();
            assert.strictEqual(err.calledOnce, true);
        });
    });

    suite("validateWithPossibilityToChooseFiles", () => {
        test("runs the validation when an editor is active and the dialog is confirmed", async () => {
            window.activeTextEditor = { document: { uri: { fsPath: "/ws/map.fml" } } };
            sinon.stub(val, "isPackagePath").resolves(true);
            sinon.stub(val, "openFileDialog").resolves(true);
            const perform = sinon.stub(priv(val), "performValidation").resolves();

            await val.validateWithPossibilityToChooseFiles();

            assert.strictEqual(perform.calledOnce, true);
        });

        test("does not validate when the dialog is cancelled", async () => {
            window.activeTextEditor = { document: { uri: { fsPath: "/ws/map.fml" } } };
            sinon.stub(val, "isPackagePath").resolves(true);
            sinon.stub(val, "openFileDialog").resolves(false);
            const perform = sinon.stub(priv(val), "performValidation").resolves();

            await val.validateWithPossibilityToChooseFiles();

            assert.strictEqual(perform.called, false);
        });
    });

    suite("checkPackagePath / checkPackagePathWarningMessage", () => {
        test("warning variant returns true and stays silent when the package exists", async () => {
            sinon.stub(val, "isPackagePath").resolves(true);
            const warn = sinon.stub(window, "showWarningMessage");
            assert.strictEqual(await val.checkPackagePathWarningMessage(), true);
            assert.strictEqual(warn.called, false);
        });

        test("warning variant returns false and warns when the package is missing", async () => {
            sinon.stub(val, "isPackagePath").resolves(false);
            const warn = sinon.stub(window, "showWarningMessage");
            assert.strictEqual(await val.checkPackagePathWarningMessage(), false);
            assert.strictEqual(warn.calledOnce, true);
        });

        test("error variant returns false and shows an error when the package is missing", async () => {
            sinon.stub(val, "isPackagePath").resolves(false);
            const err = sinon.stub(window, "showErrorMessage");
            assert.strictEqual(await val.checkPackagePath(), false);
            assert.strictEqual(err.calledOnce, true);
        });

        test("error variant returns true when the package exists", async () => {
            sinon.stub(val, "isPackagePath").resolves(true);
            assert.strictEqual(await val.checkPackagePath(), true);
        });
    });

    suite("openFileDialog", () => {
        test("stores the chosen file and returns true", async () => {
            sinon.stub(window, "showOpenDialog").resolves([Uri.file("/data/in.json")]);
            assert.strictEqual(await val.openFileDialog(), true);
        });

        test("returns false when the dialog is dismissed", async () => {
            sinon.stub(window, "showOpenDialog").resolves(undefined);
            assert.strictEqual(await val.openFileDialog(), false);
        });
    });

    suite("isPackagePath", () => {
        test("resolves true when fs.access succeeds", async () => {
            setWorkspaceFolders(["/ws"]);
            sinon
                .stub(fs, "access")
                .callsFake(((_p: string, _mode: number, cb: (err: unknown) => void) =>
                    cb(null)) as unknown as typeof fs.access);
            assert.strictEqual(await val.isPackagePath(), true);
        });

        test("resolves false when fs.access reports an error", async () => {
            sinon
                .stub(fs, "access")
                .callsFake(((_p: string, _mode: number, cb: (err: unknown) => void) =>
                    cb(new Error("ENOENT"))) as unknown as typeof fs.access);
            assert.strictEqual(await val.isPackagePath(), false);
        });
    });
});
