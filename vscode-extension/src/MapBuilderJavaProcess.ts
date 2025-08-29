import {execSync, spawnSync, spawn} from "node:child_process";
import {existsSync, accessSync, constants} from "fs";
import {ApiConstants} from "./constants/ApiConstants";
import {extensions, OutputChannel, window, workspace, WorkspaceConfiguration} from "vscode";
import {logData} from "./utils";
import {UiConstants} from "./constants/UiConstants";
import path from "path";

export class MapBuilderJavaProcess {

    mapBuilderValidationLogger: OutputChannel;
    config: WorkspaceConfiguration;

    constructor(validationOutputChannel: OutputChannel) {
        this.mapBuilderValidationLogger = validationOutputChannel;
        this.config = workspace.getConfiguration(UiConstants.configName);
    }

    public start(): void {
        const {command, args} = this.buildShellCommand();
        if (command === null) {
            return;
        }
        window.showInformationMessage("Starting matchbox java process");
        logData(`Starting java process - cmd: ${command} ${args.join(" ")}`, this.mapBuilderValidationLogger);

        const javaProcess = spawn(command, args, {shell: true});

        javaProcess.stdout.on("data", (data) => {
            const logEntry = data.toString();
            this.mapBuilderValidationLogger.appendLine(logEntry);
            const initAppLogMessage = this.extractLogMessage(logEntry);
            if (initAppLogMessage) {
                window.showInformationMessage(initAppLogMessage);
            }
        });

        javaProcess.stderr.on("data", (data) => {
            this.mapBuilderValidationLogger.appendLine(data.toString());
        });

        javaProcess.on("close", (code) => {
            logData(`Java process exited with code ${code}`, this.mapBuilderValidationLogger);
        });

        javaProcess.on("error", (error) => {
            logData(`Error starting Java process, message: ${error.message}`, this.mapBuilderValidationLogger);
        });
    }

    private buildShellCommand() {
        const jarName = this.config.get("jarName") === "" ? "fhir-mapbuilder-validation" : this.config.get("jarName");

        const jarPath = path.join(
            extensions.getExtension(UiConstants.extensionPublisher)?.extensionPath || "",
            "target",
            `${jarName}.jar`
        );

        const args = [
            `-Dserver.port=${ApiConstants.apiServerPort}`,
            `-Dfile.encoding=UTF-8`,
            "-jar",
            jarPath
        ];

        const workspaceFolders = workspace.workspaceFolders;
        const includeWorkingPackage = this.config.get("IncludeWorkingPackage") ?? true;

        if (workspaceFolders && workspaceFolders.length > 0 && includeWorkingPackage) {
            const packagePath = path.join(workspaceFolders[0].uri.fsPath, "output", "package.tgz");
            args.push("-ig", packagePath);
        }

        const command = this.validateJavaPath(this.config.get<string>("javaExecutablePath"));
        return {command, args};
    }

    private isFileExists(path: string): boolean {
        return existsSync(path);
    }

    private isFileExecutable(path: string): boolean {
        try {
            accessSync(path, constants.X_OK);
            return true;
        }
        catch {
            return process.platform === "win32" && path.endsWith(".exe");
        }
    }

    private isJavaValid(path: string): boolean {
        if (!(path.endsWith("java.exe") || path.endsWith("java"))) {
            const msg = "File is not a java program.";
            window.showErrorMessage(msg);
            logData(msg, this.mapBuilderValidationLogger);
            return false;
        }
    
        const result = spawnSync(path, ["-version"], { encoding: "utf8" });
        
        if (result.error) {
            const msg = "File is not a valid binary.";
            window.showErrorMessage(msg);
            logData(msg, this.mapBuilderValidationLogger);
            return false;
        }
    
        logData(`Java version output: ${result.stderr}`, this.mapBuilderValidationLogger);
        const match = result.stderr.match(/version\s+"(\d+)/);
        const version = match ? parseInt(match[1], 10) : null;
        if (!version || version < 21) {
            const msg = `Invalid Java version. Expected >= 21, got ${version ?? "unknown"}`;
            window.showErrorMessage(msg);
            logData(msg, this.mapBuilderValidationLogger);
            return false;
        }
        return true;
    }

    private validateJavaPath(path: string | undefined): string | null {
        if (path === null || path === undefined || path === '') {
            path = "java";
            if (!this.isJavaValid(path)) {
                return null;
            }
            return path;
        }
        if (!(this.isFileExists(path))) {
            const msg = "File does not exist.";
            window.showErrorMessage(msg);
            logData(msg, this.mapBuilderValidationLogger);
            return null;
        } 
        if (!(this.isFileExecutable(path))) {
            const msg = "File is not executable.";
            window.showErrorMessage(msg);
            logData(msg, this.mapBuilderValidationLogger);
            return null;
        }
        
        if (this.isJavaValid(path)) {
            return `"${path}"`;   
        }

        return null;
    }

    private extractLogMessage(log: string): string | null {
        const keyword = "Started MatchBoxApplication in";
        const index = log.indexOf(keyword);
        return index !== -1 ? log.substring(index) : null;
    }
}
