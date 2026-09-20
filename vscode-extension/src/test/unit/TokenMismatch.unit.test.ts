/**
 * Unit suite for `src/TokenMismatch.ts` (#203) — out-of-host, `vscode` stubbed by `_setup.ts`.
 */
import * as assert from "assert";
import * as sinon from "sinon";
import type { OutputChannel } from "vscode";
import { notifyTokenMismatch } from "../../TokenMismatch";
import { commands, window } from "./vscode.mock";
import { standardTeardown } from "./_helpers";

suite("notifyTokenMismatch", () => {
    let lines: string[];
    let show: sinon.SinonSpy;
    let channel: OutputChannel;
    let showError: sinon.SinonStub;
    let execute: sinon.SinonStub;

    setup(() => {
        lines = [];
        show = sinon.spy();
        channel = { appendLine: (l: string) => lines.push(l), show } as unknown as OutputChannel;
        showError = sinon.stub(window, "showErrorMessage").resolves(undefined);
        execute = sinon.stub(commands, "executeCommand").resolves(undefined);
    });

    teardown(standardTeardown);

    test("shows one error naming the port, with the log and port setting buttons", async () => {
        await notifyTokenMismatch(channel, 9031);

        assert.strictEqual(showError.callCount, 1);
        const [message, ...buttons] = showError.firstCall.args as string[];
        assert.match(message, /port 9031/);
        assert.match(message, /different API token/);
        assert.deepStrictEqual(buttons, ["Show log", "Open port setting"]);
    });

    test("writes the recovery steps to the log", async () => {
        await notifyTokenMismatch(channel, 9031);

        const log = lines.join("\n");
        assert.match(log, /port 9031/);
        assert.match(log, /netstat -ano/);
        assert.match(log, /FhirMapBuilder\.port/);
        assert.match(log, /reload/i);
    });

    test("Show log reveals the log", async () => {
        showError.resolves("Show log");
        await notifyTokenMismatch(channel, 9031);
        assert.strictEqual(show.calledOnce, true);
        assert.strictEqual(execute.called, false);
    });

    test("Open port setting opens the port setting", async () => {
        showError.resolves("Open port setting");
        await notifyTokenMismatch(channel, 9031);
        assert.deepStrictEqual(execute.firstCall.args, ["workbench.action.openSettings", "FhirMapBuilder.port"]);
        assert.strictEqual(show.called, false);
    });

    test("dismissing the message does nothing more", async () => {
        showError.resolves(undefined);
        await notifyTokenMismatch(channel, 9031);
        assert.strictEqual(show.called, false);
        assert.strictEqual(execute.called, false);
    });
});
