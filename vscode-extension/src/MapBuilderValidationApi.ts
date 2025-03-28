import axios from "axios";
import {ApiConstants} from "./ApiConstants";
import {OutputChannel, window, workspace} from "vscode";
import os from "os";
import {logData} from "./utils";

export class MapBuilderValidationApi {

    mapBuilderValidationLogger: OutputChannel;


    constructor(validationOutputChannel: OutputChannel) {
        this.mapBuilderValidationLogger = validationOutputChannel;
    }

    // Call the matchbox to validate structure map
    public async callValidateStructureMap(): Promise<boolean> {
        try {
            const isRunning = await this.isAppRunning();
            if (!isRunning) {
                // Wait for the Java process to initialize
                logData(`Waiting for the java application to start...`, this.mapBuilderValidationLogger);
                await this.waitForJavaAppReady();
            } else {
                logData(`Java application is already running.`, this.mapBuilderValidationLogger);
            }

            const url = this.buildValidateUrl();
            logData(`Invoking matchbox validate: URL= ${url}`, this.mapBuilderValidationLogger);
            const response = await axios.get(url);
            const result = `Validation response Status: ${response.status}, Validation response data: ${response.data}`;
            logData(result, this.mapBuilderValidationLogger);
            return true;
        } catch (error) {
            const result = `Error invoking matchbox validate: ${error}`;
            logData(result, this.mapBuilderValidationLogger);
            return false;
        }
    }

    // Call the matchbox validation to reset and load engine
    public async callResetAndLoadEngine(): Promise<string | null> {
        try {
            const url = this.buildResetAndLoadEngineUrl();
            logData(`Invoking matchbox reset and load engine: URL= ${url}`, this.mapBuilderValidationLogger);
            const response = await axios.get(url);
            return this.getPackageLoadedSuccessMessage(response.data);
        } catch (error) {
            const result = `Error invoking matchbox reset and load engine: ${error}`;
            logData(result, this.mapBuilderValidationLogger);
            return null;
        }
    }

// Call the matchbox validation and kill the process
    public callShutDownProcess() {
        axios.get(ApiConstants.shutDownUrl);
    }

    // Check if the Java application is running
    public async isAppRunning(): Promise<boolean> {
        try {
            const response = await axios.get(ApiConstants.healthCheckUrl);
            return response.status === 200; // Health check is successful
        } catch {
            return false; // Health check failed
        }
    }

    private buildResetAndLoadEngineUrl(): string {
        let url = ApiConstants.resetAndLoadEngineUrl;
        let workspaceFolders = workspace.workspaceFolders;
        if (workspaceFolders && workspaceFolders.length > 0) {
            const packagePath = `${workspaceFolders[0].uri.fsPath}\\output\\package.tgz`;
            url = `${url}?path=${encodeURIComponent(packagePath)}`;
        }
        return url;
    }

    private buildValidateUrl(): string {
        let url = ApiConstants.validateUrl;

        // Retrieve configuration values
        const outputFolderName = "fml-generated";

        const outputPath = this.getWorkspacePathOrHomeDir();

        // Get source file path
        const sourcePath = this.getSourceFilePath();

        // Append parameters to the URL
        url = `${url}?source=${encodeURIComponent(sourcePath)}`;

        const config = workspace.getConfiguration('MapBuilder');
        const dataFile: any = config?.get("dataFile");
        if (dataFile) {
            url = this.appendUrlParameter(url, "data", dataFile);
        }
        if (outputPath) {
            const output = `${outputPath}\\${outputFolderName}`;
            url = this.appendUrlParameter(url, "output", output);
        }

        return url;
    }

    private appendUrlParameter(url: string, key: string, value: string): string {
        return `${url}&${key}=${encodeURIComponent(value)}`;
    }

    private async waitForJavaAppReady(maxRetries: number = 20, intervalMs: number = 20000): Promise<void> {
        let retries = 0;

        while (retries < maxRetries) {
            try {
                const response = await axios.get(ApiConstants.healthCheckUrl);
                if (response.status === 200) {
                    logData(`Java application is ready...`, this.mapBuilderValidationLogger);
                    return; // App is ready
                }
            } catch (error) {
                // Log errors but continue polling
                logData(`Waiting for Java application. Attempt ${retries + 1}/${maxRetries} failed.`, this.mapBuilderValidationLogger);
            }

            retries++;
            await new Promise((resolve) => setTimeout(resolve, intervalMs)); // Wait before retrying
        }

        throw new Error('Java application failed to start within the expected time.');
    }


    private getWorkspacePathOrHomeDir(): string {
        const workspaceFolders = workspace.workspaceFolders;
        return workspaceFolders ? workspaceFolders[0].uri.fsPath : os.homedir();
    }

    private getSourceFilePath(): string {
        let targetPath = window.activeTextEditor?.document.uri.path || "";
        if (targetPath.startsWith("/")) {
            targetPath = targetPath.slice(1); // Remove leading slash
        }
        return targetPath.replaceAll("/", "\\");
    }

    private getPackageLoadedSuccessMessage(isLoaded: boolean): string | null {
        let workspaceFolders = workspace.workspaceFolders;
        if (isLoaded && workspaceFolders && workspaceFolders.length > 0) {
            const packagePath = `${workspaceFolders[0].uri.fsPath}\\output\\package.tgz`;
            return `New package loading completed successfully. Package path: ${packagePath}`;
        }
        return null;
    }

}
