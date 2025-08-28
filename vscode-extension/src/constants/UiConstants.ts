import * as vscode from 'vscode';

export class UiConstants {
    public static readonly extensionPublisher = 'aphp.fhir-mapbuilder';
    public static readonly configName = 'FhirMapBuilder';
    public static readonly principalChannelTitle = "FHIR MapBuilder";
    public static readonly detailsChannelTitle = "FHIR MapBuilder Service";
    public static readonly principalChannel = vscode.window.createOutputChannel(UiConstants.principalChannelTitle);
    public static readonly detailsChannel = vscode.window.createOutputChannel(UiConstants.detailsChannelTitle);
    public static readonly fmlFilesPathToWatch = '**/*.fml';
    public static readonly qaPathToWatch = '**/output/qa.json';
}
