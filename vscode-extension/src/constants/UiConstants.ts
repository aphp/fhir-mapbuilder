import * as vscode from 'vscode';

export class UiConstants {
    public static readonly extensionPublisher = 'aphp.fhir-mapbuilder';
    public static readonly configName = 'FhirMapBuilder';
    public static readonly principalChannelName = "FhirMapBuilder";
    public static readonly detailsChannelName = "FhirMapBuilderValidation";
    public static readonly principalChannel = vscode.window.createOutputChannel(UiConstants.principalChannelName);
    public static readonly detailsChannel = vscode.window.createOutputChannel(UiConstants.detailsChannelName);
    public static readonly fmlFilesPathToWatch = '**/*.fml';
    public static readonly qaPathToWatch = '**/output/qa.json';
}
