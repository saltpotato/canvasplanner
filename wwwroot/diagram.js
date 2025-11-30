window.diagram = {
    dotnet: null,
    canvas: null,
    ctx: null,
    draggingId: null,
    offsetX: 0,
    offsetY: 0,
    blocks: [],
    links: [],
    connectStart: null,   // { blockId, side }
    previewTarget: null,  // { x, y, blockId?, side? }
    hoverBlockId: null,
    linkWidth: 2,
    handleRadius: 6,
    blockSize: { w: 100, h: 50 },
    contextMenuEl: null,

    init: function (dotnetRef) {
        this.dotnet = dotnetRef;
        this.canvas = document.getElementById("diagramCanvas");
        this.ctx = this.canvas.getContext("2d");

        this.canvas.addEventListener("mousedown", this.onMouseDown.bind(this));
        this.canvas.addEventListener("mousemove", this.onMouseMove.bind(this));
        this.canvas.addEventListener("mouseup", this.onMouseUp.bind(this));
        this.canvas.addEventListener("dblclick", this.onDoubleClick.bind(this));
        this.canvas.addEventListener("contextmenu", this.onContextMenu.bind(this));
        document.addEventListener("click", () => this.hideContextMenu());
    },

    draw: function (blocks, links) {
        this.blocks = blocks ?? this.blocks;
        this.links = links ?? this.links;

        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        // Lines
        this.ctx.strokeStyle = "#333";
        this.links.forEach(l => this.drawLink(l));

        // Connection preview
        if (this.connectStart && this.previewTarget) {
            const fromBlock = this.blocks.find(b => b.id === this.connectStart.blockId);
            const fromPoint = fromBlock ? this.getSidePoint(fromBlock, this.connectStart.side) : null;
            const toPoint = this.previewTarget.side && this.previewTarget.blockId
                ? this.getSidePoint(
                    this.blocks.find(b => b.id === this.previewTarget.blockId),
                    this.previewTarget.side)
                : this.previewTarget;

            if (fromPoint && toPoint) {
                this.ctx.save();
                this.ctx.setLineDash([6, 6]);
                this.ctx.strokeStyle = "#888";
                this.ctx.beginPath();
                this.ctx.moveTo(fromPoint.x, fromPoint.y);
                this.ctx.lineTo(toPoint.x, toPoint.y);
                this.ctx.stroke();
                this.ctx.restore();
            }
        }

        // Blocks + handles
        this.blocks.forEach(b => {
            this.ctx.fillStyle = "#ffd";
            this.ctx.fillRect(b.x, b.y, this.blockSize.w, this.blockSize.h);

            this.ctx.strokeStyle = "#333";
            this.ctx.lineWidth = 1;
            this.ctx.strokeRect(b.x, b.y, this.blockSize.w, this.blockSize.h);

            this.ctx.font = "14px sans-serif";
            this.ctx.fillStyle = "#000";
            this.ctx.fillText(b.text, b.x + 10, b.y + 28);

            this.drawHandles(b);
        });
    },

    drawLink(link) {
        const from = this.blocks.find(b => b.id === link.from);
        const to = this.blocks.find(b => b.id === link.to);
        if (!from || !to) return;

        const direction = link.direction || "forward";
        const kind = link.kind || "arrow";
        const fromPoint = this.getSidePoint(from, link.fromSide);
        const toPoint = this.getSidePoint(to, link.toSide);

        this.ctx.lineWidth = this.linkWidth;
        this.ctx.strokeStyle = "#333";
        this.ctx.beginPath();
        this.ctx.moveTo(fromPoint.x, fromPoint.y);
        this.ctx.lineTo(toPoint.x, toPoint.y);
        this.ctx.stroke();

        // adornments
        if (kind === "aggregation") {
            this.drawDiamond(fromPoint, toPoint);
        }

        if (direction === "forward" || direction === "both") {
            this.drawArrowHead(fromPoint, toPoint);
        }
        if (direction === "backward" || direction === "both") {
            this.drawArrowHead(toPoint, fromPoint);
        }
    },

    drawArrowHead(fromPoint, toPoint) {
        const angle = Math.atan2(toPoint.y - fromPoint.y, toPoint.x - fromPoint.x);
        const headLength = 10;

        this.ctx.beginPath();
        this.ctx.moveTo(toPoint.x, toPoint.y);
        this.ctx.lineTo(
            toPoint.x - headLength * Math.cos(angle - Math.PI / 6),
            toPoint.y - headLength * Math.sin(angle - Math.PI / 6)
        );
        this.ctx.lineTo(
            toPoint.x - headLength * Math.cos(angle + Math.PI / 6),
            toPoint.y - headLength * Math.sin(angle + Math.PI / 6)
        );
        this.ctx.closePath();
        this.ctx.fillStyle = this.ctx.strokeStyle;
        this.ctx.fill();
    },

    drawDiamond(startPoint, endPoint) {
        const angle = Math.atan2(endPoint.y - startPoint.y, endPoint.x - startPoint.x);
        const size = 10;
        const p1 = {
            x: startPoint.x + size * Math.cos(angle),
            y: startPoint.y + size * Math.sin(angle)
        };
        const p2 = {
            x: startPoint.x + (size / 2) * Math.cos(angle + Math.PI / 2),
            y: startPoint.y + (size / 2) * Math.sin(angle + Math.PI / 2)
        };
        const p3 = {
            x: startPoint.x + size * 1.2 * Math.cos(angle),
            y: startPoint.y + size * 1.2 * Math.sin(angle)
        };
        const p4 = {
            x: startPoint.x + (size / 2) * Math.cos(angle - Math.PI / 2),
            y: startPoint.y + (size / 2) * Math.sin(angle - Math.PI / 2)
        };

        this.ctx.beginPath();
        this.ctx.moveTo(startPoint.x, startPoint.y);
        this.ctx.lineTo(p2.x, p2.y);
        this.ctx.lineTo(p1.x, p1.y);
        this.ctx.lineTo(p4.x, p4.y);
        this.ctx.closePath();
        this.ctx.fillStyle = "#fff";
        this.ctx.fill();
        this.ctx.stroke();
    },

    drawHandles(block) {
        if (!this.shouldShowHandles(block.id)) return;
        const handles = this.getHandleCenters(block);
        this.ctx.fillStyle = "#444";
        Object.values(handles).forEach(p => {
            this.ctx.beginPath();
            this.ctx.arc(p.x, p.y, this.handleRadius, 0, Math.PI * 2);
            this.ctx.fill();
        });
    },

    shouldShowHandles(blockId) {
        return this.hoverBlockId === blockId || (this.connectStart && this.connectStart.blockId === blockId);
    },

    getHandleCenters(block) {
        return {
            left: { x: block.x, y: block.y + this.blockSize.h / 2 },
            right: { x: block.x + this.blockSize.w, y: block.y + this.blockSize.h / 2 },
            top: { x: block.x + this.blockSize.w / 2, y: block.y },
            bottom: { x: block.x + this.blockSize.w / 2, y: block.y + this.blockSize.h }
        };
    },

    getSidePoint(block, side) {
        return this.getHandleCenters(block)[side] ?? this.getHandleCenters(block).right;
    },

    hitTest(x, y) {
        return this.blocks.find(b =>
            x >= b.x && x <= b.x + this.blockSize.w &&
            y >= b.y && y <= b.y + this.blockSize.h
        );
    },

    hitHandle(x, y) {
        for (let b of this.blocks) {
            const handles = this.getHandleCenters(b);
            for (const side of Object.keys(handles)) {
                const p = handles[side];
                const dx = p.x - x;
                const dy = p.y - y;
                if (Math.sqrt(dx * dx + dy * dy) <= this.handleRadius + 2) {
                    return { blockId: b.id, side, point: p };
                }
            }
        }
        return null;
    },

    nearestSide(block, x, y) {
        const handles = this.getHandleCenters(block);
        let best = "right";
        let bestDist = Infinity;
        for (const [side, p] of Object.entries(handles)) {
            const dx = p.x - x;
            const dy = p.y - y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist < bestDist) {
                bestDist = dist;
                best = side;
            }
        }
        return best;
    },

    findLinkNear(x, y, tolerance = 8) {
        let nearest = null;
        let nearestDist = tolerance;

        this.links.forEach(l => {
            const from = this.blocks.find(b => b.id === l.from);
            const to = this.blocks.find(b => b.id === l.to);
            if (!from || !to) return;

            const p1 = this.getSidePoint(from, l.fromSide);
            const p2 = this.getSidePoint(to, l.toSide);
            const dist = this.pointToSegmentDistance({ x, y }, p1, p2);
            if (dist < nearestDist) {
                nearestDist = dist;
                nearest = l;
            }
        });

        return nearest;
    },

    pointToSegmentDistance(p, v, w) {
        const l2 = (w.x - v.x) * (w.x - v.x) + (w.y - v.y) * (w.y - v.y);
        if (l2 === 0) return Math.hypot(p.x - v.x, p.y - v.y);
        let t = ((p.x - v.x) * (w.x - v.x) + (p.y - v.y) * (w.y - v.y)) / l2;
        t = Math.max(0, Math.min(1, t));
        const proj = { x: v.x + t * (w.x - v.x), y: v.y + t * (w.y - v.y) };
        return Math.hypot(p.x - proj.x, p.y - proj.y);
    },

    onMouseDown(e) {
        if (e.button !== 0) return;

        let rect = this.canvas.getBoundingClientRect();
        let x = e.clientX - rect.left;
        let y = e.clientY - rect.top;

        const handleHit = this.hitHandle(x, y);
        if (handleHit) {
            this.connectStart = { blockId: handleHit.blockId, side: handleHit.side };
            this.previewTarget = { x, y };
            this.hoverBlockId = handleHit.blockId;
            this.draw();
            return;
        }

        let hit = this.hitTest(x, y);
        if (hit) {
            this.draggingId = hit.id;
            this.offsetX = x - hit.x;
            this.offsetY = y - hit.y;
        }
    },

    onMouseMove(e) {
        let rect = this.canvas.getBoundingClientRect();
        let canvasX = e.clientX - rect.left;
        let canvasY = e.clientY - rect.top;

        const hoverHit = this.hitTest(canvasX, canvasY);
        this.hoverBlockId = hoverHit?.id ?? (this.connectStart ? this.connectStart.blockId : null);

        if (this.connectStart) {
            const hit = this.hitTest(canvasX, canvasY);
            if (hit && hit.id !== this.connectStart.blockId) {
                const side = this.nearestSide(hit, canvasX, canvasY);
                const point = this.getSidePoint(hit, side);
                this.previewTarget = { x: point.x, y: point.y, blockId: hit.id, side };
            } else {
                this.previewTarget = { x: canvasX, y: canvasY };
            }
            this.draw(this.blocks, this.links);
            return;
        }

        if (!this.draggingId) {
            this.draw(this.blocks, this.links);
            return;
        }

        let x = canvasX - this.offsetX;
        let y = canvasY - this.offsetY;

        let block = this.blocks.find(b => b.id === this.draggingId);
        block.x = x;
        block.y = y;

        this.draw(this.blocks, this.links);
    },

    onMouseUp(e) {
        if (this.connectStart) {
            if (this.previewTarget?.blockId && this.previewTarget.blockId !== this.connectStart.blockId) {
                const from = this.connectStart.blockId;
                const to = this.previewTarget.blockId;
                const fromSide = this.connectStart.side;
                const toSide = this.previewTarget.side ?? "left";

                const exists = this.links.some(l =>
                    l.from === from &&
                    l.to === to &&
                    l.fromSide === fromSide &&
                    l.toSide === toSide);

                if (!exists) {
                    const newLink = {
                        from,
                        to,
                        fromSide,
                        toSide,
                        direction: "forward",
                        kind: "arrow"
                    };
                    this.links.push(newLink);
                    this.dotnet.invokeMethodAsync("AddConnection", from, to, fromSide, toSide, "forward", "arrow");
                }
            }

            this.connectStart = null;
            this.previewTarget = null;
            this.hoverBlockId = null;
            this.draw(this.blocks, this.links);
            return;
        }

        if (this.draggingId) {
            let block = this.blocks.find(b => b.id === this.draggingId);
            this.dotnet.invokeMethodAsync(
                "UpdateBlockPosition",
                block.id, block.x, block.y);
        }
        this.draggingId = null;
    },

    onContextMenu(e) {
        e.preventDefault();
        const rect = this.canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        const block = this.hitTest(x, y);
        if (block) {
            this.showBlockMenu(block, e.clientX, e.clientY);
            return;
        }

        const link = this.findLinkNear(x, y);
        if (link) {
            this.showLinkMenu(link, e.clientX, e.clientY);
        }
    },

    showLinkMenu(link, clientX, clientY) {
        this.hideContextMenu();

        const menu = document.createElement("div");
        menu.style.position = "fixed";
        menu.style.left = `${clientX}px`;
        menu.style.top = `${clientY}px`;
        menu.style.background = "#fff";
        menu.style.border = "1px solid #999";
        menu.style.padding = "8px";
        menu.style.boxShadow = "0 2px 6px rgba(0,0,0,0.2)";
        menu.style.font = "13px sans-serif";
        menu.style.zIndex = 1000;
        menu.addEventListener("click", ev => ev.stopPropagation());

        const title = document.createElement("div");
        title.textContent = "Connection";
        title.style.fontWeight = "bold";
        title.style.marginBottom = "4px";
        menu.appendChild(title);

        const updateLink = (changes) => {
            const idx = this.links.findIndex(l =>
                l.from === link.from &&
                l.to === link.to &&
                l.fromSide === link.fromSide &&
                l.toSide === link.toSide);
            if (idx >= 0) {
                this.links[idx] = { ...this.links[idx], ...changes };
                const updated = this.links[idx];
                this.dotnet.invokeMethodAsync(
                    "UpdateConnectionMeta",
                    updated.from,
                    updated.to,
                    updated.fromSide,
                    updated.toSide,
                    updated.direction,
                    updated.kind);
                this.draw(this.blocks, this.links);
            }
            this.hideContextMenu();
        };

        const addSection = (labelText, options, currentValue, key) => {
            const label = document.createElement("div");
            label.textContent = labelText;
            label.style.marginTop = "4px";
            menu.appendChild(label);

            options.forEach(opt => {
                const btn = document.createElement("button");
                btn.textContent = opt.label + (opt.value === currentValue ? " ✓" : "");
                btn.style.display = "block";
                btn.style.width = "100%";
                btn.style.textAlign = "left";
                btn.style.marginTop = "2px";
                btn.addEventListener("click", () => updateLink({ [key]: opt.value }));
                menu.appendChild(btn);
            });
        };

        addSection("Direction", [
            { label: "From → To", value: "forward" },
            { label: "To → From", value: "backward" },
            { label: "Both directions", value: "both" },
            { label: "No arrow", value: "none" }
        ], link.direction ?? "forward", "direction");

        addSection("Type", [
            { label: "Arrow", value: "arrow" },
            { label: "Aggregation (diamond)", value: "aggregation" }
        ], link.kind ?? "arrow", "kind");

        document.body.appendChild(menu);
        this.contextMenuEl = menu;
    },

    showBlockMenu(block, clientX, clientY) {
        this.hideContextMenu();

        const menu = document.createElement("div");
        menu.style.position = "fixed";
        menu.style.left = `${clientX}px`;
        menu.style.top = `${clientY}px`;
        menu.style.background = "#fff";
        menu.style.border = "1px solid #999";
        menu.style.padding = "8px";
        menu.style.boxShadow = "0 2px 6px rgba(0,0,0,0.2)";
        menu.style.font = "13px sans-serif";
        menu.style.zIndex = 1000;
        menu.addEventListener("click", ev => ev.stopPropagation());

        const title = document.createElement("div");
        title.textContent = "Block";
        title.style.fontWeight = "bold";
        title.style.marginBottom = "6px";
        menu.appendChild(title);

        let runBtn = null;
        const updateRunBtn = () => {
            if (!runBtn) return;
            runBtn.disabled = !updated.command || updated.command.trim().length === 0;
        };

        const addInput = (labelText, value, onChange) => {
            const label = document.createElement("div");
            label.textContent = labelText;
            label.style.marginTop = "4px";
            menu.appendChild(label);

            const input = document.createElement("textarea");
            input.value = value ?? "";
            input.rows = 4;
            input.style.width = "240px";
            input.addEventListener("keydown", ev => ev.stopPropagation());
            input.addEventListener("change", ev => { onChange(ev.target.value); updateRunBtn(); });
            input.addEventListener("input", ev => { onChange(ev.target.value); updateRunBtn(); });
            menu.appendChild(input);
        };

        let updated = { command: block.command ?? "", useSearch: block.useSearch ?? false };
        addInput("LLM Command", updated.command, v => updated.command = v);

        const searchWrapper = document.createElement("div");
        searchWrapper.style.marginTop = "6px";
        const searchLabel = document.createElement("label");
        const searchCheckbox = document.createElement("input");
        searchCheckbox.type = "checkbox";
        searchCheckbox.checked = updated.useSearch;
        searchCheckbox.addEventListener("change", ev => {
            updated.useSearch = ev.target.checked;
            updateRunBtn();
        });
        searchLabel.appendChild(searchCheckbox);
        searchLabel.appendChild(document.createTextNode(" Allow web search"));
        searchWrapper.appendChild(searchLabel);
        menu.appendChild(searchWrapper);

        const saveBtn = document.createElement("button");
        saveBtn.textContent = "Apply";
        saveBtn.style.marginTop = "8px";
        saveBtn.addEventListener("click", () => {
            block.command = updated.command;
            block.useSearch = updated.useSearch;
            this.dotnet.invokeMethodAsync("UpdateBlockMeta", block.id, block.text, block.command, block.useSearch);
            this.hideContextMenu();
        });
        menu.appendChild(saveBtn);

        runBtn = document.createElement("button");
        runBtn.textContent = "Run LLM";
        runBtn.style.marginTop = "8px";
        runBtn.style.marginLeft = "6px";
        updateRunBtn();
        runBtn.addEventListener("click", async () => {
            block.command = updated.command;
            block.useSearch = updated.useSearch;
            await this.dotnet.invokeMethodAsync("UpdateBlockMeta", block.id, block.text, block.command, block.useSearch);
            runBtn.disabled = true;
            try {
                const result = await this.dotnet.invokeMethodAsync("ExecuteBlockCommand", block.id);
                alert(result);
            } catch (err) {
                alert("Failed to run LLM: " + err);
            } finally {
                runBtn.disabled = false;
            }
        });
        menu.appendChild(runBtn);

        document.body.appendChild(menu);
        this.contextMenuEl = menu;
    },

    hideContextMenu() {
        if (this.contextMenuEl) {
            this.contextMenuEl.remove();
            this.contextMenuEl = null;
        }
    },

    onDoubleClick(e) {
        let rect = this.canvas.getBoundingClientRect();
        let x = e.clientX - rect.left;
        let y = e.clientY - rect.top;

        let hit = this.hitTest(x, y);
        if (!hit) return;

        const newText = prompt("Edit block text:", hit.text);
        if (newText === null) return;

        hit.text = newText;
        this.draw(this.blocks, this.links);
        this.dotnet.invokeMethodAsync("UpdateBlockText", hit.id, newText);
    }
};
