/**
 * Calculates shortest paths from all accessible voxels to a single voxel.
 */
class Pathfinder {
    constructor(range) {
        this.range = Math.round(range);
        this.cells = new Map();
        this.destination = [];
        this.bounds = null;
    }

    /**
     * Recalculate all paths.
     * @param {number} x 
     * @param {number} y 
     * @param {number} z 
     */
    setDestination(x, y, z) {
        x = Math.floor(x);
        y = Math.floor(y);
        z = Math.floor(z);
        if (this.destination[0] === x && this.destination[1] === y && this.destination[2] === z)
            return;
        this.destination[0] = x;
        this.destination[1] = y;
        this.destination[2] = z;

        this.cells.clear();
        if (!this.isTraversable(x, y, z))
            return;

        this.setCell(x, y, z, 0);
        const queue = [[x, y, z]];
        let queueInd = 0;

        const startTime = performance.now();

        let nextPos = [0, 0, 0];
        while (queueInd < queue.length) {
            const pos = queue[queueInd++];
            const parentPathLength = this.getCell(pos[0], pos[1], pos[2]);

            // Check all neighbors
            for (let oz = -1; oz <= 1; oz++) {
                for (let oy = -1; oy <= 1; oy++) {
                    for (let ox = -1; ox <= 1; ox++) {

                        nextPos[0] = pos[0] + ox;
                        nextPos[1] = pos[1] + oy;
                        nextPos[2] = pos[2] + oz;

                        if (this.getCell(nextPos[0], nextPos[1], nextPos[2]) === undefined
                            && this.isTraversable(nextPos[0], nextPos[1], nextPos[2])
                            && Pathfinder.canMoveBetween(pos[0], pos[1], pos[2], nextPos[0], nextPos[1], nextPos[2])) {
                            this.setCell(nextPos[0], nextPos[1], nextPos[2], parentPathLength + 1);
                            queue.push(nextPos);
                            nextPos = [0, 0, 0];
                        }
                    }
                }
            }
            
            if (performance.now() - startTime > 10000) {
                console.log("Pathfinder took too long!");
                break;
            }
        }
    }

    /**
     * Assuming (x, y, z) and (a, b, c) are traversable, checks if movement between them is unobstructed.
     * @param {number} x 
     * @param {number} y 
     * @param {number} z 
     * @param {number} a 
     * @param {number} b 
     * @param {number} c 
     */
    static canMoveBetween(x, y, z, a, b, c) {
        const dirs = (x !== a) + (y !== b) + (z !== c);
        switch (dirs)
        {
            case 1:
                return true;
            case 2:
                if (x !== a && !this.obstructed(a, y, z)) return true;
                if (y !== b && !this.obstructed(x, b, z)) return true;
                if (z !== c && !this.obstructed(x, y, c)) return true;
                return false;
            case 3:
                return false;
        }

        return false;
    }

    /**
     * Checks if any chunk has a block at (x, y, z).
     * @param {number} x 
     * @param {number} y 
     * @param {number} z 
     */
    static obstructed(x, y, z) {
        for (const chunk of chunks) {
            if (chunk.getBlock(x, y, z))
                return true;
        }
        return false;
    }

    /**
     * Checks if there is a surface to climb on near (x, y, z).
     * @param {number} x 
     * @param {number} y 
     * @param {number} z 
     */
    isTraversable(x, y, z) {
        x = Math.floor(x);
        y = Math.floor(y);
        z = Math.floor(z);

        // Check if in range
        const r = this.range;
        const d = this.destination;
        if (x <= d[0] - r || x >= d[0] + r || y < -1 || y < d[1] - r || y >= d[1] + r || z <= d[2] - r || z >= d[2] + r)
            return false;

        // Check if in map bounds
        const b = this.bounds;
        if (b) {
            if (x < b[0] || y < b[1] || z < b[2] || x >= b[3] || y >= b[4] || z >= b[5])
                return false;
        }

        return Pathfinder.isTraversable(x, y, z);
    }

    static isTraversable(x, y, z) {
        x = Math.floor(x);
        y = Math.floor(y);
        z = Math.floor(z);

        // Disallow movement through solid blocks
        if (Pathfinder.obstructed(x, y, z))
            return false;

        // Allow swimming
        if (y === -1)
            return true;
        else if (y < -1)
            return false;

        // Allow climbing on everything but ceilings
        for (const chunk of chunks) {
            // for (let oz = -1; oz <= 1; oz++) {
            //     for (let ox = -1; ox <= 1; ox++) {
            //         for (let oy = -1; oy <= 0; oy++) {
            //             if (chunk.getBlock(x + ox, y + oy, z + oz))
            //                 return true;
            //         }
            //     }
            // }
            if (chunk.getBlock(x - 1, y, z)
                || chunk.getBlock(x + 1, y, z)
                || chunk.getBlock(x, y - 1, z)
                || chunk.getBlock(x, y, z - 1)
                || chunk.getBlock(x, y, z + 1))
                return true;
        }
        
        return false;
    }

    /**
     * Gets distance from the voxel (x, y, z) to the current destination.
     * @param {number} x 
     * @param {number} y 
     * @param {number} z 
     */
    getCell(x, y, z) {
        const r = 200000; // Approximately cbrt(MAX_SAFE_INTEGER)
        const o = 100000;
        const d = this.destination;
        x = x - d[0] + o;
        y = y - d[1] + o;
        z = z - d[2] + o;
        return this.cells.get(x + (y + z * r) * r);
    }

