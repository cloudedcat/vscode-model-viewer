import "@google/model-viewer";
import { ModelViewerElement } from "@google/model-viewer";

const vscode = acquireVsCodeApi();

async function loadModelFromData(initialContent: Uint8Array): Promise<string> {
    const blob = new Blob([initialContent]);
    return URL.createObjectURL(blob);
}

document.addEventListener("DOMContentLoaded", function () {
    window.addEventListener('message', async e => {
        const { type, body } = e.data;
        switch (type) {
            case 'init':
                {
                    loadModelFromData(body).then(modelpath => {
                        let modelViewer: ModelViewerElement = document.querySelector('#model-3d')!;
                        modelViewer.src = modelpath;
                    });

                    return;
                }
        }
    });

    vscode.postMessage({ type: 'ready' });
});
