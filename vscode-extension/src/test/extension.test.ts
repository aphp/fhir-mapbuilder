import * as assert from 'assert';
import * as vscode from 'vscode';
import {window} from 'vscode';
import * as sinon from 'sinon';
import {SinonStub} from 'sinon';
import {FmlValidation} from "../FmlValidation";
import {MapBuilderValidationApi} from "../MapBuilderValidationApi";
import {MapBuilderWatcher} from "../MapBuilderWatcher";
import {UiConstants} from "../constants/UiConstants";
import path from "path";

suite('Extension Test Suite', () => {
    vscode.window.showInformationMessage('Start Global tests.');

    test('Extension should be present', () => {
        const extension = vscode.extensions.getExtension(UiConstants.extensionPublisher);
        assert.ok(extension, 'Extension is not registered in VSCode');
    });

    test('Extension should activate on FML file', async () => {
        const extension = vscode.extensions.getExtension(UiConstants.extensionPublisher);
        if (!extension) {
            assert.fail('Extension not found');
        }

        const document = await vscode.workspace.openTextDocument({language: 'fml', content: ''});
        await vscode.window.showTextDocument(document);

        // Wait for the extension to be activated
        await vscode.extensions.getExtension(UiConstants.extensionPublisher)?.activate();

        assert.ok(extension.isActive, 'Extension did not activate when an FML file was opened');
    });


});

suite('Extension Commands Test Suite', () => {

    let showInformationMessageStub: sinon.SinonStub;
    let showErrorMessageStub: sinon.SinonStub;
    let fmlValidationInstance: FmlValidation;
    let mapBuilderWatcherInstance: MapBuilderWatcher;
    let mockApi: MapBuilderValidationApi;
    let fmlFileWatcherOnStub: sinon.SinonStub;
    let openFileDialog: sinon.SinonStub;


    setup(() => {
        showErrorMessageStub = sinon.stub(vscode.window, 'showErrorMessage').resolves(undefined);
        showInformationMessageStub = sinon.stub(window, 'showInformationMessage');

        // Mock the API
        mockApi = sinon.createStubInstance(MapBuilderValidationApi);

        fmlValidationInstance = new FmlValidation(vscode.window.createOutputChannel('test'), mockApi);


        fmlFileWatcherOnStub = sinon.stub();

        mapBuilderWatcherInstance = new MapBuilderWatcher(vscode.window.createOutputChannel('test'), mockApi);

        openFileDialog = sinon.stub(fmlValidationInstance, 'openFileDialog').resolves(true);

    });

    teardown(() => {
        // Restore all stubs
        sinon.restore();
    });


    test('Commands should be registered', async () => {
        const commands = await vscode.commands.getCommands(true);
        const expectedCommands = [
            'fhirMapBuilder.Validation',
            'fhirMapBuilder.ValidationWithDefaultFiles',
            'fhirMapBuilder.ValidationAfterLoadingPackage'
        ];
        for (const command of expectedCommands) {
            assert.ok(commands.includes(command), `Command ${command} is not registered`);
        }
    });

    test('InsertTemplate Command should execute successfully', async () => {
        const command = 'fhirMapBuilder.InsertTemplate';
        try {
            await vscode.commands.executeCommand(command);
            assert.ok(true, `Command ${command} executed successfully`);
        } catch (error) {
            assert.fail(`Command ${command} execution failed`);
        }

    });


    test.skip('validateWithDefaultFiles should show an error message when validation fails', async () => {

        // Call the validateWithDefaultFiles method
        await fmlValidationInstance.validateWithDefaultFiles();

        // Check that the error message was shown
        const expectedErrorMessage = 'Validation error occurred.';
        assert.ok(
            showErrorMessageStub.calledWith(expectedErrorMessage),
            `Expected message "${expectedErrorMessage}" should be shown when validation fails.`
        );

        // Check that no success message was shown
        const expectedSuccessMessage = 'Validation completed successfully.';
        assert.ok(
            !showInformationMessageStub.calledWith(expectedSuccessMessage),
            `Expected message "${expectedSuccessMessage}" should not be shown when validation fails.`
        );

    });



    test('validateWithDefaultFiles should show an error message when validation error occured', async () => {
        // Call the validateWithDefaultFiles method which internally calls isPackagePath
        await fmlValidationInstance.validateWithDefaultFiles();
        // Check that no error message was shown
        const expectedErrorMessage = 'Validation error occurred.';
        assert.ok(
            showErrorMessageStub.calledWith(expectedErrorMessage),
            `Expected message "${expectedErrorMessage}" should not be shown when validation is successful.`
        );
    });
    test('validateWithDefaultFiles should show a success message when validation is successful', async () => {

        (mockApi.callValidateStructureMap as SinonStub).resolves(true);


        await fmlValidationInstance.validateWithDefaultFiles();

        assert.ok(
            showInformationMessageStub.calledWith('Validation completed successfully.'),
            'Expected validation succeed message to be shown'
        );
    });


    test.skip('validateWithPossibilityToChooseFiles should show an error message when validation fails', async () => {


        await fmlValidationInstance.validateWithPossibilityToChooseFiles();
        (mockApi.callValidateStructureMap as SinonStub).resolves(false);

        await fmlValidationInstance.validateWithPossibilityToChooseFiles();

        assert.ok(
            showErrorMessageStub.calledWith('Validation error occurred.'),
            'Expected error message to be shown'
        );
    });

    test.skip('validateWithPossibilityToChooseFiles should show an information success message when validation succeed', async () => {


        await fmlValidationInstance.validateWithPossibilityToChooseFiles();
        (mockApi.callValidateStructureMap as SinonStub).resolves(true);

        await fmlValidationInstance.validateWithPossibilityToChooseFiles();

        assert.ok(
            showInformationMessageStub.calledWith('Validation completed successfully.'),
            'Expected validation succeed message to be shown'
        );
    });

    test('should parse .fml file on change event', async () => {
        const fakePath = path.resolve(__dirname, '../../src/test/fixtures/test.fml');

        const parseStub = (mockApi.callParseStructureMap as sinon.SinonStub).resolves(true);

        const nbFiles = await mapBuilderWatcherInstance.parseFmlFilesFromPath(fakePath);

        assert.strictEqual(nbFiles, 1, 'Expected one file to be parsed');

        parseStub.restore();
    });

    test('parseFmlFilesFromPath should return 0 if path is not a string', async () => {
        const result = await mapBuilderWatcherInstance.parseFmlFilesFromPath({} as any);
        assert.strictEqual(result, 0, 'Expected 0 when input path is not a string');
    });

    test('loadPackageAndParseFmlFiles should log engine message and parsed file count', async () => {
        const engineMessage = 'Engine loaded successfully.';
        const parsedCount = 2;

        (mockApi.callResetAndLoadEngine as SinonStub).resolves(engineMessage);
        const parseStub = sinon.stub(mapBuilderWatcherInstance, 'parseAllFmlFiles').resolves(parsedCount);

        const loggerStub = sinon.stub(mapBuilderWatcherInstance['logger'], 'appendLine');

        await mapBuilderWatcherInstance.loadPackageAndParseFmlFiles();

        assert.ok(
            loggerStub.calledWithMatch(`: ${engineMessage}`),
            'Expected engine load message to be logged'
        );

        assert.ok(
            loggerStub.calledWithMatch(`: ${parsedCount} files are parsed!`),
            'Expected parsed file count to be logged'
        );

        parseStub.restore();
        loggerStub.restore();
    });
});
