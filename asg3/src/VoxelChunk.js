// Vertex shader program for blocks
const VS_BLOCK = `
attribute vec3 a_Position;
attribute vec3 a_Normal;
attribute vec2 a_Uv;
attribute vec3 a_Color;

uniform mat4 u_ProjectionMatrix;
uniform mat4 u_ViewMatrix;
uniform mat4 u_ModelMatrix;

varying vec3 v_Normal;
varying vec2 v_Uv;
varying vec3 v_Color;
varying float v_Submersion;

void main() {
    vec4 worldPos = u_ModelMatrix * vec4(a_Position, 1);
    gl_Position = u_ProjectionMatrix * u_ViewMatrix * worldPos;
    v_Normal = normalize(mat3(u_ModelMatrix) * a_Normal);
    v_Color = a_Color;
    v_Uv = a_Uv;
    v_Submersion = -0.5 - worldPos.y;
}
`;

// Fragment shader program for blocks
const FS_BLOCK = `
uniform sampler2D u_Atlas;
uniform sampler2D u_Glow;
uniform mediump vec3 u_LightDirection;
uniform lowp vec4 u_Overlay;

varying mediump vec3 v_Normal;
varying highp vec2 v_Uv;
varying lowp vec3 v_Color;
varying mediump float v_Submersion;

void main() {
    lowp vec4 color = texture2D(u_Atlas, v_Uv);
    lowp vec4 glow = texture2D(u_Glow, v_Uv);
    if (color.a < 0.5) discard;
    color.a = 1.0;

    gl_FragColor.a = color.a;

    mediump float sun = 0.6 + 0.4 * dot(v_Normal, u_LightDirection);
    mediump float ambient = 0.15 + 0.15 * dot(v_Normal, vec3(0.0, 1.0, 0.0));

    gl_FragColor.rgb = ambient * color.rgb * vec3(0.6, 0.8, 0.9) + sun * color.rgb;
    gl_FragColor.rgb *= v_Color;
    gl_FragColor.rgb = mix(gl_FragColor.rgb, glow.rgb, glow.a);
    gl_FragColor.rgb = mix(gl_FragColor.rgb, vec3(0.1, 0.15, 0.2), clamp(v_Submersion / 9.0 + float(v_Submersion > 0.0) * 0.5, 0.0, 1.0));

    // Apply overlay
    gl_FragColor.rgb = mix(gl_FragColor.rgb, u_Overlay.rgb, u_Overlay.a);
}
`;

class VoxelChunk
{
    static blocks = {
        bricks: 1,
        dirt: 2,
        grass: 3,
        tiles: 4,
        woodBeam: 5,
        paintedWood: 6,
        rock: 7,
        sand: 8,
        gravel: 9,
    };

    static _uvs = [
        null,
        // Bricks
        [
            [0,0, 1,1], // Sides
            [0,1, 1,2], // Top
            [0,1, 1,2], // Bottom
        ],
        // Dirt
        [
            [1,0, 2,1], // Sides
            [1,0, 2,1], // Top
            [1,0, 2,1], // Bottom
        ],
        // Grass
        [
            [1,1, 2,2], // Sides
            [1,2, 2,3], // Top
            [1,0, 2,1], // Bottom
        ],
        // Tiles
        [
            [2,0, 3,1], // Sides
            [2,0, 3,1], // Top
            [2,0, 3,1], // Bottom
        ],
        // Wood Beam
        [
            [2,2, 3,3], // Sides
            [2,1, 3,2], // Top
            [2,1, 3,2], // Bottom
        ],
        // Painted Wood
        [
            [3,0, 4,1], // Sides
            [3,1, 4,2], // Top
            [3,1, 4,2], // Bottom
        ],
        // Rock
        [
            [0,2, 1,3], // Sides
            [0,3, 1,4], // Top
            [0,3, 1,4], // Bottom
        ],
        // Sand
        [
            [2,3, 3,4], // Sides
            [2,3, 3,4], // Top
            [2,3, 3,4], // Bottom
        ],
        // Gravel
        [
            [1,3, 2,4], // Sides
            [1,3, 2,4], // Top
            [1,3, 2,4], // Bottom
        ],
    ];

    constructor() {
        this._data = [];
        this._size = [0, 0, 0];
        this._origin = [0, 0, 0];
        this._buffer = gl.createBuffer();
        this._meshDirty = true;
        this._vertexCount = 0;
        this._modelMatrix = new Matrix4();
        this.position = new Vector3();
    }

