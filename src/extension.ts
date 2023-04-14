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
// import { VSCodeButton, VSCodeCheckbox, VSCodeTextArea } from '@vscode/webview-ui-toolkit/react';
import { VSCodeTextField } from '@vscode/webview-ui-toolkit/react';

import fetch from 'node-fetch';
import * as he from 'he';
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
                    const html = await response.text();
                    const dom = he.decode(html);
                    const json = JSON.parse(dom);
                    const { message } = json;
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

        const { selection } = editor;
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
        const { document } = editor;

        const apiEndpoint = `https://api.betterapi.net/youdotcom/chat?message=${encodeURIComponent(
            "Don't reply with very long messages. Refactor this code to make it better and return only the new code: ",
        )}${encodeURIComponent(document.languageId)}${encodeURIComponent(text)}&key=site`;
        // Create webview panel
        const panel = vscode.window.createWebviewPanel('YouChat', 'YouChat', vscode.ViewColumn.One, {
            enableScripts: true,
        });
        panel.iconPath = vscode.Uri.joinPath(context.extensionUri, 'images', 'youchat.svg');
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
                    const html = await response.text();
                    const dom = he.decode(html);
                    const json = JSON.parse(dom);
                    const { message } = json;
                    const responsemessage = message.replace(/^\s*[\r\n]/gm, '');
                    const codeRegex = /```([\s\S]*)```/;
                    const match = codeRegex.exec(message);
                    var codetostyle = match !== null ? match[1] : '';
                    const htmlcode =
                        `<!DOCTYPE html><html lang="en"><head> <meta charset="UTF-8"> <title>CodePen - Code Snippets Animation</title> <link href="https://fonts.googleapis.com/css?family=Roboto:100,300,400,500" rel="stylesheet"> <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/meyer-reset/2.0/reset.min.css"> <link rel='stylesheet' href='https://cdnjs.cloudflare.com/ajax/libs/highlight.js/9.12.0/styles/dracula.min.css'> <link rel="stylesheet" href="./style.css"> <style> body, html { width: 100%; height: 100%; font-family: "Roboto", sans-serif; } * { box-sizing: border-box; } .Container { word-break: break-all; border-bottom-right-radius: 6px; border-bottom-left-radius: 6px; position: relative; background: #282B36; box-shadow: 0 10px 40px 0 rgba(40, 43, 54, 0.3); } .Container nav { top: 15px; left: 15px; position: absolute; } .Container nav a { z-index: 2; color: #A5AAAF; font-size: 13px; padding: 5px 8px; border-radius: 4px; display: inline-block; text-decoration: none; } .Container nav a:hover, .Container nav a.active { color: white; } .Container nav .current { top: 0; left: 0; z-index: 0; width: 40px; height: 22px; border-radius: 3px; position: absolute; background-color: rgba(255, 255, 255, 0.2); } .Container .Contents { width: 100%; display: flex; overflow: hidden; align-items: flex-start; } .Container .Content { word-break: break-all; white-space: pre-wrap; width: 100%; flex-shrink: 0; color: #FFFFFF; font-size: 15px; line-height: 24px; padding: 60px 30px 30px 30px; } .Container .Content .hljs { word-break: break-all; padding: 0; font-size: 13px; line-height: 24px; font-family: Consolas, Monaco, monospace; } .hljs-number { color: #FFC24C; } .credit { left: 50%; bottom: 30px; width: 300px; position: fixed; text-align: center; margin-left: -150px; } .credit p { color: #6C738B; font-size: 13px; font-weight: 300; line-height: 20px; } .credit p a { color: #32325D; font-weight: 400; text-decoration: none; } .credit p a:hover { color: #5C33FF; } </style></head><body> <!-- partial:index.partial.html --> <div class="Container"> <nav> <div class="current"></div> <a href="#one" class="active">Response</a> <a href="#two">Code only</a> <a href="#three">Input code</a></nav> <div class="Contents"> <div class="Content" id="one"> <pre><code>${responsemessage}</pre></code> </div> <div class="Content" id="three"> <pre><code>${codetostyle}</code></pre> </div> <div class="Content" id="four"> <pre><code>${text}</code></pre> </div> </div> </div> <!-- partial -->` +
                        "<script src='https://cdnjs.cloudflare.com/ajax/libs/highlight.js/9.12.0/highlight.min.js'></script> <script src='https://cdnjs.cloudflare.com/ajax/libs/highlight.js/9.12.0/languages/ruby.min.js'></script> <script src='https://cdnjs.cloudflare.com/ajax/libs/highlight.js/9.12.0/languages/python.min.js'></script> <script src='https://cdnjs.cloudflare.com/ajax/libs/highlight.js/9.12.0/languages/go.min.js'></script> <script src='https://cdnjs.cloudflare.com/ajax/libs/highlight.js/9.12.0/languages/javascript.min.js'></script> <script> hljs.initHighlightingOnLoad(); const scrollView = document.querySelector('.Container .Contents'); const tabs = document.querySelectorAll('.Container .Contents .Content'); const nav = document.querySelectorAll('.Container nav a'); const currentNav = document.querySelector('.Container nav .current'); let currentTab = 0; currentNav.style.width = `${nav[currentTab].clientWidth}px`; scrollView.style.height = `${tabs[currentTab].clientHeight}px`; nav.forEach(link => { link.addEventListener('click', e => { e.preventDefault(); const index = Array.prototype.indexOf.call(nav, e.target); if (currentTab === index) return; animateToTab(index); }); }); const animateToTab = index => { const el = tabs[index]; const scrollStart = scrollView.scrollLeft; const startHeight = scrollView.clientHeight; nav[currentTab].classList.remove('active'); nav[index].classList.add('active'); const time = { start: performance.now(), duration: 700 }; const tick = now => { time.elapsed = now - time.start; const fadeOut = easeInOutCubic(time.elapsed, 1, -1, time.duration); const fadeIn = easeInOutCubic(time.elapsed, 0, 1, time.duration); const offset = easeInOutCubic(time.elapsed, scrollStart, el.offsetLeft - scrollStart, time.duration); const height = easeInOutCubic(time.elapsed, startHeight, el.clientHeight - startHeight, time.duration); const navOffset = easeInOutCubic( time.elapsed, nav[currentTab].offsetLeft, nav[index].offsetLeft - nav[currentTab].offsetLeft, time.duration); const indicatorWidth = easeInOutCubic( time.elapsed, nav[currentTab].clientWidth, nav[index].clientWidth - nav[currentTab].clientWidth, time.duration); currentNav.style.transform = `translateX(${navOffset}px)`; currentNav.style.width = `${indicatorWidth}px`; tabs[currentTab].style.opacity = fadeOut; tabs[index].style.opacity = fadeIn; scrollView.scrollLeft = offset; scrollView.style.height = `${height}px`; if (time.elapsed < time.duration) { requestAnimationFrame(tick); } else { currentTab = index; } }; requestAnimationFrame(tick); }; var easeInOutCubic = (t, b, c, d) => { if ((t /= d / 2) < 1) return c / 2 * t * t * t + b; return c / 2 * ((t -= 2) * t * t + 2) + b; }; </script></body></html>";
                    panel.webview.html = htmlcode;
                    progress.report({ increment: 100, message: 'API request successful' });
                } catch (error) {
                    vscode.window.showErrorMessage((error as Error).message);
                    progress.report({ increment: 100, message: 'API request failed' });
                }
            },
        );
    };

    // Command to send selected text to the API
    const explaincode = async () => {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            vscode.window.showErrorMessage('No active editor found');
            return;
        }

        const { selection } = editor;
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
        const { document } = editor;

        const apiEndpoint = `https://api.betterapi.net/youdotcom/chat?message=${encodeURIComponent(
            "Don't reply with very long messages. Explain this code: ",
        )}${encodeURIComponent(document.languageId)}${encodeURIComponent(text)}&key=site`;
        // Create webview panel
        const panel = vscode.window.createWebviewPanel('YouChat', 'YouChat', vscode.ViewColumn.One, {
            enableScripts: true,
        });
        panel.iconPath = vscode.Uri.joinPath(context.extensionUri, 'images', 'youchat.svg');
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
                    const html = await response.text();
                    const dom = he.decode(html);
                    const json = JSON.parse(dom);
                    const { message } = json;
                    const codeRegex = /```([\s\S]*)```/;
                    const match = codeRegex.exec(message);
                    var codetostyle = match !== null ? match[1] : '';
                    const htmlcode =
                        `<!DOCTYPE html><html lang="en"><head> <meta charset="UTF-8"> <title>CodePen - Code Snippets Animation</title> <link href="https://fonts.googleapis.com/css?family=Roboto:100,300,400,500" rel="stylesheet"> <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/meyer-reset/2.0/reset.min.css"> <link rel='stylesheet' href='https://cdnjs.cloudflare.com/ajax/libs/highlight.js/9.12.0/styles/dracula.min.css'> <link rel="stylesheet" href="./style.css"> <style> body, html { width: 100%; height: 100%; font-family: "Roboto", sans-serif; } * { box-sizing: border-box; } .Container { word-break: break-all; border-bottom-right-radius: 6px; border-bottom-left-radius: 6px; position: relative; background: #282B36; box-shadow: 0 10px 40px 0 rgba(40, 43, 54, 0.3); } .Container nav { top: 15px; left: 15px; position: absolute; } .Container nav a { z-index: 2; color: #A5AAAF; font-size: 13px; padding: 5px 8px; border-radius: 4px; display: inline-block; text-decoration: none; } .Container nav a:hover, .Container nav a.active { color: white; } .Container nav .current { top: 0; left: 0; z-index: 0; width: 40px; height: 22px; border-radius: 3px; position: absolute; background-color: rgba(255, 255, 255, 0.2); } .Container .Contents { width: 100%; display: flex; overflow: hidden; align-items: flex-start; } .Container .Content { word-break: break-all; white-space: pre-wrap; width: 100%; flex-shrink: 0; color: #FFFFFF; font-size: 15px; line-height: 24px; padding: 60px 30px 30px 30px; } .Container .Content .hljs { word-break: break-all; padding: 0; font-size: 13px; line-height: 24px; font-family: Consolas, Monaco, monospace; } .hljs-number { color: #FFC24C; } .credit { left: 50%; bottom: 30px; width: 300px; position: fixed; text-align: center; margin-left: -150px; } .credit p { color: #6C738B; font-size: 13px; font-weight: 300; line-height: 20px; } .credit p a { color: #32325D; font-weight: 400; text-decoration: none; } .credit p a:hover { color: #5C33FF; } </style></head><body> <!-- partial:index.partial.html --> <div class="Container"> <nav> <div class="current"></div> <a href="#one" class="active">${document.languageId} explained</a> <a href="#three">Input code</a></nav> <div class="Contents"> <div class="Content" id="one"> <pre><code>${message}</pre></code> </div> <div class="Content" id="three"> <pre><code>${text}</code></pre> </div> <div class="Content" id="four"> <pre><code>${text}</code></pre> </div> </div> </div> <!-- partial -->` +
                        "<script src='https://cdnjs.cloudflare.com/ajax/libs/highlight.js/9.12.0/highlight.min.js'></script> <script src='https://cdnjs.cloudflare.com/ajax/libs/highlight.js/9.12.0/languages/ruby.min.js'></script> <script src='https://cdnjs.cloudflare.com/ajax/libs/highlight.js/9.12.0/languages/python.min.js'></script> <script src='https://cdnjs.cloudflare.com/ajax/libs/highlight.js/9.12.0/languages/go.min.js'></script> <script src='https://cdnjs.cloudflare.com/ajax/libs/highlight.js/9.12.0/languages/javascript.min.js'></script> <script> hljs.initHighlightingOnLoad(); const scrollView = document.querySelector('.Container .Contents'); const tabs = document.querySelectorAll('.Container .Contents .Content'); const nav = document.querySelectorAll('.Container nav a'); const currentNav = document.querySelector('.Container nav .current'); let currentTab = 0; currentNav.style.width = `${nav[currentTab].clientWidth}px`; scrollView.style.height = `${tabs[currentTab].clientHeight}px`; nav.forEach(link => { link.addEventListener('click', e => { e.preventDefault(); const index = Array.prototype.indexOf.call(nav, e.target); if (currentTab === index) return; animateToTab(index); }); }); const animateToTab = index => { const el = tabs[index]; const scrollStart = scrollView.scrollLeft; const startHeight = scrollView.clientHeight; nav[currentTab].classList.remove('active'); nav[index].classList.add('active'); const time = { start: performance.now(), duration: 700 }; const tick = now => { time.elapsed = now - time.start; const fadeOut = easeInOutCubic(time.elapsed, 1, -1, time.duration); const fadeIn = easeInOutCubic(time.elapsed, 0, 1, time.duration); const offset = easeInOutCubic(time.elapsed, scrollStart, el.offsetLeft - scrollStart, time.duration); const height = easeInOutCubic(time.elapsed, startHeight, el.clientHeight - startHeight, time.duration); const navOffset = easeInOutCubic( time.elapsed, nav[currentTab].offsetLeft, nav[index].offsetLeft - nav[currentTab].offsetLeft, time.duration); const indicatorWidth = easeInOutCubic( time.elapsed, nav[currentTab].clientWidth, nav[index].clientWidth - nav[currentTab].clientWidth, time.duration); currentNav.style.transform = `translateX(${navOffset}px)`; currentNav.style.width = `${indicatorWidth}px`; tabs[currentTab].style.opacity = fadeOut; tabs[index].style.opacity = fadeIn; scrollView.scrollLeft = offset; scrollView.style.height = `${height}px`; if (time.elapsed < time.duration) { requestAnimationFrame(tick); } else { currentTab = index; } }; requestAnimationFrame(tick); }; var easeInOutCubic = (t, b, c, d) => { if ((t /= d / 2) < 1) return c / 2 * t * t * t + b; return c / 2 * ((t -= 2) * t * t + 2) + b; }; </script></body></html>";
                    panel.webview.html = htmlcode;
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
        registerCommand(`${serverId}.explaincode`, async () => {
            await explaincode();
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
