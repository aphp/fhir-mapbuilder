/**
 * Shared fixtures for the out-of-host unit suites (spec #143).
 */
import * as sinon from "sinon";
import type { OutputChannel } from "vscode";
import { resetVscodeMock } from "./vscode.mock";

/** Standard `teardown` for a unit suite: restore sinon, reset the vscode mock. */
export function standardTeardown(): void {
    sinon.restore();
    resetVscodeMock();
}

/** A logger whose `appendLine` is a spy; everything else is absent. */
export function makeLogger(): OutputChannel {
    return { appendLine: sinon.spy() } as unknown as OutputChannel;
}

/** A logger that swallows output — use when the calls are not under assertion. */
export const noopChannel = { appendLine: () => {}, append: () => {} } as unknown as OutputChannel;

/** Cast an instance to a bag of callables for white-box testing of private members. */
export function priv<T>(instance: T): Record<string, (...args: unknown[]) => unknown> {
    return instance as unknown as Record<string, (...args: unknown[]) => unknown>;
}