    static _data = [];
    _rebuildMesh() {
        const data = VoxelChunk._data;
        const normal = new Vector3();
        const tangent = new Vector3();
        const bitangent = new Vector3();
        const point = new Vector3();
        const center = new Vector3();
        const corner = new Vector3();
        const atlasWidth = 4;
        const atlasHeight = 4;
        const m = 0.5 / 128;
        let dataInd = 0;

        function add(point, u, v, dark) {
            data[dataInd++] = point.elements[0];
            data[dataInd++] = point.elements[1];
            data[dataInd++] = point.elements[2];
            data[dataInd++] = normal.elements[0];
            data[dataInd++] = normal.elements[1];
            data[dataInd++] = normal.elements[2];
            data[dataInd++] = u;
            data[dataInd++] = v;
            data[dataInd++] = dark ? 0.5 : 1;
            data[dataInd++] = dark ? 0.5 : 1;
            data[dataInd++] = dark ? 0.5 : 1;
        }

        // Loop through all blocks
        const minX = this._origin[0];
        const minY = this._origin[1];
        const minZ = this._origin[2];
        const maxX = minX + this._size[0];
        const maxY = minY + this._size[1];
        const maxZ = minZ + this._size[2];
        for (let z = minZ; z < maxZ; z++) {
            for (let y = minY; y < maxY; y++) {
                for (let x = minX; x < maxX; x++) {

                    // Only generate faces for solid blocks
                    const id = this.getBlock(x, y, z);
                    if (!id)
                        continue;

                    corner.elements[0] = x;
                    corner.elements[1] = y;
                    corner.elements[2] = z;
                    center.elements[0] = x + 0.5;
                    center.elements[1] = y + 0.5;
                    center.elements[2] = z + 0.5;

                    // Loop through all faces
                    for (let axis = 0; axis < 3; axis++) {
                        for (let dir = -1; dir <= 1; dir += 2) {
                            // Don't add bottom faces
                            if (y === -5 && axis === 1 && dir === -1)
                                continue;

                            // Compute face normals and tangent
                            normal.sub(normal);
                            normal.elements[axis] = dir;

                            // Only include a face if it isn't right up against a block
                            if (this.getBlock(x + normal.elements[0], y + normal.elements[1], z + normal.elements[2]))
                                continue;

                            let uvs;
                            tangent.sub(tangent);
                            if (axis !== 1) {
                                // Sides
                                tangent.elements[1] = -1;
                                uvs = VoxelChunk._uvs[id][0];
                            } else if (dir === 1) {
                                // Top
                                tangent.elements[0] = 1;
                                uvs = VoxelChunk._uvs[id][1];
                            } else {
                                // Bottom
                                tangent.elements[0] = 1;
                                uvs = VoxelChunk._uvs[id][2];
                            }
                            bitangent.set(normal).cross(tangent);
                            
                            // Tangent is down, bitangent is left
                            const c = corner.elements;
                            const n = normal.elements;
                            const t = tangent.elements;
                            const b = bitangent.elements;
                            const td = this.getBlock(c[0] + n[0] - t[0], c[1] + n[1] - t[1], c[2] + n[2] - t[2]);
                            const rd = this.getBlock(c[0] + n[0] - b[0], c[1] + n[1] - b[1], c[2] + n[2] - b[2]);
                            const bd = this.getBlock(c[0] + n[0] + t[0], c[1] + n[1] + t[1], c[2] + n[2] + t[2]);
                            const ld = this.getBlock(c[0] + n[0] + b[0], c[1] + n[1] + b[1], c[2] + n[2] + b[2]);
                            
                            const trd = this.getBlock(c[0] + n[0] - t[0] - b[0], c[1] + n[1] - t[1] - b[1], c[2] + n[2] - t[2] - b[2]);
                            const brd = this.getBlock(c[0] + n[0] - b[0] + t[0], c[1] + n[1] - b[1] + t[1], c[2] + n[2] - b[2] + t[2]);
                            const bld = this.getBlock(c[0] + n[0] + t[0] + b[0], c[1] + n[1] + t[1] + b[1], c[2] + n[2] + t[2] + b[2]);
                            const tld = this.getBlock(c[0] + n[0] + b[0] - t[0], c[1] + n[1] + b[1] - t[1], c[2] + n[2] + b[2] - t[2]);

                            add(point.set(normal).add(bitangent).add(tangent).mul(0.5).add(center), (uvs[2] - m) / atlasWidth, (uvs[3] - m) / atlasHeight, ld || bd || bld);
                            add(point.set(normal).sub(bitangent).sub(tangent).mul(0.5).add(center), (uvs[0] + m) / atlasWidth, (uvs[1] + m) / atlasHeight, rd || td || trd);
                            add(point.set(normal).sub(bitangent).add(tangent).mul(0.5).add(center), (uvs[0] + m) / atlasWidth, (uvs[3] - m) / atlasHeight, rd || bd || brd);
                            add(point.set(normal).add(bitangent).add(tangent).mul(0.5).add(center), (uvs[2] - m) / atlasWidth, (uvs[3] - m) / atlasHeight, ld || bd || bld);
                            add(point.set(normal).add(bitangent).sub(tangent).mul(0.5).add(center), (uvs[2] - m) / atlasWidth, (uvs[1] + m) / atlasHeight, ld || td || tld);
                            add(point.set(normal).sub(bitangent).sub(tangent).mul(0.5).add(center), (uvs[0] + m) / atlasWidth, (uvs[1] + m) / atlasHeight, rd || td || trd);
                        }
                    }

                }
            }
        }
        this._vertexCount = dataInd / 11;

        // Upload into buffer
        gl.bindBuffer(gl.ARRAY_BUFFER, this._buffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(data.slice(0, dataInd)), gl.STATIC_DRAW);
    }

