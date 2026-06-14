/* ==========================================================================
   RETRO DFD VISUALIZER - APPLICATION GLUE
   ========================================================================== */

document.addEventListener('DOMContentLoaded', () => {
    // ----------------------------------------------------------------------
    // DOM Cache
    // ----------------------------------------------------------------------
    const themeTrigger = document.getElementById('theme-trigger');
    const themeOptions = document.getElementById('theme-options');
    const toggleScanlinesBtn = document.getElementById('toggle-scanlines');
    const toggleSoundBtn = document.getElementById('toggle-sound');
    
    const btnNew = document.getElementById('btn-new');
    const btnSave = document.getElementById('btn-save');
    const btnLoad = document.getElementById('btn-load');
    const fileLoader = document.getElementById('file-loader');
    const btnExportSvg = document.getElementById('btn-export-svg');
    const btnExportPng = document.getElementById('btn-export-png');
    const btnExportTxt = document.getElementById('btn-export-txt');
    const btnExportPdf = document.getElementById('btn-export-pdf');
    const btnExportMd = document.getElementById('btn-export-md');
    
    const scriptEditor = document.getElementById('script-editor');
    const btnCompile = document.getElementById('btn-compile');
    
    const inspectorPanel = document.getElementById('inspector-panel');
    const inspectorEmpty = document.getElementById('inspector-empty');
    const inspectorContent = document.getElementById('inspector-content');
    
    const inspectId = document.getElementById('inspect-id');
    const inspectType = document.getElementById('inspect-type');
    const inspectLabel = document.getElementById('inspect-label');
    const inspectFlowSource = document.getElementById('inspect-flow-source');
    const inspectFlowTarget = document.getElementById('inspect-flow-target');
    const btnInspectSave = document.getElementById('btn-inspect-save');
    const btnInspectDelete = document.getElementById('btn-inspect-delete');
    
    const consoleLog = document.getElementById('console-log');
    const systemTime = document.getElementById('system-time');
    
    const btnZoomIn = document.getElementById('btn-zoom-in');
    const btnZoomOut = document.getElementById('btn-zoom-out');
    const btnZoomReset = document.getElementById('btn-zoom-reset');
    
    // Modal DOM
    const modalSave = document.getElementById('modal-save');
    const saveDataTextarea = document.getElementById('save-data-textarea');
    const btnModalCopy = document.getElementById('btn-modal-copy');
    const btnModalClose = document.getElementById('btn-modal-close');

    // Canvas tools
    const toolSelect = document.getElementById('tool-select');
    const toolProcess = document.getElementById('tool-process');
    const toolEntity = document.getElementById('tool-entity');
    const toolStore = document.getElementById('tool-store');
    const toolLink = document.getElementById('tool-link');

    // ----------------------------------------------------------------------
    // Internal States
    // ----------------------------------------------------------------------
    let isUpdatingFromEditor = false;
    let resizeFitTimer = null;

    function fitDiagramToViewport() {
        CanvasManager.fitToContent({ force: window.innerWidth <= 900 });
    }

    // ----------------------------------------------------------------------
    // System Clock
    // ----------------------------------------------------------------------
    function updateClock() {
        const now = new Date();
        const hrs = String(now.getHours()).padStart(2, '0');
        const mins = String(now.getMinutes()).padStart(2, '0');
        const secs = String(now.getSeconds()).padStart(2, '0');
        systemTime.textContent = `TIME: ${hrs}:${mins}:${secs}`;
    }
    setInterval(updateClock, 1000);
    updateClock();

    // ----------------------------------------------------------------------
    // Console Logging Utility
    // ----------------------------------------------------------------------
    function logToConsole(message, isError = false) {
        const now = new Date();
        const hrs = String(now.getHours()).padStart(2, '0');
        const mins = String(now.getMinutes()).padStart(2, '0');
        const secs = String(now.getSeconds()).padStart(2, '0');
        const timestamp = `[${hrs}:${mins}:${secs}]`;
        
        const line = document.createElement('div');
        line.className = 'console-line';
        if (isError) {
            line.style.color = 'var(--danger-color)';
        }
        line.textContent = `${timestamp} ${message}`;
        
        consoleLog.appendChild(line);
        // Scroll to show newest entries (scrollTop=0 works with column-reverse)
        consoleLog.scrollTop = 0;
    }

    // ----------------------------------------------------------------------
    // Theme & FX Management
    // ----------------------------------------------------------------------
    themeTrigger.addEventListener('click', (e) => {
        e.stopPropagation();
        SoundManager.playClick();
        themeOptions.classList.toggle('show');
    });

    themeOptions.querySelectorAll('li').forEach(option => {
        option.addEventListener('click', () => {
            const theme = option.getAttribute('data-value');
            themeTrigger.textContent = option.textContent;
            themeOptions.classList.remove('show');
            
            document.body.className = '';
            document.body.classList.add(`crt-theme-${theme}`);
            logToConsole(`THEME SET TO: ${theme.toUpperCase()} PHOSPHOR`);
            SoundManager.playClick();
            CanvasManager.draw(); // Redraw for glow filtering adjustments
        });
    });

    // Close dropdown when clicking outside
    document.addEventListener('click', () => {
        if (themeOptions.classList.contains('show')) {
            themeOptions.classList.remove('show');
        }
    });

    toggleScanlinesBtn.addEventListener('click', () => {
        const overlays = document.querySelectorAll('.crt-overlay');
        const isActive = toggleScanlinesBtn.classList.toggle('active');
        
        overlays.forEach(overlay => {
            overlay.style.display = isActive ? 'block' : 'none';
        });
        
        toggleScanlinesBtn.textContent = isActive ? 'CRT FX: ON' : 'CRT FX: OFF';
        logToConsole(`CRT SCREEN FX ${isActive ? 'ENABLED' : 'DISABLED'}`);
        SoundManager.playClick();
    });

    toggleSoundBtn.addEventListener('click', () => {
        const soundEnabled = SoundManager.toggle();
        toggleSoundBtn.classList.toggle('active', soundEnabled);
        toggleSoundBtn.textContent = soundEnabled ? 'SOUND: ON' : 'SOUND: OFF';
        
        // Initialize context on first click if not done
        SoundManager.init();
        if (soundEnabled) SoundManager.playClick();
        
        logToConsole(`AUDIO FEEDBACK CHANNELS ${soundEnabled ? 'ENABLED' : 'MUTED'}`);
    });

    // Initialize Audio context on typing inside editor
    scriptEditor.addEventListener('keydown', (e) => {
        SoundManager.init();
        SoundManager.playTap();
        
        // Compile on Ctrl+Enter
        if (e.ctrlKey && e.key === 'Enter') {
            e.preventDefault();
            compileDSL();
        }
    });

    // ----------------------------------------------------------------------
    // Compile Text Editor (DSL -> Diagram)
    // ----------------------------------------------------------------------
    function compileDSL() {
        SoundManager.init();
        const code = scriptEditor.value;
        logToConsole('COMPILING DSL SPECIFICATION...');
        
        isUpdatingFromEditor = true;
        const result = DiagramModel.parseDSL(code);
        isUpdatingFromEditor = false;

        if (result.success) {
            logToConsole(`COMPILATION SUCCESSFUL. RESOLVED ${Object.keys(DiagramModel.getNodes()).length} NODES & ${DiagramModel.getFlows().length} FLOWS.`, false);
            SoundManager.playSuccess();
            fitDiagramToViewport();
        } else {
            logToConsole('COMPILATION FAILED!', true);
            result.errors.forEach(err => {
                logToConsole(`> ${err}`, true);
            });
            SoundManager.playError();
        }
    }

    btnCompile.addEventListener('click', compileDSL);

    // ----------------------------------------------------------------------
    // Model Syncing (Diagram -> Text Editor)
    // ----------------------------------------------------------------------
    DiagramModel.registerOnChange(() => {
        // Redraw canvas
        CanvasManager.draw();
        
        // Sync editor value if update didn't originate from editor typing
        if (!isUpdatingFromEditor) {
            scriptEditor.value = DiagramModel.generateDSL();
        }
    });

    // ----------------------------------------------------------------------
    // Selection & Inspector Management
    // ----------------------------------------------------------------------
    function handleSelectionChange(selected) {
        if (!selected) {
            // Hide inspector fields
            inspectorEmpty.style.display = 'block';
            inspectorContent.style.display = 'none';
            return;
        }

        inspectorEmpty.style.display = 'none';
        inspectorContent.style.display = 'block';
        
        // Hide flow fields by default
        document.querySelectorAll('.flow-only').forEach(el => el.style.display = 'none');

        if (selected.type === 'node') {
            const node = DiagramModel.getNodes()[selected.id];
            if (!node) return;

            inspectId.textContent = node.id;
            inspectType.value = node.type;
            inspectType.disabled = false;
            inspectLabel.value = node.label;
            logToConsole(`INSPECTING NODE [${node.id}]`);
        } else if (selected.type === 'flow') {
            const flow = DiagramModel.getFlows().find(f => f.id === selected.id);
            if (!flow) return;

            inspectId.textContent = flow.id.split('_').slice(0, 3).join('_'); // Cleaner ID display
            inspectType.value = 'process'; // dummy
            inspectType.disabled = true;
            inspectLabel.value = flow.label;
            
            // Show flow connections
            document.querySelectorAll('.flow-only').forEach(el => el.style.display = 'flex');
            inspectFlowSource.textContent = flow.source;
            inspectFlowTarget.textContent = flow.target;
            logToConsole(`INSPECTING DATA FLOW [${flow.source}] -> [${flow.target}]`);
        }
    }

    btnInspectSave.addEventListener('click', () => {
        const selected = CanvasManager.getSelected();
        if (!selected) return;

        SoundManager.playClick();
        if (selected.type === 'node') {
            const id = inspectId.textContent;
            const type = inspectType.value;
            const label = inspectLabel.value.trim();
            
            DiagramModel.updateNode(id, { type, label });
            logToConsole(`UPDATED NODE [${id}] PROPERTIES.`);
        } else if (selected.type === 'flow') {
            const label = inspectLabel.value.trim();
            DiagramModel.updateFlow(selected.id, label);
            logToConsole(`UPDATED FLOW LABEL.`);
        }
        
        CanvasManager.selectElement(null); // Deselect after saving
    });

    btnInspectDelete.addEventListener('click', () => {
        const selected = CanvasManager.getSelected();
        if (!selected) return;

        SoundManager.playDelete();
        if (selected.type === 'node') {
            const id = inspectId.textContent;
            DiagramModel.deleteNode(id);
            logToConsole(`DELETED NODE [${id}] and cascading links.`);
        } else if (selected.type === 'flow') {
            DiagramModel.deleteFlow(selected.id);
            logToConsole(`DELETED FLOW.`);
        }

        CanvasManager.selectElement(null);
    });

    // ----------------------------------------------------------------------
    // Toolbar Tools Bindings
    // ----------------------------------------------------------------------
    toolSelect.addEventListener('click', () => CanvasManager.setTool('select'));
    toolProcess.addEventListener('click', () => CanvasManager.setTool('process'));
    toolEntity.addEventListener('click', () => CanvasManager.setTool('entity'));
    toolStore.addEventListener('click', () => CanvasManager.setTool('store'));
    toolLink.addEventListener('click', () => CanvasManager.setTool('link'));

    // Handle ESC key to reset tools and selections
    window.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            CanvasManager.setTool('select');
            CanvasManager.selectElement(null);
            SoundManager.playClick();
        }
    });

    // ----------------------------------------------------------------------
    // Zoom Controls
    // ----------------------------------------------------------------------
    btnZoomIn.addEventListener('click', () => CanvasManager.zoomIn());
    btnZoomOut.addEventListener('click', () => CanvasManager.zoomOut());
    btnZoomReset.addEventListener('click', () => CanvasManager.resetZoom());

    // ----------------------------------------------------------------------
    // Load Presets
    // ----------------------------------------------------------------------
    document.querySelectorAll('.preset-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const presetKey = e.target.getAttribute('data-preset');
            const code = TemplateRegistry[presetKey];
            if (code) {
                SoundManager.playSuccess();
                scriptEditor.value = code;
                compileDSL();
                logToConsole(`LOADED TEMPLATE: ${presetKey.toUpperCase()} SYSTEM`);
            }
        });
    });

    // ----------------------------------------------------------------------
    // Workspace File Operations (Save/Load/Export)
    // ----------------------------------------------------------------------
    btnNew.addEventListener('click', () => {
        if (confirm("ARE YOU SURE YOU WANT TO CLEAR THE ENTIRE CANVAS?")) {
            SoundManager.playDelete();
            DiagramModel.clear();
            scriptEditor.value = '';
            CanvasManager.selectElement(null);
            logToConsole('WORKSPACE CLEANED. NEW ENVIRONMENT LOADED.');
        }
    });

    btnSave.addEventListener('click', () => {
        SoundManager.playSuccess();
        const json = DiagramModel.getJSON();
        
        // Show modal with JSON
        saveDataTextarea.value = json;
        modalSave.style.display = 'flex';
        
        // Trigger actual file download
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `dfd-diagram-${Date.now()}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        logToConsole('DIAGRAM STATE EXPORTED TO JSON FILE.');
    });

    btnModalCopy.addEventListener('click', () => {
        const textToCopy = saveDataTextarea.value;
        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(textToCopy).then(() => {
                btnModalCopy.textContent = 'COPIED!';
                SoundManager.playSuccess();
                setTimeout(() => {
                    btnModalCopy.textContent = 'COPY TO CLIPBOARD';
                }, 1500);
            }).catch(() => {
                // Fallback for clipboard permission denied
                saveDataTextarea.select();
                document.execCommand('copy');
                btnModalCopy.textContent = 'COPIED!';
                SoundManager.playSuccess();
                setTimeout(() => {
                    btnModalCopy.textContent = 'COPY TO CLIPBOARD';
                }, 1500);
            });
        } else {
            // Legacy fallback
            saveDataTextarea.select();
            document.execCommand('copy');
            btnModalCopy.textContent = 'COPIED!';
            SoundManager.playSuccess();
            setTimeout(() => {
                btnModalCopy.textContent = 'COPY TO CLIPBOARD';
            }, 1500);
        }
    });

    btnModalClose.addEventListener('click', () => {
        modalSave.style.display = 'none';
        SoundManager.playClick();
    });

    btnLoad.addEventListener('click', () => {
        SoundManager.playClick();
        fileLoader.value = ''; // Reset so re-selecting the same file triggers change
        fileLoader.click();
    });

    fileLoader.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = function(evt) {
            const contents = evt.target.result;
            const result = DiagramModel.loadJSON(contents);
            if (result.success) {
                logToConsole('SUCCESSFULLY LOADED DIAGRAM FROM JSON PROJECT FILE.');
                SoundManager.playSuccess();
                fitDiagramToViewport();
            } else {
                logToConsole(`ERROR LOADING PROJECT: ${result.error}`, true);
                SoundManager.playError();
            }
        };
        reader.readAsText(file);
    });

    // ----------------------------------------------------------------------
    // Bounding box cropping utility for clean exports (snapped to 40px grid)
    // ----------------------------------------------------------------------
    function getCroppedSvgParams() {
        const nodes = DiagramModel.getNodes();
        const nodesList = Object.values(nodes);
        
        let minX = 0;
        let minY = 0;
        let width = 1000;
        let height = 700;
        
        if (nodesList.length > 0) {
            let left = Infinity;
            let top = Infinity;
            let right = -Infinity;
            let bottom = -Infinity;
            
            nodesList.forEach(node => {
                const bounds = CanvasManager.getNodeBounds(node);
                left = Math.min(left, bounds.left);
                top = Math.min(top, bounds.top);
                right = Math.max(right, bounds.right);
                bottom = Math.max(bottom, bounds.bottom);
            });
            
            // Add padding and snap to grid pattern size of 40px
            minX = Math.floor((left - 90) / 40) * 40;
            minY = Math.floor((top - 90) / 40) * 40;
            const maxX = Math.ceil((right + 90) / 40) * 40;
            const maxY = Math.ceil((bottom + 90) / 40) * 40;
            
            width = maxX - minX;
            height = maxY - minY;
        }
        
        return { minX, minY, width, height };
    }

    function getExportColors(forcePrint = false) {
        if (forcePrint) {
            return {
                bgColor: '#ffffff',
                textColor: '#000000',
                textDim: '#444444',
                textBright: '#000000',
                accentColor: '#000000',
                gridColor: 'rgba(0, 0, 0, 0.08)'
            };
        }

        const bodyStyles = window.getComputedStyle(document.body);
        return {
            bgColor: bodyStyles.getPropertyValue('--bg-color').trim(),
            textColor: bodyStyles.getPropertyValue('--text-color').trim(),
            textDim: bodyStyles.getPropertyValue('--text-dim').trim(),
            textBright: bodyStyles.getPropertyValue('--text-bright').trim(),
            accentColor: bodyStyles.getPropertyValue('--accent-color').trim(),
            gridColor: bodyStyles.getPropertyValue('--grid-line-color').trim()
        };
    }

    function buildExportStyles(colors) {
        return `
            svg {
                --bg-color: ${colors.bgColor};
                --text-color: ${colors.textColor};
                --text-dim: ${colors.textDim};
                --text-bright: ${colors.textBright};
                --accent-color: ${colors.accentColor};
                background-color: ${colors.bgColor};
                font-family: 'Share Tech Mono', 'VT323', monospace;
            }
            .grid-line { stroke: ${colors.gridColor}; }
            .grid-line-sub { stroke: ${colors.gridColor}; stroke-dasharray: 2 2; opacity: 0.35; }
            .node-shape { fill: var(--bg-color); stroke: var(--text-color); stroke-width: 2px; filter: none; }
            .store-fill { fill: var(--bg-color); }
            .store-outline { fill: none; }
            .dfd-node text { fill: var(--text-color); font-size: 13px; font-weight: bold; text-anchor: middle; dominant-baseline: middle; }
            .dfd-node text[font-size="10px"] { fill: var(--text-dim); font-size: 10px; }
            .flow-path { fill: none; stroke: var(--text-color); stroke-width: 2px; filter: none; marker-end: url(#arrowhead); }
            .dfd-flow text { fill: var(--text-color); font-size: 12px; text-anchor: middle; stroke: var(--bg-color); stroke-width: 4px; stroke-linejoin: round; paint-order: stroke fill; }
            .marker-arrow polygon { fill: var(--text-color); }
        `;
    }

    function prepareExportSvg(forcePrint = false) {
        const svgClone = document.getElementById('dfd-canvas').cloneNode(true);
        const { minX, minY, width, height } = getCroppedSvgParams();
        const colors = getExportColors(forcePrint);
        
        svgClone.removeAttribute('width');
        svgClone.removeAttribute('height');
        svgClone.setAttribute('width', width);
        svgClone.setAttribute('height', height);
        svgClone.setAttribute('viewBox', `${minX} ${minY} ${width} ${height}`);
        
        const cloneViewport = svgClone.getElementById('viewport');
        if (cloneViewport) cloneViewport.removeAttribute('transform');
        
        const clonePattern = svgClone.getElementById('grid-pattern');
        if (clonePattern) clonePattern.removeAttribute('patternTransform');
        
        svgClone.querySelectorAll('.selected').forEach(el => el.classList.remove('selected'));
        svgClone.querySelectorAll('.data-packet').forEach(el => el.remove());
        svgClone.querySelectorAll('.marker-arrow-selected, .marker-arrow-linking').forEach(el => el.remove());

        const stylesBlock = document.createElementNS('http://www.w3.org/2000/svg', 'style');
        stylesBlock.textContent = buildExportStyles(colors);
        svgClone.appendChild(stylesBlock);
        
        return { svgClone, width, height, colors };
    }

    // ----------------------------------------------------------------------
    // Export Self-contained SVG File
    // ----------------------------------------------------------------------
    btnExportSvg.addEventListener('click', () => {
        SoundManager.playSuccess();
        
        const { svgClone } = prepareExportSvg();

        const serializer = new XMLSerializer();
        let svgString = serializer.serializeToString(svgClone);
        
        // Fix namespace if missing
        if (!svgString.match(/^<svg[^>]+xmlns="http\:\/\/www\.w3\.org\/2000\/svg"/)) {
            svgString = svgString.replace(/^<svg/, '<svg xmlns="http://www.w3.org/2000/svg"');
        }

        const blob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = `dfd-diagram-${Date.now()}.svg`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        logToConsole('STANDALONE SVG DIAGRAM DOWNLOADED.');
    });

    // ----------------------------------------------------------------------
    // Export PNG Image (Uses HTML5 Canvas + SVG draw)
    // ----------------------------------------------------------------------
    btnExportPng.addEventListener('click', () => {
        SoundManager.playSuccess();
        logToConsole('GENERATING PNG IMAGE CONVERSION...');

        const { svgClone, width, height, colors } = prepareExportSvg();

        const serializer = new XMLSerializer();
        const svgString = serializer.serializeToString(svgClone);
        
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');

        const img = new Image();
        const svgBlob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
        const url = URL.createObjectURL(svgBlob);

        img.onload = function() {
            // Draw background fill first
            ctx.fillStyle = colors.bgColor;
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            
            // Draw SVG image on canvas
            ctx.drawImage(img, 0, 0);
            
            // Trigger PNG download
            try {
                const pngUrl = canvas.toDataURL('image/png');
                const a = document.createElement('a');
                a.href = pngUrl;
                a.download = `dfd-diagram-${Date.now()}.png`;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                logToConsole('PNG RASTERIZED IMAGE CONVERSION COMPLETE. DOWNLOAD STARTED.');
            } catch (err) {
                logToConsole('PNG CONVERSION ERROR: Security/Sandbox restriction.', true);
                console.error(err);
            }
            URL.revokeObjectURL(url);
        };
        img.src = url;
    });

    // ----------------------------------------------------------------------
    // Export DSL Text File
    // ----------------------------------------------------------------------
    btnExportTxt.addEventListener('click', () => {
        SoundManager.playSuccess();
        const dslText = DiagramModel.generateDSL();
        const blob = new Blob([dslText], { type: 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `dfd-diagram-${Date.now()}.txt`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        logToConsole('DSL DIAGRAM SCRIPT EXPORTED TO TXT FILE.');
    });

    // ----------------------------------------------------------------------
    // Export Vector PDF (Via Print Engine)
    // ----------------------------------------------------------------------
    btnExportPdf.addEventListener('click', () => {
        SoundManager.playSuccess();
        logToConsole('OPENING PRINT VIEW FOR PDF GENERATION...');

        const { svgClone } = prepareExportSvg(true);

        // Open print window (may return null if popup is blocked)
        const printWindow = window.open('', '_blank', 'width=1100,height=850');
        if (!printWindow) {
            logToConsole('ERROR: Popup blocked by browser. Please allow popups for PDF export.', true);
            SoundManager.playError();
            return;
        }
        printWindow.document.write(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>Export PDF - DFD-Terminal</title>
                <style>
                    body {
                        margin: 0;
                        padding: 40px;
                        display: flex;
                        justify-content: center;
                        align-items: center;
                        height: 100vh;
                        background-color: white !important;
                    }
                    svg {
                        width: 100%;
                        height: auto;
                        max-height: 90vh;
                    }
                    @page {
                        size: landscape;
                        margin: 0;
                    }
                </style>
            </head>
            <body>
                ${svgClone.outerHTML}
                <script>
                    window.onload = function() {
                        setTimeout(() => {
                            window.print();
                            window.close();
                        }, 500);
                    };
                </script>
            </body>
            </html>
        `);
        printWindow.document.close();
    });

    // ----------------------------------------------------------------------
    // Export Markdown Document
    // ----------------------------------------------------------------------
    btnExportMd.addEventListener('click', () => {
        SoundManager.playSuccess();
        const dslText = DiagramModel.generateDSL();
        const mdContent = `# Retro DFD Diagram Project

This diagram project was generated on ${new Date().toLocaleString()} using DFD-Terminal.

## Diagram Definition (DSL)

\`\`\`text
${dslText}
\`\`\`

## How to Import
To reload this diagram, copy the script block above, paste it into the DFD-Terminal SCRIPT EDITOR, and click **RUN**.
`;
        const blob = new Blob([mdContent], { type: 'text/markdown;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `dfd-diagram-${Date.now()}.md`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        logToConsole('DIAGRAM SPECIFICATION EXPORTED TO MARKDOWN FILE.');
    });

    // ----------------------------------------------------------------------
    // Application Initialization
    // ----------------------------------------------------------------------
    CanvasManager.init('dfd-canvas', {
        onSelection: handleSelectionChange,
        onModify: () => {
            // Re-compile or regenerate from changes
            scriptEditor.value = DiagramModel.generateDSL();
        }
    });

    // Load ATM by default
    scriptEditor.value = TemplateRegistry.atm;
    compileDSL();

    window.addEventListener('resize', () => {
        clearTimeout(resizeFitTimer);
        resizeFitTimer = setTimeout(fitDiagramToViewport, 120);
    });

    logToConsole('DFD WORKSPACE INITIALIZATION FULLY COMPLETE.');
});
