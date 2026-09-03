/**
 * Unit suite for `src/MapBuilderJavaProcess.ts` (spec #143, ticket #148) —
 * out-of-host, `vscode` stubbed by `_setup.ts`. Target: >= 80 % line coverage.
 */
import * as assert from "assert";
import * as sinon from "sinon";
import { EventEmitter } from "events";
import fs from "fs";
import type * as ChildProcessNS from "node:child_process";
import type { OutputChannel } from "vscode";

// Raw require (not `import * as`): the star import is wrapped by `__importStar`
// into a copy with non-configurable getters that sinon cannot stub. This shares
// the module-cache object the SUT holds.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const childProcess: typeof ChildProcessNS = require("node:child_process");
import { MapBuilderJavaProcess } from "../../MapBuilderJavaProcess";
import { resetVscodeMock, setConfig, setInstalledExtension, setWorkspaceFolders, window } from "./vscode.mock";

function makeLogger(): OutputChannel {
    return { appendLine: sinon.spy() } as unknown as OutputChannel;
}

function priv(instance: MapBuilderJavaProcess): Record<string, (...args: unknown[]) => unknown> {
    return instance as unknown as Record<string, (...args: unknown[]) => unknown>;
}

suite("MapBuilderJavaProcess", () => {
    let proc: MapBuilderJavaProcess;

    setup(() => {
        proc = new MapBuilderJavaProcess(makeLogger());
        sinon.stub(console, "error");
    });

    teardown(() => {
        sinon.restore();
        resetVscodeMock();
    });

    suite("extractLogMessage", () => {
        test("returns the tail from the startup keyword", () => {
            const msg = priv(proc).extractLogMessage("noise Started MatchBoxApplication in 4.2 seconds");
            assert.strictEqual(msg, "Started MatchBoxApplication in 4.2 seconds");
        });

        test("returns null when the keyword is absent", () => {
            assert.strictEqual(priv(proc).extractLogMessage("nothing to see"), null);
        });
    });

    suite("getJavaVmArgs", () => {
        test("returns [] when the setting is empty", () => {
            assert.deepStrictEqual(priv(proc).getJavaVmArgs(), []);
        });

        test("splits the setting on whitespace", () => {
            setConfig("javaVmArgs", "-Xmx4g   -Xms512m");
            assert.deepStrictEqual(priv(proc).getJavaVmArgs(), ["-Xmx4g", "-Xms512m"]);
        });
    });

    suite("isFileExists / isFileExecutable", () => {
        test("isFileExists delegates to existsSync", () => {
            sinon.stub(fs, "existsSync").returns(true);
            assert.strictEqual(priv(proc).isFileExists("/x"), true);
        });

        test("isFileExecutable is true when accessSync succeeds", () => {
            sinon.stub(fs, "accessSync").returns(undefined);
            assert.strictEqual(priv(proc).isFileExecutable("/bin/java"), true);
        });

        test("isFileExecutable falls back to the .exe rule when accessSync throws", () => {
            sinon.stub(fs, "accessSync").throws(new Error("EACCES"));
            const expected = process.platform === "win32";
            assert.strictEqual(priv(proc).isFileExecutable("C:/java/java.exe"), expected);
            assert.strictEqual(priv(proc).isFileExecutable("/opt/java/bin/java"), false);
        });
    });

    suite("isJavaValid", () => {
        test("rejects a path that is not a java binary", () => {
            const err = sinon.stub(window, "showErrorMessage");
            assert.strictEqual(priv(proc).isJavaValid("/usr/bin/node"), false);
            assert.strictEqual(err.calledOnce, true);
        });

        test("rejects when spawnSync reports an error", () => {
            sinon.stub(window, "showErrorMessage");
            sinon.stub(childProcess, "spawnSync").returns({ error: new Error("ENOENT") } as never);
            assert.strictEqual(priv(proc).isJavaValid("/usr/bin/java"), false);
        });

        test("rejects a version below 21", () => {
            sinon.stub(window, "showErrorMessage");
            sinon.stub(childProcess, "spawnSync").returns({ stderr: 'openjdk version "17.0.9"' } as never);
            assert.strictEqual(priv(proc).isJavaValid("/usr/bin/java"), false);
        });

        test("rejects when no version can be parsed", () => {
            sinon.stub(window, "showErrorMessage");
            sinon.stub(childProcess, "spawnSync").returns({ stderr: "no version string" } as never);
            assert.strictEqual(priv(proc).isJavaValid("/usr/bin/java"), false);
        });

        test("accepts java 21+", () => {
            sinon.stub(childProcess, "spawnSync").returns({ stderr: 'openjdk version "21.0.2"' } as never);
            assert.strictEqual(priv(proc).isJavaValid("/usr/bin/java"), true);
        });
    });

    suite("validateJavaPath", () => {
        test("uses the bare `java` command when no path is configured", () => {
            sinon.stub(priv(proc), "isJavaValid").returns(true);
            assert.strictEqual(priv(proc).validateJavaPath(""), "java");
        });

        test("returns null when the bare `java` command is invalid", () => {
            sinon.stub(priv(proc), "isJavaValid").returns(false);
            assert.strictEqual(priv(proc).validateJavaPath(undefined), null);
        });

        test("returns null for a path that does not exist", () => {
            sinon.stub(window, "showErrorMessage");
            sinon.stub(priv(proc), "isFileExists").returns(false);
            assert.strictEqual(priv(proc).validateJavaPath("/no/java"), null);
        });

        test("returns null for a path that is not executable", () => {
            sinon.stub(window, "showErrorMessage");
            sinon.stub(priv(proc), "isFileExists").returns(true);
            sinon.stub(priv(proc), "isFileExecutable").returns(false);
            assert.strictEqual(priv(proc).validateJavaPath("/opt/java"), null);
        });

        test("returns the quoted path for a valid java binary", () => {
            sinon.stub(priv(proc), "isFileExists").returns(true);
            sinon.stub(priv(proc), "isFileExecutable").returns(true);
            sinon.stub(priv(proc), "isJavaValid").returns(true);
            assert.strictEqual(priv(proc).validateJavaPath("/opt/java/bin/java"), '"/opt/java/bin/java"');
        });

        test("returns null when a resolvable path is not a valid java binary", () => {
            sinon.stub(priv(proc), "isFileExists").returns(true);
            sinon.stub(priv(proc), "isFileExecutable").returns(true);
            sinon.stub(priv(proc), "isJavaValid").returns(false);
            assert.strictEqual(priv(proc).validateJavaPath("/opt/java/bin/java"), null);
        });
    });

    suite("buildShellCommand", () => {
        test("uses the default jar name and skips -ig without a workspace", () => {
            setConfig("jarName", "");
            sinon.stub(priv(proc), "validateJavaPath").returns("java");

            const { command, args } = priv(proc).buildShellCommand() as { command: string; args: string[] };

            assert.strictEqual(command, "java");
            assert.ok(args.includes("-jar"));
            assert.ok(args.some((a) => a.endsWith("fhir-mapbuilder-validation.jar")));
            assert.strictEqual(args.includes("-ig"), false);
        });

        test("adds -ig <package> when a workspace is open and the package is included", () => {
            setConfig("jarName", "custom");
            setConfig("IncludeWorkingPackage", true);
            setWorkspaceFolders(["/ws"]);
            setInstalledExtension({ extensionPath: "/ext" });
            sinon.stub(priv(proc), "validateJavaPath").returns("java");

            const { args } = priv(proc).buildShellCommand() as { args: string[] };

            const igIndex = args.indexOf("-ig");
            assert.ok(igIndex >= 0);
            assert.ok(args[igIndex + 1].endsWith("package.tgz"));
        });
    });

    suite("start", () => {
        function fakeProcess(): ChildProcessNS.ChildProcess {
            const cp = new EventEmitter() as ChildProcessNS.ChildProcess;
            (cp as unknown as { stdout: EventEmitter }).stdout = new EventEmitter();
            (cp as unknown as { stderr: EventEmitter }).stderr = new EventEmitter();
            return cp;
        }

        test("returns early when the command cannot be resolved", () => {
            sinon.stub(priv(proc), "buildShellCommand").returns({ command: null, args: [] });
            const spawn = sinon.stub(childProcess, "spawn");
            proc.start();
            assert.strictEqual(spawn.called, false);
        });

        test("spawns the process and wires stdout/stderr/close/error handlers", () => {
            sinon.stub(priv(proc), "buildShellCommand").returns({ command: "java", args: ["-jar", "x.jar"] });
            const cp = fakeProcess();
            sinon.stub(childProcess, "spawn").returns(cp);
            const info = sinon.stub(window, "showInformationMessage");

            proc.start();

            (cp as unknown as { stdout: EventEmitter }).stdout.emit(
                "data",
                Buffer.from("... Started MatchBoxApplication in 3s"),
            );
            (cp as unknown as { stderr: EventEmitter }).stderr.emit("data", Buffer.from("a warning"));
            cp.emit("close", 0);
            cp.emit("error", new Error("spawn failed"));

            // "Starting matchbox java process" + the extracted startup line
            assert.ok(info.callCount >= 2);
        });
    });
});
