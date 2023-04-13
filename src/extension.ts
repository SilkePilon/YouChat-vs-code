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

    const ask = async () => {
        const userInput = await vscode.window.showInputBox({
            prompt: 'Enter a message for YouChat:',
            value: '',
        });

        if (userInput === undefined) {
            // User canceled input, do nothing
            return;
        }

        const textWordCount = userInput.trim().split(/\s+/).length;
        if (textWordCount > 500) {
            vscode.window.showWarningMessage('Selected text exceeds maximum limit of 500 words');
            return;
        }

        const apiUrl = `https://api.betterapi.net/youdotcom/chat?message=${encodeURIComponent(
            'dont reply with very long messages now: ',
        )}${encodeURIComponent(userInput)}&key=site`;

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
                    const {message} = json;
                    const copyAction = { title: 'Copy code' };
                    vscode.window.showInformationMessage(message, copyAction).then((selection) => {
                        if (selection === copyAction) {
                            const codeRegex = /```([\s\S]*)```/;
                            const match = codeRegex.exec(message);
                            if (match !== null) {
                                const codeToCopy = match[1];
                                vscode.env.clipboard.writeText(codeToCopy);
                                vscode.window.showInformationMessage('Code copied to clipboard');
                            }
                        }
                    });
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

        const {selection} = editor;
        if (selection.isEmpty) {
            vscode.window.showErrorMessage('No text selected');
            return;
        }

        const text = editor.document.getText(selection);

        const textWordCount = text.trim().split(/\s+/).length;
        if (textWordCount > 500) {
            vscode.window.showWarningMessage('Selected text exceeds maximum limit of 500 words');
            return;
        }

        const apiEndpoint = `https://api.betterapi.net/youdotcom/chat?message=${encodeURIComponent(
            "Don't reply with very long messages. Refactor this code to make it better and return only the new code: ",
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
                    const {message} = json;
                    const copyAction = { title: 'Copy code' };
                    vscode.window.showInformationMessage(message, copyAction).then((selection) => {
                        if (selection === copyAction) {
                            const codeRegex = /```([\s\S]*)```/;
                            const match = codeRegex.exec(message);
                            if (match !== null) {
                                const codeToCopy = match[1];
                                vscode.env.clipboard.writeText(codeToCopy);
                                vscode.window.showInformationMessage('Code copied to clipboard');
                            }
                        }
                    });
                    progress.report({ increment: 100, message: 'API request successful' });
                } catch (error) {
                    vscode.window.showErrorMessage((error as Error).message);
                    progress.report({ increment: 100, message: 'API request failed' });
                }
            },
        );
    };

    context.subscriptions.push(
        // onDidChangePythonInterpreter(async () => {
        //     await runServer();
        // }),
        // onDidChangeConfiguration(async (e: vscode.ConfigurationChangeEvent) => {
        //     if (checkIfConfigurationChanged(e, serverId)) {
        //         await runServer();
        //     }
        // }),
        // registerCommand(`${serverId}.restart`, async () => {
        //     await runServer();
        // }),
        registerCommand(`${serverId}.ask`, async () => {
            await ask();
        }),
        registerCommand(`${serverId}.sendSelectedTextToAPICommand`, async () => {
            await sendSelectedTextToAPICommand();
        }),
    );

    // setImmediate(async () => {
    //     const interpreter = getInterpreterFromSetting(serverId);
    //     if (interpreter === undefined || interpreter.length === 0) {
    //         traceLog(`Python extension loading`);
    //         await initializePython(context.subscriptions);
    //         traceLog(`Python extension loaded`);
    //     } else {
    //         await runServer();
    //     }
    // });
}

export async function deactivate(): Promise<void> {
    if (lsClient) {
        await lsClient.stop();
    }
}
