import * as vscode from 'vscode';
import {OutputChannel} from 'vscode';
import {FmlCompletionProvider} from './FmlCompletionProvider';
import {FhirDefinition} from './FhirDefinition';
import {FmlValidation} from './FmlValidation';
import {MapBuilderJavaProcess} from "./MapBuilderJavaProcess";
import {MapBuilderValidationApi} from "./MapBuilderValidationApi";
import {MapBuilderWatcher} from "./MapBuilderWatcher";
import {UiConstants} from "./constants/UiConstants";

const FML_MODE = {language: 'fml', scheme: 'file'};
let watcher: MapBuilderWatcher;

export async function activate(context: vscode.ExtensionContext): Promise<{
    completionProviderInstance: FmlCompletionProvider | null;
}> {

    try {
        const principalChannel = UiConstants.principalChannel;
        const detailsChannel = UiConstants.detailsChannel;

        const api = await getMapBuilderValidationApi(detailsChannel);

        const [, completionProviderInstance] = addAutoComplete(principalChannel, context);

        addFMLTemplate(context);

        addValidationCommand(principalChannel, api, context);

        addValidationWithDefaultFilesCommand(principalChannel, api, context);

        addValidationAfterLoadingPackageCommand(principalChannel, api, context);

        addWatcher(detailsChannel, api);

        return {completionProviderInstance};

    } catch (err) {
        return {completionProviderInstance: null};
    }
}

export function deactivate() {
    watcher?.dispose();
    const api = new MapBuilderValidationApi(UiConstants.detailsChannel);
    api.callShutDownProcess();
}

async function getMapBuilderValidationApi(validationOutputChannel: OutputChannel): Promise<MapBuilderValidationApi> {
    const mapBuilderJavaProcess = new MapBuilderJavaProcess(validationOutputChannel);

    const hasGoodJavaVersion = await mapBuilderJavaProcess.checkJavaVersionAndWarn();

    const api = new MapBuilderValidationApi(validationOutputChannel);

    if (hasGoodJavaVersion) {
        const isAppRunning = await api.isAppRunning();
        if (!isAppRunning) {
            mapBuilderJavaProcess.start();
        }
    }

    return api;
}

function addWatcher(principalChannel: OutputChannel, api: MapBuilderValidationApi) {
    watcher = new MapBuilderWatcher(principalChannel, api);
}

function addAutoComplete(outputChannel: OutputChannel, context: vscode.ExtensionContext): [FhirDefinition, FmlCompletionProvider] {
    const fhirDefinitionInstance = new FhirDefinition(outputChannel);
    const completionProviderInstance = new FmlCompletionProvider(fhirDefinitionInstance, outputChannel);

    context.subscriptions.push(
        vscode.languages.registerCompletionItemProvider(FML_MODE, completionProviderInstance, '.')
    );

    return [fhirDefinitionInstance, completionProviderInstance];
}

function addFMLTemplate(context: vscode.ExtensionContext) {
    context.subscriptions.push(vscode.commands.registerCommand('fhirMapBuilder.InsertTemplate', () => {
        if (vscode.window.activeTextEditor) {
            vscode.languages.setTextDocumentLanguage(vscode.window.activeTextEditor.document, FML_MODE.language as string);
            vscode.commands.executeCommand("editor.action.insertSnippet", {"name": "Template"});
        }
    }));
}

function addValidationCommand(outputChannel: OutputChannel, mapBuilderValidationApi: MapBuilderValidationApi, context: vscode.ExtensionContext) {
    context.subscriptions.push(vscode.commands.registerCommand('fhirMapBuilder.Validation', async () => {

        const fmlValidation = new FmlValidation(outputChannel, mapBuilderValidationApi);
        await fmlValidation.validateWithPossibilityToChooseFiles();
    }));
}

function addValidationWithDefaultFilesCommand(outputChannel: OutputChannel, mapBuilderValidationApi: MapBuilderValidationApi, context: vscode.ExtensionContext) {
    context.subscriptions.push(vscode.commands.registerCommand('fhirMapBuilder.ValidationWithDefaultFiles', async () => {

        const fmlValidation = new FmlValidation(outputChannel, mapBuilderValidationApi);
        await fmlValidation.validateWithDefaultFiles();

    }));
}

function addValidationAfterLoadingPackageCommand(
    outputChannel: OutputChannel,
    mapBuilderValidationApi: MapBuilderValidationApi,
    context: vscode.ExtensionContext
) {
    context.subscriptions.push(
        vscode.commands.registerCommand(
            'fhirMapBuilder.ValidationAfterLoadingPackage',
            async () => {
                const fmlValidation = new FmlValidation(outputChannel, mapBuilderValidationApi);
                const isPackagePath = await fmlValidation.checkPackagePath();
                if (isPackagePath) {
                    await fmlValidation.loadPackage();
                    await fmlValidation.validateWithPossibilityToChooseFiles();
                }
            }
        )
    );
}

