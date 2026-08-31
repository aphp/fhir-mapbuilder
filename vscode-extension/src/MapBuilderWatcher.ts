import vscode, { FileSystemWatcher, OutputChannel, TextDocument, Uri, workspace, WorkspaceConfiguration } from "vscode";
import { MapBuilderValidationApi } from "./MapBuilderValidationApi";
import { collectFilesWithExtension, executeWithProgress, logData } from "./utils";
import { UiConstants } from "./constants/UiConstants";

export class MapBuilderWatcher {
    logger: OutputChannel;
    config: WorkspaceConfiguration;
    api: MapBuilderValidationApi;
    fmlWatcher!: FileSystemWatcher;
    packageWatcher!: FileSystemWatcher;

    constructor(outputChannel: OutputChannel, mapBuilderValidationApi: MapBuilderValidationApi) {
        this.logger = outputChannel;
        this.config = workspace.getConfiguration(UiConstants.configName);
        this.api = mapBuilderValidationApi;
        this.fmlWatcher = workspace.createFileSystemWatcher(UiConstants.fmlFilesPathToWatch);
        this.fmlWatcher.onDidCreate((uri) => this.parseFmlFilesFromPath(uri, undefined, "add"), this);
        this.fmlWatcher.onDidChange((uri) => this.parseFmlFilesFromPath(uri, undefined, "change"), this);
        this.packageWatcher = workspace.createFileSystemWatcher(UiConstants.qaPathToWatch);
        this.packageWatcher.onDidChange(this.loadPackageAndParseFmlFiles, this);
        this.packageWatcher.onDidCreate(this.loadPackageAndParseFmlFiles, this);
        this.parseAllFmlFiles().then((nbFiles) => logData(`${nbFiles} have been successfully parsed!`, this.logger));
    }

    public async loadPackageAndParseFmlFiles() {
        await executeWithProgress("Loading new package in progress...", async () => {
            const message = await this.api.callResetAndLoadEngine();
            if (message) {
                logData(message, this.logger);
                this.parseAllFmlFiles().then((nbFiles) => logData(`${nbFiles} files are parsed!`, this.logger));
            } else {
                vscode.window.showErrorMessage("Failed to load package.");
            }
        });
    }

    public async parseFmlFilesFromPath(
        inputPath: string | Uri,
        document?: TextDocument,
        eventType: "add" | "change" = "add",
    ): Promise<number> {
        const targetPath = document?.uri.fsPath ?? (inputPath instanceof Uri ? inputPath.fsPath : inputPath);

        if (typeof targetPath !== "string") {
            return 0;
        }

        const fmlFilePaths: string[] = [];
        collectFilesWithExtension(targetPath, fmlFilePaths, ".fml");

        let parsedFileCount = 0;

        for (const filePath of fmlFilePaths) {
            const parseResult = await this.api.callParseStructureMap(filePath);

            if (parseResult) {
                parsedFileCount++;

                const logMessage =
                    eventType === "add"
                        ? `New file detected: ${filePath}. The StructureMap has been parsed.`
                        : `File updated: ${filePath}. As a result, the StructureMap has been parsed.`;

                logData(logMessage, this.logger);
            } else {
                const errorMessage = `Error parsing StructureMap in file ${filePath}.`;
                vscode.window.showErrorMessage(errorMessage);
            }
        }

        return parsedFileCount;
    }

    public async parseAllFmlFiles(): Promise<number> {
        const fmlFiles = this.getAllFmlFiles();
        let successfullyParsedCount = 0;

        for (const filePath of fmlFiles) {
            successfullyParsedCount += await this.parseFmlFilesFromPath(filePath);
        }

        return successfullyParsedCount;
    }

    private getAllFmlFiles() {
        const fmlFiles: string[] = [];
        workspace.workspaceFolders!.forEach((folder) => {
            const folderPath = folder.uri.fsPath;
            collectFilesWithExtension(folderPath, fmlFiles, ".fml");
        });
        return fmlFiles;
    }

    dispose() {
        this.fmlWatcher?.dispose();
        this.packageWatcher?.dispose();
    }
}
