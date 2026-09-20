import axios from "axios";
import { ApiConstants } from "./constants/ApiConstants";
import { API_TOKEN_HEADER } from "./ApiToken";
import { OutputChannel, window, workspace } from "vscode";
import os from "os";
import { getDataFile, logData } from "./utils";
import path from "path";

const PROBE_TIMEOUT_MS = 5000;

export class MapBuilderValidationApi {
    mapBuilderValidationLogger: OutputChannel;
    private readonly apiToken: string;
    private readonly onTokenMismatch: () => void;
    private tokenMismatch = false;

    constructor(validationOutputChannel: OutputChannel, apiToken: string, onTokenMismatch: () => void = () => {}) {
        this.apiToken = apiToken;
        this.mapBuilderValidationLogger = validationOutputChannel;
        this.onTokenMismatch = onTokenMismatch;
    }

    // Ask the running server whether it accepts our token. /health is open, so a parameterless call to a protected
    // endpoint is the probe: the token filter answers 401 before any parameter is bound.
    public async probeToken(): Promise<void> {
        if (this.tokenMismatch) {
            return;
        }
        try {
            const response = await axios.get(ApiConstants.parseUrl, {
                ...this.authConfig(),
                timeout: PROBE_TIMEOUT_MS,
                validateStatus: () => true,
            });
            if (response.status === 401) {
                this.reportTokenMismatch();
            }
        } catch {
            // Unreachable or too slow: inconclusive, the regular calls report their own failures
        }
    }

    // Once per window: the fix is to stop the other server and reload, which builds a new API
    private reportTokenMismatch(): void {
        if (this.tokenMismatch) {
            return;
        }
        this.tokenMismatch = true;
        this.onTokenMismatch();
    }

    private checkTokenRejected(error: unknown): void {
        if (axios.isAxiosError(error) && error.response?.status === 401) {
            this.reportTokenMismatch();
        }
    }

    // A rejected token cannot succeed on retry: skip the request instead of stacking 401s in the log
    private skipBecauseTokenRejected(): boolean {
        if (this.tokenMismatch) {
            logData(
                `Skipped: the server on port ${ApiConstants.apiServerPort} rejected the API token.`,
                this.mapBuilderValidationLogger,
            );
        }
        return this.tokenMismatch;
    }

    // Call the matchbox to validate structure map
    public async callValidateStructureMap(): Promise<boolean> {
        if (this.skipBecauseTokenRejected()) {
            return false;
        }
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
            const response = await axios.get(url, this.authConfig());
            const result = `Validation response Status: ${response.status}, Validation response data: ${response.data}`;
            logData(result, this.mapBuilderValidationLogger);
            return true;
        } catch (error) {
            this.checkTokenRejected(error);
            const result = `Error invoking matchbox validate: ${error}`;
            logData(result, this.mapBuilderValidationLogger);
            return false;
        }
    }

    // Call the matchbox to parse structure map
    public async callParseStructureMap(filePath: string): Promise<boolean> {
        if (this.skipBecauseTokenRejected()) {
            return false;
        }
        try {
            const isRunning = await this.isAppRunning();
            if (!isRunning) {
                // Wait for the Java process to initialize
                logData(`Waiting for the java application to start...`, this.mapBuilderValidationLogger);
                await this.waitForJavaAppReady();
            }
            const url = `${ApiConstants.parseUrl}?source=${encodeURIComponent(filePath)}`;
            logData(`Invoking matchbox parse: URL= ${url}`, this.mapBuilderValidationLogger);
            const response = await axios.get(url, this.authConfig());
            const result = `Parsing response status: ${response.status}, Parsing response data: ${response.data}`;
            logData(result, this.mapBuilderValidationLogger);
            return response.status === 200;
        } catch (error) {
            this.checkTokenRejected(error);
            const result = `Error invoking matchbox parsing: ${error}`;
            logData(result, this.mapBuilderValidationLogger);
            return false;
        }
    }

    // Call the matchbox validation to reset and load engine
    public async callResetAndLoadEngine(): Promise<string | null> {
        if (this.skipBecauseTokenRejected()) {
            return null;
        }
        try {
            const isRunning = await this.isAppRunning();
            if (!isRunning) {
                // Wait for the Java process to initialize
                logData(`Waiting for the java application to start...`, this.mapBuilderValidationLogger);
                await this.waitForJavaAppReady();
            }
            const url = this.buildResetAndLoadEngineUrl();
            logData(`Invoking matchbox reset and load engine: URL= ${url}`, this.mapBuilderValidationLogger);
            const response = await axios.get(url, this.authConfig());
            return this.getPackageLoadedSuccessMessage(response.data);
        } catch (error) {
            this.checkTokenRejected(error);
            const result = `Error invoking matchbox reset and load engine: ${error}`;
            logData(result, this.mapBuilderValidationLogger);
            return null;
        }
    }

    // Call the matchbox validation and kill the process
    public callShutDownProcess() {
        axios.get(ApiConstants.shutDownUrl, this.authConfig());
    }

    // The token goes on every call except the open /health endpoint
    private authConfig() {
        return { headers: { [API_TOKEN_HEADER]: this.apiToken } };
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
        const workspaceFolders = workspace.workspaceFolders;

        if (workspaceFolders && workspaceFolders.length > 0) {
            const packagePath = path.join(workspaceFolders[0].uri.fsPath, "output", "package.tgz");
            url = `${url}?path=${encodeURIComponent(packagePath)}`;
        }

        return url;
    }

    private buildValidateUrl(): string {
        let url = ApiConstants.validateUrl;

        const sourcePath = this.getSourceFilePath();

        url = `${url}?source=${encodeURIComponent(sourcePath)}`;

        const dataFile = getDataFile();
        if (dataFile) {
            url = this.appendUrlParameter(url, "data", dataFile);
        }

        const outputPath = this.getWorkspacePathOrHomeDir();
        if (outputPath) {
            const outputFolderName = "fml-generated";
            const output = path.join(outputPath, outputFolderName);
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
            } catch {
                // Log errors but continue polling
                logData(
                    `Waiting for java application. Attempt ${retries + 1}/${maxRetries} failed.`,
                    this.mapBuilderValidationLogger,
                );
            }

            retries++;
            await new Promise((resolve) => setTimeout(resolve, intervalMs)); // Wait before retrying
        }

        throw new Error("Java application failed to start within the expected time.");
    }

    private getWorkspacePathOrHomeDir(): string {
        const workspaceFolders = workspace.workspaceFolders;
        return workspaceFolders ? workspaceFolders[0].uri.fsPath : os.homedir();
    }

    private getSourceFilePath(): string {
        const activeDocUri = window.activeTextEditor?.document.uri;

        if (!activeDocUri) {
            return "";
        }
        return activeDocUri.fsPath;
    }
    private getPackageLoadedSuccessMessage(isLoaded: boolean): string | null {
        const workspaceFolders = workspace.workspaceFolders;
        if (isLoaded && workspaceFolders && workspaceFolders.length > 0) {
            const packagePath = path.join(workspaceFolders[0].uri.fsPath, "output", "package.tgz");
            return `New package loading completed successfully. Package path: ${packagePath}`;
        }
        return null;
    }
}