    setModelMatrix(mat) {
        this._modelMatrix.set(mat);
    }

    render() {
        if (this._meshDirty) {
            this._rebuildMesh();
            this._meshDirty = false;
        }

        const temp = getMat4();
        temp.set(this._modelMatrix);
        if (input.chunksWiggle) {
            temp.translate(0, Math.cos(performance.now() / 1000 * 2 + chunks.indexOf(this) * 0.5) * 0.15, 0);
        }
        
        gl.useProgram(shaders.block.program);
        gl.uniformMatrix4fv(shaders.block.u_ModelMatrix, false, temp.elements);
        gl.uniform1i(shaders.block.u_Atlas, 0);
        gl.uniform1i(shaders.block.u_Glow, 4);
        gl.bindBuffer(gl.ARRAY_BUFFER, this._buffer);
        gl.enableVertexAttribArray(shaders.block.a_Position);
        gl.enableVertexAttribArray(shaders.block.a_Normal);
        gl.enableVertexAttribArray(shaders.block.a_Uv);
        gl.enableVertexAttribArray(shaders.block.a_Color);
        gl.vertexAttribPointer(shaders.block.a_Position, 3, gl.FLOAT, false, 4 * 11, 0);
        gl.vertexAttribPointer(shaders.block.a_Normal, 3, gl.FLOAT, true, 4 * 11, 4 * 3);
        gl.vertexAttribPointer(shaders.block.a_Uv, 2, gl.FLOAT, false, 4 * 11, 4 * 6);
        gl.vertexAttribPointer(shaders.block.a_Color, 3, gl.FLOAT, false, 4 * 11, 4 * 8);

        gl.drawArrays(gl.TRIANGLES, 0, this._vertexCount);

        freeMat4(temp);
    }

    delete() {
        gl.deleteBuffer(this._buffer);
    }

    expand(ox, oy, oz, sx, sy, sz) {
        const newData = [];
        const oldData = this._data;
        const newLength = sx * sy * sz;
        for (let i = 0; i < newLength; i++) {
            newData[i] = 0;
        }

        let oldI = 0;
        let newI = ox + oy * sx + oz * sx * sy;
        for (let z = 0; z < this._size[2]; z++) {
            for (let y = 0; y < this._size[1]; y++) {
                for (let x = 0; x < this._size[0]; x++) {
                    newData[newI++] = oldData[oldI++];
                }
                newI += sx - this._size[0];
            }
            newI += (sy - this._size[1]) * sx;
        }

        this._size[0] = sx;
        this._size[1] = sy;
        this._size[2] = sz;
        this._origin[0] -= ox;
        this._origin[1] -= oy;
        this._origin[2] -= oz;
        this._data = newData;
    }

