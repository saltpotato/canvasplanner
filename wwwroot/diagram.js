window.diagram = {
    dotnet: null,
    canvas: null,
    ctx: null,
    draggingId: null,
    offsetX: 0,
    offsetY: 0,
    blocks: [],
    links: [],

    init: function (dotnetRef) {
        this.dotnet = dotnetRef;
        this.canvas = document.getElementById("diagramCanvas");
        this.ctx = this.canvas.getContext("2d");

        this.canvas.addEventListener("mousedown", this.onMouseDown.bind(this));
        this.canvas.addEventListener("mousemove", this.onMouseMove.bind(this));
        this.canvas.addEventListener("mouseup", this.onMouseUp.bind(this));
        this.canvas.addEventListener("dblclick", this.onDoubleClick.bind(this));
    },

    draw: function (blocks, links) {
        this.blocks = blocks;
        this.links = links;

        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        // Lines
        links.forEach(l => {
            let from = blocks.find(b => b.id === l.from);
            let to = blocks.find(b => b.id === l.to);
            if (!from || !to) return;

            this.ctx.beginPath();
            this.ctx.moveTo(from.x + 50, from.y + 25);
            this.ctx.lineTo(to.x + 50, to.y + 25);
            this.ctx.stroke();
        });

        // Blocks
        blocks.forEach(b => {
            this.ctx.fillStyle = "#ffd";
            this.ctx.fillRect(b.x, b.y, 100, 50);

            this.ctx.strokeStyle = "#333";
            this.ctx.strokeRect(b.x, b.y, 100, 50);

            this.ctx.font = "14px sans-serif";
            this.ctx.fillStyle = "#000";
            this.ctx.fillText(b.text, b.x + 10, b.y + 28);
        });
    },

    hitTest(x, y) {
        return this.blocks.find(b =>
            x >= b.x && x <= b.x + 100 &&
            y >= b.y && y <= b.y + 50
        );
    },

    onMouseDown(e) {
        let rect = this.canvas.getBoundingClientRect();
        let x = e.clientX - rect.left;
        let y = e.clientY - rect.top;

        let hit = this.hitTest(x, y);
        if (hit) {
            this.draggingId = hit.id;
            this.offsetX = x - hit.x;
            this.offsetY = y - hit.y;
        }
    },

    onMouseMove(e) {
        if (!this.draggingId) return;

        let rect = this.canvas.getBoundingClientRect();
        let x = e.clientX - rect.left - this.offsetX;
        let y = e.clientY - rect.top - this.offsetY;

        let block = this.blocks.find(b => b.id === this.draggingId);
        block.x = x;
        block.y = y;

        this.draw(this.blocks, this.links);
    },

    onMouseUp(e) {
        if (this.draggingId) {
            let block = this.blocks.find(b => b.id === this.draggingId);
            this.dotnet.invokeMethodAsync(
                "UpdateBlockPosition",
                block.id, block.x, block.y);
        }
        this.draggingId = null;
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
