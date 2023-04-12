// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import * as vscode from 'vscode';
import { LanguageClient } from 'vscode-languageclient/node';
import { registerLogger, traceError, traceLog, traceVerbose } from './common/log/logging';
import {
    checkVersion,
    getInterpreterDetails,
    initializePython,
    onDidChangePythonInterpreter,
    resolveInterpreter,
} from './common/python';
import { restartServer } from './common/server';
import { checkIfConfigurationChanged, getInterpreterFromSetting } from './common/settings';
import { loadServerDefaults } from './common/setup';
import { getLSClientTraceLevel } from './common/utilities';
import { createOutputChannel, onDidChangeConfiguration, registerCommand } from './common/vscodeapi';
import fetch from 'node-fetch';

let lsClient: LanguageClient | undefined;
export async function activate(context: vscode.ExtensionContext): Promise<void> {
    // This is required to get server name and module. This should be
    // the first thing that we do in this extension.
    const serverInfo = loadServerDefaults();
    const serverName = serverInfo.name;
    const serverId = serverInfo.module;

    // Setup logging
    const outputChannel = createOutputChannel(serverName);
    context.subscriptions.push(outputChannel, registerLogger(outputChannel));

    const changeLogLevel = async (c: vscode.LogLevel, g: vscode.LogLevel) => {
        const level = getLSClientTraceLevel(c, g);
        await lsClient?.setTrace(level);
    };

    context.subscriptions.push(
        outputChannel.onDidChangeLogLevel(async (e) => {
            await changeLogLevel(e, vscode.env.logLevel);
        }),
        vscode.env.onDidChangeLogLevel(async (e) => {
            await changeLogLevel(outputChannel.logLevel, e);
        }),
    );

    // Log Server information
    traceLog(`Name: ${serverInfo.name}`);
    traceLog(`Module: ${serverInfo.module}`);
    traceVerbose(`Full Server Info: ${JSON.stringify(serverInfo)}`);

    const runServer = async () => {
        const interpreter = getInterpreterFromSetting(serverId);
        if (interpreter && interpreter.length > 0 && checkVersion(await resolveInterpreter(interpreter))) {
            traceVerbose(`Using interpreter from ${serverInfo.module}.interpreter: ${interpreter.join(' ')}`);
            lsClient = await restartServer(serverId, serverName, outputChannel, lsClient);
            return;
        }

        const interpreterDetails = await getInterpreterDetails();
        if (interpreterDetails.path) {
            traceVerbose(`Using interpreter from Python extension: ${interpreterDetails.path.join(' ')}`);
            lsClient = await restartServer(serverId, serverName, outputChannel, lsClient);
            return;
        }

        traceError(
            'Python interpreter missing:\r\n' +
                '[Option 1] Select python interpreter using the ms-python.python.\r\n' +
                `[Option 2] Set an interpreter using "${serverId}.interpreter" setting.\r\n` +
                'Please use Python 3.7 or greater.',
        );
    };

    const ask = async () => {
        const userInput = await vscode.window.showInputBox({
            prompt: 'Enter a message to send to the BetterAPI:',
            value: '',
        });

        if (userInput === undefined) {
            // User canceled input, do nothing
            return;
        }

        const apiUrl = `https://api.betterapi.net/youdotcom/chat?message=${encodeURIComponent(userInput)}&key=site`;

        vscode.window.withProgress(
            {
                location: vscode.ProgressLocation.Notification,
                title: 'YouChat: Please wait...',
                cancellable: false,
            },
            async (progress) => {
                progress.report({ increment: 0 });
                try {
                    const response = await fetch(apiUrl);
                    const json = (await response.json()) as { message: string };
                    const message = json.message;
                    vscode.window.showInformationMessage(message);
                    progress.report({ increment: 100, message: 'API request successful' });
                } catch (error) {
                    vscode.window.showErrorMessage((error as Error).message);
                    progress.report({ increment: 100, message: 'API request failed' });
                }
            },
        );
    };

    // Command to send selected text to the API
    const sendSelectedTextToAPICommand = async () => {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            vscode.window.showErrorMessage('No active editor found');
            return;
        }

        const selection = editor.selection;
        if (selection.isEmpty) {
            vscode.window.showErrorMessage('No text selected');
            return;
        }

        const text = editor.document.getText(selection);
        const apiEndpoint = `https://api.betterapi.net/youdotcom/chat?message=${encodeURIComponent(
            'refactor this code: ',
        )}${encodeURIComponent(text)}&key=site`;

        // Show progress notification while waiting for API response
        vscode.window.withProgress(
            {
                location: vscode.ProgressLocation.Notification,
                title: 'YouChat: Please wait...',
                cancellable: false,
            },
            async (progress) => {
                progress.report({ increment: 0 });
                try {
                    const response = await fetch(apiEndpoint);
                    const json = (await response.json()) as { message: string };
                    const message = json.message;
                    vscode.window.showInformationMessage(message);
                    progress.report({ increment: 100, message: 'API request successful' });
                } catch (error) {
                    vscode.window.showErrorMessage((error as Error).message);
                    progress.report({ increment: 100, message: 'API request failed' });
                }
            },
        );
    };

    context.subscriptions.push(
        onDidChangePythonInterpreter(async () => {
            await runServer();
        }),
        onDidChangeConfiguration(async (e: vscode.ConfigurationChangeEvent) => {
            if (checkIfConfigurationChanged(e, serverId)) {
                await runServer();
            }
        }),
        registerCommand(`${serverId}.restart`, async () => {
            await runServer();
        }),
        registerCommand(`${serverId}.ask`, async () => {
            await ask();
        }),
        registerCommand(`${serverId}.sendSelectedTextToAPICommand`, async () => {
            await sendSelectedTextToAPICommand();
        }),
    );

    setImmediate(async () => {
        const interpreter = getInterpreterFromSetting(serverId);
        if (interpreter === undefined || interpreter.length === 0) {
            traceLog(`Python extension loading`);
            await initializePython(context.subscriptions);
            traceLog(`Python extension loaded`);
        } else {
            await runServer();
        }
    });
}

export async function deactivate(): Promise<void> {
    if (lsClient) {
        await lsClient.stop();
    }
}