    setBlock(x, y, z, id) {
        if (y < -5) return;
        const minX = this._origin[0];
        const minY = this._origin[1];
        const minZ = this._origin[2];
        const maxX = minX + this._size[0];
        const maxY = minY + this._size[1];
        const maxZ = minZ + this._size[2];

        if (x < minX || y < minY || z < minZ || x >= maxX || y >= maxY || z >= maxZ) {
            let newMinX = Math.min(minX, x);
            let newMinY = Math.min(minY, y);
            let newMinZ = Math.min(minZ, z);
            let newMaxX = Math.max(maxX, x + 1);
            let newMaxY = Math.max(maxY, y + 1);
            let newMaxZ = Math.max(maxZ, z + 1);

            if (this._size[0] === 0 || this._size[1] === 0 || this._size[2] === 0) {
                newMinX = x;
                newMinY = y;
                newMinZ = z;
                newMaxX = x + 1;
                newMaxY = y + 1;
                newMaxZ = z + 1;
            }

            this.expand(
                minX - newMinX,
                minY - newMinY,
                minZ - newMinZ,
                newMaxX - newMinX,
                newMaxY - newMinY,
                newMaxZ - newMinZ
            );
        }

        const lx = x - this._origin[0];
        const ly = y - this._origin[1];
        const lz = z - this._origin[2];
        const index = lx + (ly + lz * this._size[1]) * this._size[0];
        if (this._data[index] != id) {
            this._data[index] = id;
            this._meshDirty = true;
        }
    }

    getBlock(x, y, z) {
        if (typeof x !== "number") {
            z = x.elements[2];
            y = x.elements[1];
            x = x.elements[0];
        }

        const lx = x - this._origin[0];
        const ly = y - this._origin[1];
        const lz = z - this._origin[2];
        if (lx < 0 || ly < 0 || lz < 0 || lx >= this._size[0] || ly >= this._size[1] || lz >= this._size[2])
            return 0;
        return this._data[lx + (ly + lz * this._size[1]) * this._size[0]];
    }

    isEmpty() {
        for (let i = 0; i < this._data.length; i++) {
            if (this._data)
                return false;
        }
        return true;
    }

    grassify() {
        const minX = this._origin[0];
        const minY = Math.max(this._origin[1], -1);
        const minZ = this._origin[2];
        const maxX = this._origin[0] + this._size[0];
        const maxY = this._origin[1] + this._size[1];
        const maxZ = this._origin[2] + this._size[2];

        const dirt = VoxelChunk.blocks.dirt;
        const grass = VoxelChunk.blocks.grass;
        for (let z = minZ; z < maxZ; z++) {
            for (let x = minX; x < maxX; x++) {
                let lastDirt = false;
                for (let y = minY; y < maxY; y++) {
                    const id = this.getBlock(x, y, z);
                    if (lastDirt && id === 0) {
                        this.setBlock(x, y - 1, z, grass);
                    }
                    lastDirt = id === dirt;
                }
            }
        }
    }

    /**
     * Converts this chunk into an ArrayBuffer.
     * @returns 
     */
    serialize() {
        const buffer = new ArrayBuffer(2 * 6 + this._data.length);
        const view = new DataView(buffer);
        view.setUint16(0, this._size[0]);
        view.setUint16(2, this._size[1]);
        view.setUint16(4, this._size[2]);
        view.setInt16(6, this._origin[0]);
        view.setInt16(8, this._origin[1]);
        view.setInt16(10, this._origin[2]);
        for (let i = 0; i < this._data.length; i++) {
            view.setInt8(12 + i, this._data[i]);
        }

        return buffer;
    }

    /**
     * Fills this chunk's data from an ArrayBuffer.
     * @param {ArrayBuffer} buffer 
     */
    deserialize(buffer) {
        const view = new DataView(buffer);

        for (let i = 0; i < 3; i++) {
            this._size[i] = view.getUint16(i * 2);
            this._origin[i] = view.getInt16(i * 2 + 6);
        }
        
        const count = this._size[0] * this._size[1] * this._size[2];
        this._data = [];
        for (let i = 0; i < count; i++)
            this._data[i] = view.getUint8(12 + i);

        this._meshDirty = true;

        return 12 + this._size[0] * this._size[1] * this._size[2];
    }

    async save(name) {

        const reader = new Blob([serialize()]).stream().pipeThrough(new CompressionStream("deflate")).getReader();
        const chunks = [];
        let chunk;
        let length = 0;
        while (!(chunk = await reader.read()).done) {
            chunks.push(chunk.value);
            length += chunk.value.length;
        }

        const link = document.createElement("a");
        link.href = URL.createObjectURL(new Blob(chunks));
        link.download = name;
        link.click();
    }

