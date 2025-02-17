class WorldGen {
    constructor() {
        this.initialSize = 8;
        this.octaves = 6;
        this.falloff = 0.5;
        this.amplitude = 20;
        this.chunkSize = 32;
        this.initialHeight = -24;
    }

    generate() {
        const chunks = [];
        const [grid, size] = this._generateGrid();

        // Loop through all chunks
        const dirt = VoxelChunk.blocks.dirt;
        const grass = VoxelChunk.blocks.grass;
        const stone = VoxelChunk.blocks.stone;
        for (let cz = 0; cz < size; cz += this.chunkSize) {
            for (let cx = 0; cx < size; cx += this.chunkSize) {

                const chunk = new VoxelChunk();
                chunk.setBlock(cx, -5, cz, 0);
                chunk.setBlock(cx, 0, cz, 0);

                // Loop through all cells
                for (let z = cz; z < size && z < cz + this.chunkSize; z++) {
                    for (let x = cx; x < size && x < cx + this.chunkSize; x++) {

                        // Generate column of blocks
                        const height = Math.round(grid[x + z * size]);
                        for (let y = -5; y <= height; y++) {
                            chunk.setBlock(x, y, z, y === height && y >= -1 ? grass : dirt);
                        }

                    }
                }

                chunks.push(chunk);

            }
        }

        return chunks;
    }

    _generateGrid() {
        let size = this.initialSize;
        let grid = this._getFlatGrid(size, this.initialHeight);
        let amp = this.amplitude;
        this._addWhiteNoise(grid, size, amp);
        for (let octave = 0; octave < this.octaves; octave++) {
            size = this._upscaleGrid(grid, size);
            this._addWhiteNoise(grid, size, amp);
            amp *= this.falloff;
        }

        return [grid, size];
    }

    _getFlatGrid(size, value) {
        const max = size * size;
        const grid = [];
        for (let i = 0; i < max; i++) {
            grid[i] = value;
        }
        return grid;
    }

    _upscaleGrid(grid, oldSize) {
        const newSize = oldSize * 2;

        // Copy unchanged values
        for (let z = oldSize - 1; z >= 0; z--) {
            for (let x = oldSize - 1; x >= 0; x--) {
                grid[x * 2 + z * 2 * newSize] = grid[x + z * oldSize];
            }
        }

        // Interpolate horizontally
        for (let z = 0; z < newSize; z += 2) {
            for (let x = 0; x < newSize; x += 2) {
                const left = grid[x + z * newSize];
                const right = grid[(x + 2) % newSize + z * newSize];
                grid[x + 1 + z * newSize] = (left + right) / 2;
            }
        }

        // Interpolate vertically
        for (let z = 0; z < newSize; z += 2) {
            for (let x = 0; x < newSize; x++) {
                const top = grid[x + z * newSize];
                const bottom = grid[x + (z + 2) % newSize * newSize];
                grid[x + (z + 1) * newSize] = (top + bottom) / 2;
            }
        }

        return newSize;
    }

    _addWhiteNoise(grid, size, factor) {
        for (let z = 0; z < size; z++) {
            for (let x = 0; x < size; x++) {
                grid[x + z * size] += Math.random() * factor;
            }
        }
    }
}
