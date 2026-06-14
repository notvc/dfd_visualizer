/* ==========================================================================
   RETRO DFD VISUALIZER - INTERACTIVE SVG CANVAS MANAGER
   ========================================================================== */

const CanvasManager = (() => {
    let svg = null;
    let viewport = null;
    let groupFlows = null;
    let groupNodes = null;
    let groupTemp = null;
    let initialized = false;

    // Viewport State (Zoom & Pan)
    let zoomLevel = 1.0;
    let panX = 0;
    let panY = 0;
    const MIN_ZOOM = 0.4;
    const MAX_ZOOM = 3.0;

    // Interaction State
    let activeTool = 'select'; // 'select' | 'process' | 'entity' | 'store' | 'link'
    let selectedElement = null; // { type: 'node' | 'flow', id: string }
    let dragNode = null; // ID of dragging node
    let dragStart = { x: 0, y: 0 };
    let nodeOffset = { x: 0, y: 0 };
    let isPanning = false;
    let panStart = { x: 0, y: 0 };

    // Linking mode temp state
    let linkSourceNode = null; // Node object
    let tempLine = null;

    // Grid snapping resolution
    const SNAP_GRID = 10;

    // Process node text/layout tuning
    const PROCESS_MIN_RADIUS = 48;
    const PROCESS_LABEL_MAX_CHARS = 14;
    const PROCESS_MAX_LABEL_LINES = 2;
    const PROCESS_TEXT_PADDING_X = 18;
    const PROCESS_LABEL_CENTER_Y = 16;
    const PROCESS_DIVIDER_Y = -14;
    const PROCESS_ID_Y = -28;
    const TEXT_LINE_HEIGHT = 14;
    const NODE_TEXT_AVG_WIDTH = 7.4;
    const NODE_ID_AVG_WIDTH = 6;

    // Data store layout tuning
    const STORE_MIN_WIDTH = 132;
    const STORE_MIN_HEIGHT = 56;
    const STORE_ID_COLUMN_WIDTH = 36;
    const STORE_LABEL_MAX_CHARS = 16;
    const STORE_MAX_LABEL_LINES = 2;
    const STORE_TEXT_PADDING_X = 14;

    // Callback when selection changes or nodes are modified interactively
    let onSelectionChange = null;
    let onStateModified = null;

    function init(svgId, callbacks = {}) {
        // Guard against duplicate initialization (prevents stacked event listeners)
        if (initialized) return;
        initialized = true;

        svg = document.getElementById(svgId);
        if (!svg) {
            console.error('CanvasManager: SVG element not found:', svgId);
            initialized = false;
            return;
        }

        onSelectionChange = callbacks.onSelection;
        onStateModified = callbacks.onModify;

        // Wrap SVG layers in viewport group to enable panning & zooming
        viewport = svg.getElementById('viewport');
        if (!viewport) {
            viewport = document.createElementNS('http://www.w3.org/2000/svg', 'g');
            viewport.setAttribute('id', 'viewport');
            
            // Move existing groups inside viewport (grid-bg stays outside for correct layering)
            groupFlows = svg.getElementById('group-flows');
            groupNodes = svg.getElementById('group-nodes');
            groupTemp = svg.getElementById('group-temp');
            
            if (groupFlows) viewport.appendChild(groupFlows);
            if (groupNodes) viewport.appendChild(groupNodes);
            if (groupTemp) viewport.appendChild(groupTemp);
            
            svg.appendChild(viewport);
        } else {
            groupFlows = svg.getElementById('group-flows');
            groupNodes = svg.getElementById('group-nodes');
            groupTemp = svg.getElementById('group-temp');
        }

        // Setup Event Listeners (only once due to guard above)
        svg.addEventListener('mousedown', onMouseDown);
        svg.addEventListener('mousemove', onMouseMove);
        window.addEventListener('mouseup', onMouseUp);
        svg.addEventListener('wheel', onWheel, { passive: false });

        applyTransform();
    }

    function setTool(toolName) {
        activeTool = toolName;
        
        // Remove active class from all tool buttons, let app.js sync visual states
        document.querySelectorAll('.canvas-tool-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        
        const btnId = `tool-${toolName}`;
        const btn = document.getElementById(btnId);
        if (btn) btn.classList.add('active');

        // Update canvas cursor based on tool
        if (svg) {
            if (toolName === 'select') {
                svg.style.cursor = 'default';
            } else if (toolName === 'link') {
                svg.style.cursor = 'crosshair';
            } else {
                svg.style.cursor = 'cell';
            }
        }

        // Reset any temp linking states
        clearTempLink();
    }

    function clearTempLink() {
        linkSourceNode = null;
        if (tempLine) {
            tempLine.remove();
            tempLine = null;
        }
    }

    // Apply translation and scale to the viewport group
    function applyTransform() {
        viewport.setAttribute('transform', `translate(${panX}, ${panY}) scale(${zoomLevel})`);
        
        // Sync pattern transform so grid pans and zooms with nodes but remains fullscreen
        const pattern = svg.getElementById('grid-pattern');
        if (pattern) {
            pattern.setAttribute('patternTransform', `translate(${panX}, ${panY}) scale(${zoomLevel})`);
        }
    }

    // Convert screen pixel coordinates to SVG canvas coordinates
    function screenToCanvas(clientX, clientY) {
        const rect = svg.getBoundingClientRect();
        const x = (clientX - rect.left - panX) / zoomLevel;
        const y = (clientY - rect.top - panY) / zoomLevel;
        return { x, y };
    }

    // SVG Rendering Functions
    function draw() {
        const nodes = DiagramModel.getNodes();
        const flows = DiagramModel.getFlows();

        // Clear layers
        groupNodes.innerHTML = '';
        groupFlows.innerHTML = '';

        // Draw Flows
        flows.forEach(flow => {
            const sourceNode = nodes[flow.source];
            const targetNode = nodes[flow.target];
            if (!sourceNode || !targetNode) return;

            // Calculate border intersections
            const { p1, p2 } = getNodeIntersection(sourceNode, targetNode);

            // Calculate control point for a nice curve
            const dx = p2.x - p1.x;
            const dy = p2.y - p1.y;
            const len = Math.sqrt(dx * dx + dy * dy);
            const mx = (p1.x + p2.x) / 2;
            const my = (p1.y + p2.y) / 2;

            // Normal perpendicular vector
            const nx = -dy / (len || 1);
            const ny = dx / (len || 1);

            // Curve offset (curves slightly by default, scales with length)
            const curveOffset = Math.min(35, len * 0.18);
            const cx = mx + nx * curveOffset;
            const cy = my + ny * curveOffset;

            // Curved path syntax (M start Q control end)
            const pathStr = `M ${p1.x} ${p1.y} Q ${cx} ${cy} ${p2.x} ${p2.y}`;

            // Create flow group
            const flowG = document.createElementNS('http://www.w3.org/2000/svg', 'g');
            flowG.setAttribute('class', `dfd-flow ${selectedElement?.id === flow.id ? 'selected' : ''}`);
            flowG.setAttribute('data-id', flow.id);
            
            // Backing hit-area line (thick transparent stroke to make clicking easier)
            const hitPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
            hitPath.setAttribute('d', pathStr);
            hitPath.setAttribute('fill', 'none');
            hitPath.setAttribute('stroke', 'transparent');
            hitPath.setAttribute('stroke-width', '12');
            flowG.appendChild(hitPath);

            // Visual line
            const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
            path.setAttribute('class', 'flow-path');
            path.setAttribute('d', pathStr);
            flowG.appendChild(path);

            // Data packet animation dot
            if (activeTool === 'select') {
                const packet = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
                packet.setAttribute('r', '4');
                packet.setAttribute('class', 'data-packet');
                
                const anim = document.createElementNS('http://www.w3.org/2000/svg', 'animateMotion');
                anim.setAttribute('path', pathStr);
                anim.setAttribute('dur', `${Math.max(1.5, len / 120)}s`); // speed based on distance
                anim.setAttribute('repeatCount', 'indefinite');
                
                packet.appendChild(anim);
                flowG.appendChild(packet);
            }

            // Flow Label (placed on curve center using t=0.5 Bezier math)
            // B(0.5) = 0.25*P0 + 0.5*P1 + 0.25*P2
            const lx = 0.25 * p1.x + 0.5 * cx + 0.25 * p2.x;
            const ly = 0.25 * p1.y + 0.5 * cy + 0.25 * p2.y;

            const labelText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
            labelText.setAttribute('x', lx);
            labelText.setAttribute('y', ly);
            labelText.textContent = flow.label || ' ';
            flowG.appendChild(labelText);

            // Add click listener
            flowG.addEventListener('mousedown', (e) => {
                e.stopPropagation();
                selectElement('flow', flow.id);
            });

            groupFlows.appendChild(flowG);
        });

        // Draw Nodes
        Object.values(nodes).forEach(node => {
            const nodeG = document.createElementNS('http://www.w3.org/2000/svg', 'g');
            nodeG.setAttribute('class', `dfd-node ${selectedElement?.id === node.id ? 'selected' : ''}`);
            nodeG.setAttribute('transform', `translate(${node.x}, ${node.y})`);
            nodeG.setAttribute('data-id', node.id);

            // Draw shape depending on type
            let shape = null;
            if (node.type === 'process') {
                // Circle for Process (Split Layout)
                const layout = getProcessLayout(node);
                shape = document.createElementNS('http://www.w3.org/2000/svg', 'g');
                
                const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
                circle.setAttribute('r', layout.radius);
                circle.setAttribute('class', 'node-shape');
                shape.appendChild(circle);
                
                const divider = document.createElementNS('http://www.w3.org/2000/svg', 'line');
                divider.setAttribute('x1', -layout.dividerHalfWidth);
                divider.setAttribute('y1', PROCESS_DIVIDER_Y);
                divider.setAttribute('x2', layout.dividerHalfWidth);
                divider.setAttribute('y2', PROCESS_DIVIDER_Y);
                divider.setAttribute('stroke', 'var(--text-color)');
                divider.setAttribute('stroke-width', '1.5');
                shape.appendChild(divider);
                
                nodeG.appendChild(shape);

                // ID text at the top
                const idText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
                idText.setAttribute('x', '0');
                idText.setAttribute('y', PROCESS_ID_Y);
                idText.setAttribute('font-size', '10px');
                idText.setAttribute('fill', 'var(--text-dim)');
                idText.textContent = node.id;
                nodeG.appendChild(idText);

                // Label text at the bottom
                const labelText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
                labelText.setAttribute('x', '0');
                labelText.setAttribute('y', PROCESS_LABEL_CENTER_Y);
                renderTextLines(labelText, layout.labelLines, 0, TEXT_LINE_HEIGHT);
                nodeG.appendChild(labelText);
            } else if (node.type === 'entity') {
                // Double border rectangle for External Entity
                shape = document.createElementNS('http://www.w3.org/2000/svg', 'g');
                
                const outerRect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
                outerRect.setAttribute('x', '-45');
                outerRect.setAttribute('y', '-30');
                outerRect.setAttribute('width', '90');
                outerRect.setAttribute('height', '60');
                outerRect.setAttribute('class', 'node-shape');
                
                const innerRect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
                innerRect.setAttribute('x', '-40');
                innerRect.setAttribute('y', '-25');
                innerRect.setAttribute('width', '80');
                innerRect.setAttribute('height', '50');
                innerRect.setAttribute('fill', 'none');
                innerRect.setAttribute('stroke', 'var(--text-color)');
                innerRect.setAttribute('stroke-width', '1');
                
                shape.appendChild(outerRect);
                shape.appendChild(innerRect);
                nodeG.appendChild(shape);

                const labelText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
                labelText.setAttribute('y', '0');
                wrapText(labelText, node.label || '', 10, 3, 0);
                nodeG.appendChild(labelText);
            } else if (node.type === 'store') {
                // Data store box with left ID column
                const layout = getStoreLayout(node);
                shape = document.createElementNS('http://www.w3.org/2000/svg', 'g');
                
                // Backing invisible rect to hide gridlines
                const back = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
                back.setAttribute('x', layout.left);
                back.setAttribute('y', layout.top);
                back.setAttribute('width', layout.width);
                back.setAttribute('height', layout.height);
                back.setAttribute('class', 'store-fill');
                back.setAttribute('fill', 'var(--bg-color)');
                shape.appendChild(back);
                
                // Full border box
                const border = document.createElementNS('http://www.w3.org/2000/svg', 'path');
                border.setAttribute('d', `M ${layout.left} ${layout.top} H ${layout.right} V ${layout.bottom} H ${layout.left} Z`);
                border.setAttribute('fill', 'none');
                border.setAttribute('class', 'node-shape store-outline');
                shape.appendChild(border);
                
                // Vertical divider line between store ID and label
                const divider = document.createElementNS('http://www.w3.org/2000/svg', 'line');
                divider.setAttribute('x1', layout.dividerX);
                divider.setAttribute('y1', layout.top);
                divider.setAttribute('x2', layout.dividerX);
                divider.setAttribute('y2', layout.bottom);
                divider.setAttribute('stroke', 'var(--text-color)');
                divider.setAttribute('stroke-width', '1.5');
                shape.appendChild(divider);
                
                nodeG.appendChild(shape);

                // ID text centered in left box
                const idText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
                idText.setAttribute('x', layout.idCenterX);
                idText.setAttribute('y', '0');
                idText.setAttribute('font-size', '10px');
                idText.setAttribute('fill', 'var(--text-dim)');
                idText.textContent = node.id;
                nodeG.appendChild(idText);

                // Label text centered in right box
                const labelText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
                labelText.setAttribute('x', layout.labelCenterX);
                labelText.setAttribute('y', '0');
                renderTextLines(labelText, layout.labelLines, layout.labelCenterX, TEXT_LINE_HEIGHT);
                nodeG.appendChild(labelText);
            }

            // Add events
            nodeG.addEventListener('mousedown', (e) => {
                e.stopPropagation();
                initiateNodeClick(e, node);
            });

            groupNodes.appendChild(nodeG);
        });
    }

    // SVG word-wrapping helper
    function wrapText(parent, text, maxChars = 10, maxLines = 3, centerX = 0) {
        renderTextLines(parent, getWrappedLines(text, maxChars, maxLines), centerX, TEXT_LINE_HEIGHT);
    }

    function renderTextLines(parent, lines, centerX = 0, lineHeight = TEXT_LINE_HEIGHT) {
        parent.textContent = '';
        
        // Render tspans vertically aligned
        const lineCount = lines.length;
        const startDy = -((lineCount - 1) * lineHeight) / 2;

        for (let i = 0; i < lineCount; i++) {
            const tspan = document.createElementNS('http://www.w3.org/2000/svg', 'tspan');
            tspan.textContent = lines[i];
            tspan.setAttribute('x', centerX);
            tspan.setAttribute('dy', i === 0 ? startDy : lineHeight);
            parent.appendChild(tspan);
        }
    }

    function getWrappedLines(text, maxChars = 10, maxLines = 3) {
        const normalized = (text || '').trim();
        if (!normalized) return [''];
        
        const words = normalized.split(/\s+/);
        const lines = [];
        let line = '';
        
        for (let word of words) {
            if (word.length > maxChars) {
                if (line) {
                    lines.push(line);
                    line = '';
                }
                
                while (word.length > maxChars && lines.length < maxLines) {
                    lines.push(word.slice(0, maxChars));
                    word = word.slice(maxChars);
                }
            }
            
            if (lines.length >= maxLines) break;
            
            const nextLine = line ? `${line} ${word}` : word;
            if (nextLine.length > maxChars && line) {
                lines.push(line);
                line = word;
            } else {
                line = nextLine;
            }
            
            if (lines.length >= maxLines) {
                line = '';
                break;
            }
        }
        
        if (line && lines.length < maxLines) {
            lines.push(line);
        }
        
        return lines.length ? lines : [''];
    }

    function estimateTextWidth(text, avgCharWidth = NODE_TEXT_AVG_WIDTH) {
        return (text || '').length * avgCharWidth;
    }

    function getProcessLayout(node) {
        const labelLines = getWrappedLines(node.label || '', PROCESS_LABEL_MAX_CHARS, PROCESS_MAX_LABEL_LINES);
        const labelWidth = Math.max(...labelLines.map(line => estimateTextWidth(line)));
        const idWidth = estimateTextWidth(node.id || '', NODE_ID_AVG_WIDTH);
        
        const labelLineCount = labelLines.length;
        const labelHalfHeight = ((labelLineCount - 1) * TEXT_LINE_HEIGHT) / 2 + TEXT_LINE_HEIGHT / 2;
        const labelBottomY = PROCESS_LABEL_CENTER_Y + labelHalfHeight;
        
        const labelRadius = Math.sqrt(Math.pow(labelWidth / 2 + PROCESS_TEXT_PADDING_X, 2) + Math.pow(labelBottomY, 2));
        const idRadius = Math.sqrt(Math.pow(idWidth / 2 + PROCESS_TEXT_PADDING_X, 2) + Math.pow(Math.abs(PROCESS_ID_Y) + 6, 2));
        const radius = Math.ceil(Math.max(PROCESS_MIN_RADIUS, labelRadius, idRadius));
        const dividerHalfWidth = Math.floor(Math.sqrt(Math.max(0, radius * radius - PROCESS_DIVIDER_Y * PROCESS_DIVIDER_Y)) - 4);
        
        return {
            radius,
            dividerHalfWidth,
            labelLines
        };
    }

    function getStoreLayout(node) {
        const labelLines = getWrappedLines(node.label || '', STORE_LABEL_MAX_CHARS, STORE_MAX_LABEL_LINES);
        const labelWidth = Math.max(...labelLines.map(line => estimateTextWidth(line)));
        const idWidth = estimateTextWidth(node.id || '', NODE_ID_AVG_WIDTH);
        const width = Math.ceil(Math.max(
            STORE_MIN_WIDTH,
            STORE_ID_COLUMN_WIDTH + STORE_TEXT_PADDING_X * 2 + labelWidth,
            STORE_ID_COLUMN_WIDTH + idWidth + STORE_TEXT_PADDING_X * 2
        ));
        const height = Math.ceil(Math.max(
            STORE_MIN_HEIGHT,
            labelLines.length * TEXT_LINE_HEIGHT + 24
        ));
        const left = -width / 2;
        const right = width / 2;
        const top = -height / 2;
        const bottom = height / 2;
        const dividerX = left + STORE_ID_COLUMN_WIDTH;
        const idCenterX = left + STORE_ID_COLUMN_WIDTH / 2;
        const labelCenterX = dividerX + (right - dividerX) / 2;
        
        return {
            width,
            height,
            left,
            right,
            top,
            bottom,
            dividerX,
            idCenterX,
            labelCenterX,
            labelLines
        };
    }

    function getNodeBounds(node) {
        if (node.type === 'process') {
            const r = getProcessLayout(node).radius;
            return {
                left: node.x - r,
                top: node.y - r,
                right: node.x + r,
                bottom: node.y + r
            };
        }
        
        if (node.type === 'entity') {
            return {
                left: node.x - 45,
                top: node.y - 30,
                right: node.x + 45,
                bottom: node.y + 30
            };
        }
        
        if (node.type === 'store') {
            const layout = getStoreLayout(node);
            return {
                left: node.x + layout.left,
                top: node.y + layout.top,
                right: node.x + layout.right,
                bottom: node.y + layout.bottom
            };
        }
        
        return {
            left: node.x,
            top: node.y,
            right: node.x,
            bottom: node.y
        };
    }

    // Ray-box intersection and exact circle intersection
    function getNodeIntersection(source, target) {
        const cx1 = source.x;
        const cy1 = source.y;
        const cx2 = target.x;
        const cy2 = target.y;
        
        const dx = cx2 - cx1;
        const dy = cy2 - cy1;
        const dist = Math.sqrt(dx * dx + dy * dy);
        
        if (dist === 0) return { p1: { x: cx1, y: cy1 }, p2: { x: cx2, y: cy2 } };
        
        const dirX = dx / dist;
        const dirY = dy / dist;
        
        function getBorderPoint(node, dx, dy) {
            const cx = node.x;
            const cy = node.y;
            
            if (node.type === 'process') {
                const r = getProcessLayout(node).radius;
                return { x: cx + r * dx, y: cy + r * dy };
            } else if (node.type === 'entity') {
                const w = 90;
                const h = 60;
                return getRectIntersection(cx, cy, w, h, dx, dy);
            } else if (node.type === 'store') {
                const layout = getStoreLayout(node);
                return getRectIntersection(cx, cy, layout.width, layout.height, dx, dy);
            }
            return { x: cx, y: cy };
        }
        
        return {
            p1: getBorderPoint(source, dirX, dirY),
            p2: getBorderPoint(target, -dirX, -dirY)
        };
    }

    function getRectIntersection(cx, cy, w, h, dx, dy) {
        if (dx === 0 && dy === 0) return { x: cx, y: cy };
        
        // Ray parameter t for sides
        const tX = dx > 0 ? (w / 2) / dx : (-w / 2) / dx;
        const tY = dy > 0 ? (h / 2) / dy : (-h / 2) / dy;
        const t = Math.min(tX, tY);
        
        return {
            x: cx + t * dx,
            y: cy + t * dy
        };
    }

    // Mouse Interaction Handlers
    function onMouseDown(e) {
        SoundManager.init(); // Ensure audio context is ready on user gesture
        SoundManager.playClick();

        const coords = screenToCanvas(e.clientX, e.clientY);

        if (activeTool === 'select') {
            // Clicked canvas background — start panning
            isPanning = true;
            panStart = { x: e.clientX, y: e.clientY };
            selectElement(null);
        } else if (activeTool === 'process' || activeTool === 'entity' || activeTool === 'store') {
            // Place new node at click position
            const id = DiagramModel.generateUniqueId(activeTool);
            const label = activeTool.toUpperCase() + ' NODE';
            
            // Snap placement to grid
            const snappedX = Math.round(coords.x / SNAP_GRID) * SNAP_GRID;
            const snappedY = Math.round(coords.y / SNAP_GRID) * SNAP_GRID;
            
            const newNode = DiagramModel.addNode(id, activeTool, label, snappedX, snappedY);
            
            // Play sound and reset to select tool
            SoundManager.playSuccess();
            setTool('select');
            selectElement('node', newNode.id);
            
            if (onStateModified) onStateModified();
        } else if (activeTool === 'link') {
            // Clicked empty canvas while in link mode — do nothing, require clicking a node
            SoundManager.playError();
        }
    }

    function initiateNodeClick(e, node) {
        if (activeTool === 'select') {
            dragNode = node.id;
            dragStart = { x: e.clientX, y: e.clientY };
            nodeOffset = { x: node.x, y: node.y };
            // Save one undo snapshot at drag start (drag moves use skipHistory=true)
            DiagramModel.updateNode(node.id, { x: node.x, y: node.y });
            selectElement('node', node.id);
            SoundManager.startDragHum();
        } else if (activeTool === 'link') {
            // Start connection drag-line
            linkSourceNode = node;
            
            tempLine = document.createElementNS('http://www.w3.org/2000/svg', 'line');
            tempLine.setAttribute('class', 'linking-line');
            tempLine.setAttribute('x1', node.x);
            tempLine.setAttribute('y1', node.y);
            tempLine.setAttribute('x2', node.x);
            tempLine.setAttribute('y2', node.y);
            
            groupTemp.appendChild(tempLine);
        }
    }

    function onMouseMove(e) {
        const coords = screenToCanvas(e.clientX, e.clientY);

        if (dragNode) {
            // Dragging node
            const dx = (e.clientX - dragStart.x) / zoomLevel;
            const dy = (e.clientY - dragStart.y) / zoomLevel;
            
            // Calculate speed for sound hum pitch
            const speed = Math.sqrt(dx*dx + dy*dy);
            SoundManager.updateDragHum(speed);

            const targetX = nodeOffset.x + dx;
            const targetY = nodeOffset.y + dy;
            
            // Snap to grid
            const snappedX = Math.round(targetX / SNAP_GRID) * SNAP_GRID;
            const snappedY = Math.round(targetY / SNAP_GRID) * SNAP_GRID;

            DiagramModel.updateNode(dragNode, { x: snappedX, y: snappedY }, true);
            
            // Dynamic redraw
            draw();
        } else if (isPanning) {
            // Panning canvas
            const dx = e.clientX - panStart.x;
            const dy = e.clientY - panStart.y;
            panX += dx;
            panY += dy;
            panStart = { x: e.clientX, y: e.clientY };
            applyTransform();
        } else if (linkSourceNode && tempLine) {
            // Update drag connection line
            tempLine.setAttribute('x2', coords.x);
            tempLine.setAttribute('y2', coords.y);
            
            // Check if hovering over a valid target node to highlight
            const hoverNode = getHoverNode(e.target);
            document.querySelectorAll('.dfd-node').forEach(nodeEl => {
                nodeEl.classList.remove('selected');
            });
            if (hoverNode && hoverNode !== linkSourceNode.id) {
                const hoverEl = groupNodes.querySelector(`[data-id="${hoverNode}"]`);
                if (hoverEl) hoverEl.classList.add('selected');
            }
        }
    }

    function onMouseUp(e) {
        if (dragNode) {
            dragNode = null;
            SoundManager.stopDragHum();
            SoundManager.playClick();
            if (onStateModified) onStateModified();
        }
        
        if (isPanning) {
            isPanning = false;
        }

        if (linkSourceNode && tempLine) {
            const hoverNodeId = getHoverNode(e.target);
            
            if (hoverNodeId && hoverNodeId !== linkSourceNode.id) {
                // Success connection!
                const flow = DiagramModel.addFlow(linkSourceNode.id, hoverNodeId, 'DATA FLOW');
                SoundManager.playSuccess();
                setTool('select');
                if (flow) selectElement('flow', flow.id);
                if (onStateModified) onStateModified();
            } else {
                // Cancelled
                SoundManager.playError();
                clearTempLink();
                draw();
            }
        }
    }

    // Helper to traverse DOM and find SVG node element
    function getHoverNode(target) {
        let el = target;
        while (el && el !== svg) {
            if (el.classList && el.classList.contains('dfd-node')) {
                return el.getAttribute('data-id');
            }
            el = el.parentElement;
        }
        return null;
    }

    // Zooming using mouse wheel
    function onWheel(e) {
        e.preventDefault();
        
        const zoomFactor = 1.1;
        const coordsBefore = screenToCanvas(e.clientX, e.clientY);
        
        if (e.deltaY < 0) {
            zoomLevel = Math.min(MAX_ZOOM, zoomLevel * zoomFactor);
        } else {
            zoomLevel = Math.max(MIN_ZOOM, zoomLevel / zoomFactor);
        }

        // Adjust pan to zoom relative to mouse cursor
        const coordsAfter = screenToCanvas(e.clientX, e.clientY);
        panX += (coordsAfter.x - coordsBefore.x) * zoomLevel;
        panY += (coordsAfter.y - coordsBefore.y) * zoomLevel;

        applyTransform();
    }

    // Selection management
    function selectElement(type, id) {
        if (!type) {
            selectedElement = null;
        } else {
            selectedElement = { type, id };
        }

        // Redraw to reflect selection border changes
        draw();

        if (onSelectionChange) {
            onSelectionChange(selectedElement);
        }
    }

    // Zoom interface functions
    function zoomIn() {
        zoomLevel = Math.min(MAX_ZOOM, zoomLevel * 1.2);
        applyTransform();
        SoundManager.playClick();
    }

    function zoomOut() {
        zoomLevel = Math.max(MIN_ZOOM, zoomLevel / 1.2);
        applyTransform();
        SoundManager.playClick();
    }

    function resetZoom() {
        zoomLevel = 1.0;
        panX = 0;
        panY = 0;
        applyTransform();
        SoundManager.playClick();
    }

    function fitToContent(options = {}) {
        if (!svg) return false;

        const nodesList = Object.values(DiagramModel.getNodes());
        if (nodesList.length === 0) {
            if (options.force) {
                zoomLevel = 1.0;
                panX = 0;
                panY = 0;
                applyTransform();
            }
            return false;
        }

        const rect = svg.getBoundingClientRect();
        if (rect.width <= 0 || rect.height <= 0) return false;

        const padding = rect.width < 640 ? 36 : 72;
        const availableWidth = Math.max(160, rect.width - padding * 2);
        const availableHeight = Math.max(160, rect.height - padding * 2);

        let left = Infinity;
        let top = Infinity;
        let right = -Infinity;
        let bottom = -Infinity;

        nodesList.forEach(node => {
            const bounds = getNodeBounds(node);
            left = Math.min(left, bounds.left);
            top = Math.min(top, bounds.top);
            right = Math.max(right, bounds.right);
            bottom = Math.max(bottom, bounds.bottom);
        });

        const boundsWidth = Math.max(1, right - left);
        const boundsHeight = Math.max(1, bottom - top);
        const contentOverflows = boundsWidth + padding * 2 > rect.width || boundsHeight + padding * 2 > rect.height;

        if (!options.force && !contentOverflows) return false;

        zoomLevel = Math.max(MIN_ZOOM, Math.min(
            MAX_ZOOM,
            1,
            availableWidth / boundsWidth,
            availableHeight / boundsHeight
        ));

        panX = (rect.width - boundsWidth * zoomLevel) / 2 - left * zoomLevel;
        panY = (rect.height - boundsHeight * zoomLevel) / 2 - top * zoomLevel;
        applyTransform();
        return true;
    }

    return {
        init,
        draw,
        setTool,
        selectElement,
        zoomIn,
        zoomOut,
        resetZoom,
        fitToContent,
        getSelected: () => selectedElement,
        getTool: () => activeTool,
        getNodeBounds
    };
})();
