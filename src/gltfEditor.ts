import * as vscode from 'vscode';
import { getNonce } from './util';

class GLTFDocument implements vscode.CustomDocument {

	private readonly _uri: vscode.Uri;
	private _documentData: Uint8Array;

	private constructor(
		uri: vscode.Uri,
		initialContent: Uint8Array,
	) {
		this._uri = uri;
		this._documentData = initialContent;
	}

	get documentData() { return this._documentData; }
	public get uri() { return this._uri; }

	static async create(
		uri: vscode.Uri,
		backupId: string | undefined,
	): Promise<GLTFDocument | PromiseLike<GLTFDocument>> {
		// If we have a backup, read that. Otherwise read the resource from the workspace
		const dataFile = typeof backupId === 'string' ? vscode.Uri.parse(backupId) : uri;
		const fileData = await GLTFDocument.readFile(dataFile);
		return new GLTFDocument(uri, fileData);
	}

	private static async readFile(uri: vscode.Uri): Promise<Uint8Array> {
		if (uri.scheme === 'untitled') {
			throw new Error("uri.scheme is untitled");
		}

		return new Uint8Array(await vscode.workspace.fs.readFile(uri));
	}

	dispose() { };
}

export class GLTFReadonlyProvider implements vscode.CustomReadonlyEditorProvider<GLTFDocument> {

	private static readonly viewTypeModelViewer = 'modelViewer.gltf';

	constructor(
		private readonly _context: vscode.ExtensionContext
	) { }

	public static register(context: vscode.ExtensionContext): vscode.Disposable {
		return vscode.window.registerCustomEditorProvider(
			this.viewTypeModelViewer,
			new GLTFReadonlyProvider(context),
		);
	}

	async openCustomDocument(
		uri: vscode.Uri,
		openContext: vscode.CustomDocumentOpenContext,
		token: vscode.CancellationToken): Promise<GLTFDocument> {

		const document: GLTFDocument = await GLTFDocument.create(uri, openContext.backupId);

		return document;
	}

	private _requestId = 1;
	private readonly _callbacks = new Map<number, (response: any) => void>();

	resolveCustomEditor(
		document: GLTFDocument,
		webviewPanel: vscode.WebviewPanel,
		token: vscode.CancellationToken): void {

		webviewPanel.webview.options = {
			enableScripts: true,
		};

		webviewPanel.webview.onDidReceiveMessage(e => {
			if (e.type !== 'ready') { return; }

			webviewPanel.webview.postMessage({
				type: "init",
				body: document.documentData,
			});
		});

		webviewPanel.webview.html = this.getHtmlForWebview(webviewPanel.webview);
	}

	private getHtmlForWebview(webview: vscode.Webview): string {
		// Local path to script and css for the webview
		const mediaPath = webview.asWebviewUri(vscode.Uri.joinPath(
			this._context.extensionUri, 'media')).toString();

		const scriptMain = webview.asWebviewUri(vscode.Uri.joinPath(
			this._context.extensionUri, 'media', 'js', 'main.js')).toString();

		const styleVSCodeUri = webview.asWebviewUri(vscode.Uri.joinPath(
			this._context.extensionUri, 'media', 'styles', 'vscode.css'));

		// Use a nonce to whitelist which scripts can be run
		const nonce = getNonce();

		return /* html */`
			<!DOCTYPE html>
			<html lang="en">
			<head>
				<base href="${mediaPath}">
				<meta charset="UTF-8">

				<!--
				Use a content security policy to only allow loading images from https or from our extension directory,
				and only allow scripts that have a specific nonce.
				-->
				<meta
					http-equiv="Content-Security-Policy"
					content="default-src https: ${webview.cspSource
			} ; connect-src data: blob: https: ${webview.cspSource
			} ; img-src https: ${webview.cspSource
			} ; style-src 'unsafe-inline' blob: https: ${webview.cspSource
			}; script-src 'nonce-${nonce}';">
	
				<meta name="viewport" content="width=device-width, initial-scale=1.0">

				<link href="${styleVSCodeUri}" rel="stylesheet">

				<script nonce="${nonce}" src="${scriptMain}"></script>

				<title>GLtf viewer</title>
			</head>
			<body>
				<model-viewer
				id="model-3d"
				shadow-intensity="1" camera-controls touch-action="pan-y"></model-viewer>	
			</body>
		</html>`;
	}
}