    setCell(x, y, z, value) {
        const r = 200000; // Approximately cbrt(MAX_SAFE_INTEGER)
        const o = 100000;
        const d = this.destination;
        x = x - d[0] + o;
        y = y - d[1] + o;
        z = z - d[2] + o;
        this.cells.set(x + (y + z * r) * r, value);
    }

    /**
     * Gets the next tile to move to when pathing from (x, y, z) to the current destination.
     * @param {number} x 
     * @param {number} y 
     * @param {number} z 
     */
    getNextPos(x, y, z) {
        x = Math.floor(x);
        y = Math.floor(y);
        z = Math.floor(z);
        let xBest = null;
        let yBest = null;
        let zBest = null;
        let bestDist = this.getCell(x, y, z);

        const dx = this.destination[0];
        const dy = this.destination[1];
        const dz = this.destination[2];

        for (let ox = -1; ox <= 1; ox++) {
            for (let oy = -1; oy <= 1; oy++) {
                for (let oz = -1; oz <= 1; oz++) {
                    const dist = this.getCell(x + ox, y + oy, z + oz);
                    if (dist == undefined)
                        continue;

                    if (!Pathfinder.canMoveBetween(x, y, z, x + ox, y + oy, z + oz))
                        continue;

                    if (bestDist === undefined
                        || dist < bestDist
                        || dist === bestDist && (xBest === null || isCloser(dx, dy, dz, x + ox, y + oy, z + oz, xBest, yBest, zBest))) {
                        xBest = x + ox;
                        yBest = y + oy;
                        zBest = z + oz;
                        bestDist = dist;
                    }
                }
            }
        }

        return xBest === null || yBest === null || zBest === null
            ? null
            : [xBest, yBest, zBest];
    }
}

/**
 * Finds paths from each voxel to various areas throughout the map.
 */
class PathMap {
    constructor(x, y, z, range) {
        /** @type {Array<Pathfinder>} */
        this.nodes = [];
        this._origin = [x, y, z];
        this._range = range;
        this._spacing = 20;
        this._xMin = x - range;
        this._zMin = z - range;
        this._xMax = x + range;
        this._zMax = z + range;
        this._nodeStride = Math.ceil((this._xMax - this._xMin) / this._spacing);
        this._addNodes();
    }

    _addNodes() {
        const reachability = new Pathfinder(Math.ceil(this._range * Math.SQRT2));
        reachability.setDestination(this._origin[0], this._origin[1], this._origin[2]);

        // Loop through all chunks
        const xMin = this._xMin;
        const xMax = this._xMax;
        const zMin = this._zMin;
        const zMax = this._zMax;
        const bounds = [xMin, -1, zMin, xMax, Infinity, zMax];
        const spacing = this._spacing;
        for (let x = xMin; x < xMax; x += spacing) {
            for (let z = zMin; z < zMax; z += spacing) {
                const cx = Math.floor((x - xMin) / spacing);
                const cz = Math.floor((z - zMin) / spacing);

                // Find a suitable Y coordinate for the node
                let y = this._origin[1] + 21;
                for (let i = 20; i >= -20 && !reachability.getCell(x, y, z); i--)
                    y = this._origin[1] + i;

                if (!reachability.getCell(x, y, z))
                    y = this._origin[1];

                // Create a node for each chunk
                const node = new Pathfinder(Math.ceil(this._range * 2 * Math.SQRT2));
                node.bounds = bounds;
                node.setDestination(x, y, z);
                this.nodes[cx + cz * this._nodeStride] = node;
            }
        }
    }

    /**
     * Gets a random pathfinder on the map.
     */
    getRandomNode() {
        const i = Math.min(Math.floor(Math.random() * this.nodes.length), this.nodes.length - 1);
        return this.nodes[i];
    }

    /**
     * Gets the next tile to move to when pathing from (x, y, z) to the pathfinder's destination,
     * falling back to mapped nodes when out of range.
     * @param {number} x 
     * @param {number} y 
     * @param {number} z 
     * @param {Pathfinder} pathfinder 
     */
    getNextPos(x, y, z, pathfinder) {
        // Check if pathfinder is in range
        let dir = pathfinder.getNextPos(x, y, z);
        if (dir !== null)
            return dir;

        // Out of range, use fallback node
        const dest = pathfinder.destination;
        const cx = this._getChunkX(dest[0]);
        const cz = this._getChunkZ(dest[2]);
        const node = this.nodes[cx + cz * this._nodeStride];
        return node.getNextPos(x, y, z);
    }

    isMapped(x, y, z) {
        const cx = this._getChunkX(x);
        const cz = this._getChunkZ(z);
        const node = this.nodes[cx + cz * this._nodeStride];
        return node.getCell(x, y, z) !== undefined;
    }

    _getChunkX(x) {
        return Math.min(Math.max(0, Math.round((x - this._xMin) / this._spacing)), this._nodeStride - 1);
    }

    _getChunkZ(z) {
        return Math.min(Math.max(0, Math.round((z - this._zMin) / this._spacing)), this._nodeStride - 1);
    }
}
