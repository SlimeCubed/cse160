class LimitBreaker {
    constructor() {
        const [min, max] = getWorldMinMax();
        this.min = min;
        this.max = max;
        this.radius = 1;
        this.index = 1;
        this.chunkSize = 16;
        this.started = false;
        this.randSize = 128;
        this.renderDist = 0;
        this.maxRenderDist = 16;
        this.rand = [];
        this.spawnedChunks = new Set();
        for (let i = 0; i < this.randSize * this.randSize; i++)
            this.rand[i] = Math.random();

        this.placingChunks = [];
    }

    start() {
        for (const chunk of chunks) chunk.delete();
        chunks = [];
        this.started = true;
    }

    stop() {
        for (const chunk of chunks) chunk.delete();
        chunks = [];
    }

    update(dt) {
        if (!this.started) return;

        this.renderDist = Math.min(this.renderDist + dt, this.maxRenderDist);

        const renderDist = this.renderDist;
        const px = player.position.elements[0] / this.chunkSize;
        const pz = player.position.elements[2] / this.chunkSize;
        for (let ox = -renderDist; ox <= renderDist; ox++) {
            for (let oz = -renderDist; oz <= renderDist; oz++) {
                const cx = Math.floor(px + ox);
                const cz = Math.floor(pz + oz);
                const i = cx + 100000 * cz;
                const dist = Math.sqrt(Math.pow(cx - px + 0.5, 2) + Math.pow(cz - pz + 0.5, 2));
                if (dist < renderDist && !this.spawnedChunks.has(i)) {
                    this.spawnedChunks.add(i);
                    this._addChunk(cx, cz);
                }
            }
        }

        const temp = getMat4();

        for (let i = this.placingChunks.length - 1; i >= 0; i--) {
            const data = this.placingChunks[i];
            data.t = Math.min(data.t + dt, 1);
            temp.setTranslate(0, Math.pow(1 - data.t, 2) * -20, 0);
            data.chunk.setModelMatrix(temp);

            if (data.t === 1) {
                this.placingChunks.splice(i, 1);
            }
        }

        freeMat4(temp);
    }

    _addChunk(cx, cz) {
        const chunk = new VoxelChunk();

        const xMin = cx * this.chunkSize;
        const xMax = (cx + 1) * this.chunkSize;
        const zMin = cz * this.chunkSize;
        const zMax = (cz + 1) * this.chunkSize;

        chunk.setBlock(xMin, -5, zMin, 0);
        chunk.setBlock(xMax - 1, 0, zMax - 1, 0);

        let averageHeight = 0;
        for (let x = xMin; x < xMax; x++) {
            for (let z = zMin; z < zMax; z++) {
                let height = -15;

                // Base noise
                const octaves = 5;
                let sampleX = x / 2;
                let sampleZ = z / 2;
                let amplitude = 1;
                for (let octave = 0; octave < octaves; octave++) {
                    height += this._sampleNoiseBilinear(sampleX, sampleZ) * amplitude;
                    sampleX = sampleX / 2;
                    sampleZ = sampleZ / 2;
                    amplitude *= 2;
                }

                // Mountain
                height += 10000 / (Math.pow(x / 5 - 30, 2) + Math.pow(z / 10, 2) + 100);

                const biome = this._sampleNoiseBilinear(x / 64, z / 64);

                height = Math.ceil(height);
                for (let y = -5; y <= height; y++) {
                    if (y > 15 + biome * 15) {
                        chunk.setBlock(x, y, z, VoxelChunk.blocks.bricks);
                    } else if (y === height && y < 0) {
                        chunk.setBlock(x, y, z, VoxelChunk.blocks.sand);
                    } else if (y < height - 1) {
                        chunk.setBlock(x, y, z, VoxelChunk.blocks.rock);
                    } else if (biome < 0.5) {
                        chunk.setBlock(x, y, z, y === height && y >= 0 ? VoxelChunk.blocks.grass : VoxelChunk.blocks.dirt);
                    } else {
                        chunk.setBlock(x, y, z, VoxelChunk.blocks.gravel);
                    }
                }

                averageHeight += height;
            }
        }

        averageHeight /= this.chunkSize * this.chunkSize;

        const centerDist = Math.sqrt(xMin * xMin + zMin + zMin);
        let treeDensity = this._sampleNoiseBilinear(cx / 48, cz / 48);
        treeDensity -= Math.max((averageHeight - 10) / 20, 0);
        treeDensity -= Math.max(1 - (centerDist - 100) / 100, 0);
        if (Math.random() < treeDensity / 2) {
            const tx = randomInt(xMin, xMax);
            const tz = randomInt(zMin, zMax);
            let ty = -5;
            while (chunk.getBlock(tx, ty, tz))
                ty++;
            ty--;

            if (ty >= 0)
                this._placeLimb(chunk, tx + 0.5, ty + 0.5, tz + 0.5, Math.random() * 0.5 - 0.25, 1, Math.random() * 0.5 - 0.25, Math.random() * 10 + 5, 2);
        }

        chunks.push(chunk);
        this.placingChunks.push({ chunk: chunk, t: 0 });
    }

    _placeLimb(chunk, x, y, z, dx, dy, dz, length, maxDepth) {
        const len = Math.sqrt(dx * dx + dy * dy + dz * dz);
        dx /= len;
        dy /= len;
        dz /= len;
        for (let i = 0; i < length; i++) {
            x += dx;
            y += dy;
            z += dz;
            chunk.setBlock(Math.floor(x), Math.floor(y), Math.floor(z), VoxelChunk.blocks.woodBeam);

            if (maxDepth > 0 && i > length / 3 && Math.random() < 0.4) {
                this._placeLimb(
                    chunk,
                    x,
                    y,
                    z,
                    dx + (Math.random() * 2 - 1) * 0.9,
                    dy + (Math.random() * 2 - 1) * 0.9,
                    dz + (Math.random() * 2 - 1) * 0.9,
                    length * 0.5,
                    maxDepth - 1);
            }
        }
    }

    _sampleNoiseBilinear(x, z) {
        return lerp(
            lerp(this._sampleNoise(Math.floor(x), Math.floor(z)), this._sampleNoise(Math.ceil(x), Math.floor(z)), (x % 1 + 1) % 1),
            lerp(this._sampleNoise(Math.floor(x), Math.ceil(z)), this._sampleNoise(Math.ceil(x), Math.ceil(z)), (x % 1 + 1) % 1),
            (z % 1 + 1) % 1
        );
    }

    _sampleNoise(x, z) {
        const s = this.randSize;
        x = (x % s + s) % s;
        z = (z % s + s) % s;
        return this.rand[x + z * s];
    }
}