    async load(stream) {
        const reader = stream.pipeThrough(new DecompressionStream("deflate")).getReader();
        let chunk;
        let i = 0;
        const header = new ArrayBuffer(2 * 6);
        const headerView = new DataView(header);
        while (!(chunk = await reader.read()).done) {
            let chunkI = 0;

            while (i < header.byteLength && chunkI < chunk.value.length)
                headerView.setUint8(i++, chunk.value[chunkI++]);

            while (chunkI < chunk.value.length)
                this._data[i++ - header.byteLength] = chunk.value[chunkI++];
        }

        for (let i = 0; i < 3; i++) {
            this._size[i] = headerView.getUint16(i * 2);
            this._origin[i] = headerView.getInt16(i * 2 + 6);
        }

        this._meshDirty = true;
    }

    // Adapted from http://www.cs.yorku.ca/~amana/research/grid.pdf
    /**
     * Casts a ray against this chunk.
     * @param {number} x 
     * @param {number} y 
     * @param {number} z 
     * @param {number} dx 
     * @param {number} dy 
     * @param {number} dz 
     */
    cast(x, y, z, dx, dy, dz) {
        const minX = this._origin[0];
        const minY = this._origin[1];
        const minZ = this._origin[2];
        const maxX = minX + this._size[0];
        const maxY = minY + this._size[1];
        const maxZ = minZ + this._size[2];

        let t = rayCastAABB(x, y, z, dx, dy, dz, minX, minY, minZ, maxX, maxY, maxZ);
        if (!isFinite(t)) return null;

        x += dx * (t - 0.01);
        y += dy * (t - 0.01);
        z += dz * (t - 0.01);
        t = 0;

        // Current voxel position
        let vX = Math.floor(x);
        let vY = Math.floor(y);
        let vZ = Math.floor(z);

        // Signs of ray direction components
        let stepX = dx > 0 ? 1 : -1;
        let stepY = dy > 0 ? 1 : -1;
        let stepZ = dz > 0 ? 1 : -1;

        // First voxel outside of chunk in each direction
        let justOutX = stepX > 0 ? maxX : minX - 1;
        let justOutY = stepY > 0 ? maxY : minY - 1;
        let justOutZ = stepZ > 0 ? maxZ : minZ - 1;

        // Amount t must increase to move from one voxel to the next
        let tDeltaX = 1 / Math.abs(dx);
        let tDeltaY = 1 / Math.abs(dy);
        let tDeltaZ = 1 / Math.abs(dz);

        // t values of next grid line in each direction
        let tMaxX = (vX + (dx > 0) - x) / dx;
        let tMaxY = (vY + (dy > 0) - y) / dy;
        let tMaxZ = (vZ + (dz > 0) - z) / dz;

        let normal = -1;
        while (true) {
            if (tMaxX < tMaxY && tMaxX < tMaxZ) {
                vX += stepX;
                if (vX === justOutX) return null;
                t = tMaxX;
                tMaxX += tDeltaX;
                normal = 0;
            } else if (tMaxY < tMaxX && tMaxY < tMaxZ) {
                vY += stepY;
                if (vY === justOutY) return null;
                t = tMaxY;
                tMaxY += tDeltaY;
                normal = 1;
            } else {
                vZ += stepZ;
                if (vZ === justOutZ) return null;
                t = tMaxZ;
                tMaxZ += tDeltaZ;
                normal = 2;
            }

            const id = this.getBlock(vX, vY, vZ);
            if (id) {
                return {
                    voxelX: vX,
                    voxelY: vY,
                    voxelZ: vZ,
                    hitX: x + dx * t,
                    hitY: y + dy * t,
                    hitZ: z + dz * t,
                    normalX: normal === 0 ? -stepX : 0,
                    normalY: normal === 1 ? -stepY : 0,
                    normalZ: normal === 2 ? -stepZ : 0,
                };
            }
        }
    }

