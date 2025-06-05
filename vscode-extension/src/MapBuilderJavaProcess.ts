import {spawn} from "node:child_process";
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

        const command = "java"; // Java executable
        return { command, args };
    }


    private extractLogMessage(log: string): string | null {
        const keyword = "Started MatchBoxApplication in";
        const index = log.indexOf(keyword);
        return index !== -1 ? log.substring(index) : null;
    }
}
