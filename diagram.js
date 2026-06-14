/* ==========================================================================
   RETRO DFD VISUALIZER - DATA MODEL & DSL PARSER
   ========================================================================== */

const DiagramModel = (() => {
    // Current state of the diagram
    let state = {
        nodes: {}, // Map of id -> { id, type, label, x, y }
        flows: []  // List of { id, source, target, label }
    };

    // Undo/Redo stacks
    const undoStack = [];
    const redoStack = [];
    const MAX_HISTORY = 50;

    // Listeners for change events
    let onChangeCallback = null;

    function registerOnChange(callback) {
        onChangeCallback = callback;
    }

    function triggerChange() {
        if (onChangeCallback) {
            onChangeCallback();
        }
    }

    // Save snapshot for undo
    function saveHistory() {
        undoStack.push(JSON.stringify(state));
        if (undoStack.length > MAX_HISTORY) {
            undoStack.shift();
        }
        // Clear redo stack on new action
        redoStack.length = 0;
    }

    function undo() {
        if (undoStack.length === 0) return false;
        
        redoStack.push(JSON.stringify(state));
        state = JSON.parse(undoStack.pop());
        triggerChange();
        return true;
    }

    function redo() {
        if (redoStack.length === 0) return false;
        
        undoStack.push(JSON.stringify(state));
        state = JSON.parse(redoStack.pop());
        triggerChange();
        return true;
    }

    // Node Operations
    function addNode(id, type, label, x = 150, y = 150) {
        saveHistory();
        
        // Clean ID (alphanumeric and underscores only)
        const cleanId = id.replace(/[^a-zA-Z0-9_\-]/g, '');
        
        state.nodes[cleanId] = {
            id: cleanId,
            type, // 'process' | 'entity' | 'store'
            label: label || cleanId,
            x: Math.round(x),
            y: Math.round(y)
        };
        triggerChange();
        return state.nodes[cleanId];
    }

    function updateNode(id, fields, skipHistory = false) {
        if (!state.nodes[id]) return false;
        if (!skipHistory) saveHistory();
        
        state.nodes[id] = {
            ...state.nodes[id],
            ...fields
        };
        
        // Round coordinates to keep DFD clean
        if (fields.x !== undefined) state.nodes[id].x = Math.round(fields.x);
        if (fields.y !== undefined) state.nodes[id].y = Math.round(fields.y);
        
        triggerChange();
        return true;
    }

    function deleteNode(id) {
        if (!state.nodes[id]) return false;
        saveHistory();
        
        // Delete the node
        delete state.nodes[id];
        
        // Cascade delete any flows connected to this node
        state.flows = state.flows.filter(flow => flow.source !== id && flow.target !== id);
        
        triggerChange();
        return true;
    }

    // Flow Operations
    function addFlow(source, target, label = '') {
        // Ensure both nodes exist
        if (!state.nodes[source] || !state.nodes[target]) return null;
        
        saveHistory();
        
        const flowId = `flow_${source}_${target}_${Date.now()}`;
        const newFlow = {
            id: flowId,
            source,
            target,
            label: label || ''
        };
        
        state.flows.push(newFlow);
        triggerChange();
        return newFlow;
    }

    function updateFlow(flowId, label) {
        const flow = state.flows.find(f => f.id === flowId);
        if (!flow) return false;
        
        saveHistory();
        flow.label = label;
        triggerChange();
        return true;
    }

    function deleteFlow(flowId) {
        const index = state.flows.findIndex(f => f.id === flowId);
        if (index === -1) return false;
        
        saveHistory();
        state.flows.splice(index, 1);
        triggerChange();
        return true;
    }

    // Helper to generate unique IDs automatically
    function generateUniqueId(type) {
        const prefix = type === 'process' ? 'P' : (type === 'entity' ? 'E' : 'S');
        let counter = 1;
        while (state.nodes[`${prefix}${counter}`]) {
            counter++;
        }
        return `${prefix}${counter}`;
    }

    // Clear entire model
    function clear() {
        saveHistory();
        state.nodes = {};
        state.flows = [];
        triggerChange();
    }

    // Import/Export Raw JSON
    function getJSON() {
        return JSON.stringify(state, null, 4);
    }

    function loadJSON(jsonString) {
        try {
            const data = JSON.parse(jsonString);
            if (data && typeof data === 'object') {
                saveHistory();
                state.nodes = data.nodes || {};
                state.flows = data.flows || [];
                triggerChange();
                return { success: true };
            }
        } catch (e) {
            return { success: false, error: e.message };
        }
        return { success: false, error: 'Invalid state structure.' };
    }

    /* ==========================================================================
       DSL COMPILING & PARSING (Text-to-Diagram)
       ========================================================================== */
    function parseDSL(text) {
        const lines = text.split('\n');
        
        const tempNodes = {};
        const tempFlows = [];
        const positions = {};
        
        const errors = [];
        const logs = [];

        // Regex definitions
        // E1[Customer] or E_cust[External Customer]
        const entityRegex = /^([a-zA-Z0-9_\-]+)\s*\[(.*?)\]$/;
        // P1(Process Orders)
        const processRegex = /^([a-zA-Z0-9_\-]+)\s*\((.*?)\)$/;
        // S1|Transactions|
        const storeRegex = /^([a-zA-Z0-9_\-]+)\s*\|(.*?)\|$/;
        // E1 -> P1 : Details or E1 -> P1
        const flowRegex = /^([a-zA-Z0-9_\-]+)\s*->\s*([a-zA-Z0-9_\-]+)(?:\s*:\s*(.*?))?$/;
        // Position info (e.g. E1: 150, 300)
        const positionRegex = /^([a-zA-Z0-9_\-]+)\s*:\s*([0-9\.\-]+)\s*,\s*([0-9\.\-]+)$/;

        let parsingPositions = false;

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();
            if (!line) continue;
            
            // Skip comments starting with # (unless it marks sections)
            if (line.startsWith('#')) {
                const marker = line.toLowerCase();
                if (marker.includes('positions') || marker.includes('layout')) {
                    parsingPositions = true;
                    logs.push(`Line ${i+1}: Switched to Position metadata section`);
                }
                continue;
            }

            // If we are parsing positions metadata
            if (parsingPositions) {
                const posMatch = line.match(positionRegex);
                if (posMatch) {
                    const id = posMatch[1];
                    const x = parseFloat(posMatch[2]);
                    const y = parseFloat(posMatch[3]);
                    positions[id] = { x, y };
                } else {
                    // Try parsing as normal element even if position marker was found, just in case
                    parseElementOrFlow(line, i);
                }
                continue;
            }

            parseElementOrFlow(line, i);
        }

        function parseElementOrFlow(line, lineIndex) {
            // Check Entity
            const entityMatch = line.match(entityRegex);
            if (entityMatch) {
                const id = entityMatch[1];
                const label = entityMatch[2];
                tempNodes[id] = { id, type: 'entity', label };
                logs.push(`Line ${lineIndex+1}: Parsed Entity [${id}] -> "${label}"`);
                return;
            }

            // Check Process
            const processMatch = line.match(processRegex);
            if (processMatch) {
                const id = processMatch[1];
                const label = processMatch[2];
                tempNodes[id] = { id, type: 'process', label };
                logs.push(`Line ${lineIndex+1}: Parsed Process (${id}) -> "${label}"`);
                return;
            }

            // Check Store
            const storeMatch = line.match(storeRegex);
            if (storeMatch) {
                const id = storeMatch[1];
                const label = storeMatch[2];
                tempNodes[id] = { id, type: 'store', label };
                logs.push(`Line ${lineIndex+1}: Parsed Store |${id}| -> "${label}"`);
                return;
            }

            // Check Flow
            const flowMatch = line.match(flowRegex);
            if (flowMatch) {
                const source = flowMatch[1];
                const target = flowMatch[2];
                const label = flowMatch[3] ? flowMatch[3].trim() : '';
                tempFlows.push({ source, target, label });
                logs.push(`Line ${lineIndex+1}: Parsed Flow [${source}] -> [${target}] ("${label}")`);
                return;
            }

            // If it matches nothing, check if it's position data (in case no position header was declared)
            const posMatch = line.match(positionRegex);
            if (posMatch) {
                const id = posMatch[1];
                const x = parseFloat(posMatch[2]);
                const y = parseFloat(posMatch[3]);
                positions[id] = { x, y };
                logs.push(`Line ${lineIndex+1}: Parsed position metadata for [${id}]`);
                return;
            }

            // Unrecognized syntax
            errors.push(`Line ${lineIndex+1}: Syntax error - "${line}"`);
        }

        // Validate flows (check if source/target exist in defined nodes)
        const validatedFlows = [];
        tempFlows.forEach((flow, idx) => {
            const hasSource = tempNodes[flow.source] !== undefined;
            const hasTarget = tempNodes[flow.target] !== undefined;
            
            if (!hasSource && !hasTarget) {
                errors.push(`Flow Error: Source "${flow.source}" and Target "${flow.target}" are undefined.`);
            } else if (!hasSource) {
                errors.push(`Flow Error: Source "${flow.source}" is undefined. Cannot connect to "${flow.target}".`);
            } else if (!hasTarget) {
                errors.push(`Flow Error: Target "${flow.target}" is undefined. Cannot connect from "${flow.source}".`);
            } else {
                validatedFlows.push({
                    id: `flow_${flow.source}_${flow.target}_${idx}`,
                    source: flow.source,
                    target: flow.target,
                    label: flow.label
                });
            }
        });

        // If there are compilation errors, return failure without modifying current state
        if (errors.length > 0) {
            return {
                success: false,
                errors,
                logs
            };
        }

        // Apply layouts / coordinates
        // Layout algorithm if no position is saved: Grid or Circle Layout
        const nodesList = Object.values(tempNodes);
        const center = { x: 350, y: 220 };
        const radius = 150;
        
        nodesList.forEach((node, index) => {
            if (positions[node.id]) {
                node.x = positions[node.id].x;
                node.y = positions[node.id].y;
            } else {
                // Circular layout for nodes without explicit positions
                const angle = (index / nodesList.length) * 2 * Math.PI;
                node.x = Math.round(center.x + radius * Math.cos(angle));
                node.y = Math.round(center.y + radius * Math.sin(angle));
            }
        });

        // Swap state
        saveHistory();
        state.nodes = tempNodes;
        state.flows = validatedFlows;

        triggerChange();

        return {
            success: true,
            logs
        };
    }

    /* ==========================================================================
       DSL SERIALIZATION (Diagram-to-Text)
       ========================================================================== */
    function generateDSL() {
        let text = '# Nodes\n';
        
        const processes = [];
        const entities = [];
        const stores = [];

        Object.values(state.nodes).forEach(node => {
            if (node.type === 'process') {
                processes.push(`${node.id}(${node.label})`);
            } else if (node.type === 'entity') {
                entities.push(`${node.id}[${node.label}]`);
            } else if (node.type === 'store') {
                stores.push(`${node.id}|${node.label}|`);
            }
        });

        if (entities.length > 0) {
            text += '# Entities\n' + entities.join('\n') + '\n\n';
        }
        if (processes.length > 0) {
            text += '# Processes\n' + processes.join('\n') + '\n\n';
        }
        if (stores.length > 0) {
            text += '# Stores\n' + stores.join('\n') + '\n\n';
        }

        if (state.flows.length > 0) {
            text += '# Flows\n';
            state.flows.forEach(flow => {
                const labelSuffix = flow.label ? ` : ${flow.label}` : '';
                text += `${flow.source} -> ${flow.target}${labelSuffix}\n`;
            });
            text += '\n';
        }

        // Include position metadata at the bottom
        const nodePositions = Object.values(state.nodes).map(node => {
            return `${node.id}: ${node.x}, ${node.y}`;
        });

        if (nodePositions.length > 0) {
            text += '# Positions\n' + nodePositions.join('\n') + '\n';
        }

        return text;
    }

    return {
        registerOnChange,
        addNode,
        updateNode,
        deleteNode,
        addFlow,
        updateFlow,
        deleteFlow,
        generateUniqueId,
        clear,
        getJSON,
        loadJSON,
        parseDSL,
        generateDSL,
        undo,
        redo,
        getNodes: () => state.nodes,
        getFlows: () => state.flows,
        getState: () => state
    };
})();