    /**
     * Casts a rectangle in the Z direction.
     * @param {number} z 
     * @param {number} endZ 
     * @param {number} xMin 
     * @param {number} xMax 
     * @param {number} yMin 
     * @param {number} yMax 
     */
    castRectZ(z, endZ, xMin, xMax, yMin, yMax) {
        const dir = Math.sign(endZ - z);
        if (dir === 0) return endZ;

        xMin = Math.max(Math.floor(xMin), this._origin[0]);
        xMax = Math.min(Math.floor(xMax) + 1, this._origin[0] + this._size[0]);
        yMin = Math.max(Math.floor(yMin), this._origin[1]);
        yMax = Math.min(Math.floor(yMax) + 1, this._origin[1] + this._size[1]);

        for (let testZ = Math.floor(z + dir * 0.5); Math.sign(endZ - (testZ + 0.5 - dir * 0.5)) === dir; testZ += dir) {
            if (this.anySolid(xMin, yMin, testZ, xMax, yMax, testZ + 1))
                return testZ + 0.5 - dir * 0.5;
        }

        return endZ;
    }

    /**
     * Casts a rectangle in the Y direction.
     * @param {number} y 
     * @param {number} endY 
     * @param {number} xMin 
     * @param {number} xMax 
     * @param {number} zMin 
     * @param {number} zMax 
     */
    castRectY(y, endY, xMin, xMax, zMin, zMax) {
        const dir = Math.sign(endY - y);
        if (dir === 0) return endY;

        xMin = Math.max(Math.floor(xMin), this._origin[0]);
        xMax = Math.min(Math.floor(xMax) + 1, this._origin[0] + this._size[0]);
        zMin = Math.max(Math.floor(zMin), this._origin[2]);
        zMax = Math.min(Math.floor(zMax) + 1, this._origin[2] + this._size[2]);

        for (let testY = Math.floor(y + dir * 0.5); Math.sign(endY - (testY + 0.5 - dir * 0.5)) === dir; testY += dir) {
            if (this.anySolid(xMin, testY, zMin, xMax, testY + 1, zMax))
                return testY + 0.5 - dir * 0.5;
        }

        return endY;
    }

    /**
     * Casts a rectangle in the X direction.
     * @param {number} x 
     * @param {number} endX 
     * @param {number} yMin 
     * @param {number} yMax 
     * @param {number} zMin 
     * @param {number} zMax 
     */
    castRectX(x, endX, yMin, yMax, zMin, zMax) {
        const dir = Math.sign(endX - x);
        if (dir === 0) return endX;

        yMin = Math.max(Math.floor(yMin), this._origin[1]);
        yMax = Math.min(Math.floor(yMax) + 1, this._origin[1] + this._size[1]);
        zMin = Math.max(Math.floor(zMin), this._origin[2]);
        zMax = Math.min(Math.floor(zMax) + 1, this._origin[2] + this._size[2]);

        for (let testX = Math.floor(x + dir * 0.5); Math.sign(endX - (testX + 0.5 - dir * 0.5)) === dir; testX += dir) {
            if (this.anySolid(testX, yMin, zMin, testX + 1, yMax, zMax))
                return testX + 0.5 - dir * 0.5;
        }

        return endX;
    }

    anySolid(xMin, yMin, zMin, xMax, yMax, zMax) {
        for (let z = zMin; z < zMax; z++) {
            for (let y = yMin; y < yMax; y++) {
                for (let x = xMin; x < xMax; x++) {
                    if (this.getBlock(x, y, z)) return true;
                }
            }
        }

        return false;
    }

    getClosestPoint(x, y, z, radius) {
        const xMin = Math.floor(x - radius);
        const yMin = Math.floor(y - radius);
        const zMin = Math.floor(z - radius);
        const xMax = Math.floor(x + radius) + 1;
        const yMax = Math.floor(y + radius) + 1;
        const zMax = Math.floor(z + radius) + 1;

        let xBest = null;
        let yBest = null;
        let zBest = null;
        let distBest = radius;
        for (let tz = zMin; tz < zMax; tz++) {
            for (let ty = yMin; ty < yMax; ty++) {
                for (let tx = xMin; tx < xMax; tx++) {
                    if (this.getBlock(tx, ty, tz)) {
                        const [xCloser, yCloser, zCloser] = closestPoint(tx, ty, tz, x, y, z)
                        const dx = xCloser - x;
                        const dy = yCloser - y;
                        const dz = zCloser - z;
                        const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
                        if (dist < distBest) {
                            xBest = xCloser;
                            yBest = yCloser;
                            zBest = zCloser;
                            distBest = dist;
                        }
                    }
                }
            }
        }

        return [xBest, yBest, zBest];
    }

    getMin() {
        return [...this._origin];
    }

    getMax() {
        const res = [];
        for (let i = 0; i < 3; i++)
            res[i] = this._origin[i] + this._size[i];
        return res;
    }
}
