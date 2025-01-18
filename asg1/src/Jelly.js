class JellySquare {
    static stepsPerSecond = 60;
    static dt = 1 / this.stepsPerSecond;
    static gravity = 4.0;
    static edgeForce = 20;
    static edgeDamping = 0.05;
    static pushMultiplier = 2;
    static drag = 0.01;
    static jellies = [];
    static buffer = null;
    static bufferData = new Float32Array(8);
    static temp = [];

    constructor(x, y, r, g, b, size) {
        this.edgeLength = size * 2 / canvas.height;
        this.r = r;
        this.g = g;
        this.b = b;

        const dx = this.edgeLength / 2;
        this.positions = [
            x - dx, y - dx,
            x - dx, y + dx,
            x + dx, y + dx,
            x + dx, y - dx
        ];

        this.velocities = [0,0, 0,0, 0,0, 0,0];

        JellySquare.jellies.push(this);

        if (!JellySquare.buffer) {
            JellySquare.buffer = gl.createBuffer();
            gl.bindBuffer(gl.ARRAY_BUFFER, JellySquare.buffer);
            gl.bufferData(gl.ARRAY_BUFFER, 4 * 8, gl.DYNAMIC_DRAW);
        }
    }

    static canPlace(x, y, size) {
        const minx = x - size / canvas.width;
        const maxx = x + size / canvas.width;
        const miny = y - size / canvas.height;
        const maxy = y + size / canvas.height;

        for (const jelly of this.jellies) {
            const p = jelly.positions;
            let testMinx = Math.min(p[0], p[2], p[4], p[6]);
            let testMaxx = Math.max(p[0], p[2], p[4], p[6]);
            let testMiny = Math.min(p[1], p[3], p[5], p[7]);
            let testMaxy = Math.max(p[1], p[3], p[5], p[7]);

            const noOverlap = testMaxx < minx || testMinx > maxx || testMaxy < miny || testMiny > maxy;
            if (!noOverlap)
                return false;
        }

        return true;
    }

    render() {
        gl.uniform4f(u_Color, this.r, this.g, this.b, 1);

        for (let i = 0; i < 8; i++) {
            JellySquare.bufferData[i] = this.positions[i];
        }
        gl.bindBuffer(gl.ARRAY_BUFFER, JellySquare.buffer);
        gl.bufferSubData(gl.ARRAY_BUFFER, 0, JellySquare.bufferData);
        gl.vertexAttribPointer(a_Position, 2, gl.FLOAT, false, 0, 0);
        gl.enableVertexAttribArray(a_Position);

        gl.drawArrays(gl.TRIANGLE_FAN, 0, 4);
    }

    applyForces() {
        // Go through all edges of this jelly
        for (let i = 0; i < 8; i += 2) {
            const a1x = this.positions[i];
            const a1y = this.positions[i + 1];
            const b1x = this.positions[(i + 2) % 8];
            const b1y = this.positions[(i + 3) % 8];

            let n1x = a1y - b1y;
            let n1y = b1x - a1x;
            const len1 = Math.sqrt(n1x * n1x + n1y * n1y);
            n1x /= len1;
            n1y /= len1;

            // Repeat for a few evenly-spaced points along the edge
            const iters = 10;
            for (let iter = 0; iter < iters; iter++) {
                const t = iter / (iters - 1);
                const px = a1x + (b1x - a1x) * t;
                const py = a1y + (b1y - a1y) * t;

                // Push this point out of all other jelly edges
                for (const other of JellySquare.jellies) {
                    if (other === this) continue;

                    let minPushx = 0;
                    let minPushy = 0;
                    let minPush = Infinity;
                    let contained = true;

                    for (let j = 0; j < 8; j += 2) {
                        const a2x = other.positions[j];
                        const a2y = other.positions[j + 1];
                        const b2x = other.positions[(j + 2) % 8];
                        const b2y = other.positions[(j + 3) % 8];

                        let n2x = a2y - b2y;
                        let n2y = b2x - a2x;
                        const len2 = Math.sqrt(n2x * n2x + n2y * n2y);
                        n2x /= len2;
                        n2y /= len2;

                        const pushDist = -((px - a2x) * n2x + (py - a2y) * n2y);
                        if (pushDist < 0) {
                            contained = false;
                            break;
                        }

                        const pushx = n2x * pushDist;
                        const pushy = n2y * pushDist;

                        if (pushDist < minPush) {
                            minPush = pushDist;
                            minPushx = pushx;
                            minPushy = pushy;
                        }
                    }

                    if (contained) {
                        this.velocities[(i + 0) % 8] += (1 - t) * minPushx * JellySquare.stepsPerSecond / iters * JellySquare.pushMultiplier;
                        this.velocities[(i + 1) % 8] += (1 - t) * minPushy * JellySquare.stepsPerSecond / iters * JellySquare.pushMultiplier;
                        this.velocities[(i + 2) % 8] += t * minPushx * JellySquare.stepsPerSecond / iters * JellySquare.pushMultiplier;
                        this.velocities[(i + 3) % 8] += t * minPushy * JellySquare.stepsPerSecond / iters * JellySquare.pushMultiplier;
                    }
                }
            }

            const px = this.positions[i];
            const py = this.positions[i + 1];
            
            let vx = this.velocities[i];
            let vy = this.velocities[i + 1];

            // Apply gravity
            vy -= JellySquare.gravity * JellySquare.dt;

            // Maintain edge length
            for (let e = 2; e < 8; e += 2) {
                const targetLen = e == 4 ? this.edgeLength * Math.SQRT2 : this.edgeLength;
                const ax = this.positions[(i + e) % 8];
                const ay = this.positions[(i + e + 1) % 8];
                const dx = px - ax;
                const dy = py - ay;
                const len = Math.max(Math.sqrt(dx * dx + dy * dy), 0.00000001);
                const dirx = dx / len;
                const diry = dy / len;
                const force = JellySquare.edgeForce * (targetLen - len);

                vx += force * dirx;
                vy += force * diry;
            }

            // Apply velocity change
            this.velocities[i] = vx;
            this.velocities[i + 1] = vy;
        }

        // Dampen velocity between adjacent edges
        for (let i = 0; i < 8; i++) {
            JellySquare.temp[i] = this.velocities[i];
        }

        for (let i = 0; i < 8; i++) {
            this.velocities[i] = JellySquare.temp[i] * (1 - JellySquare.edgeDamping * 3)
                + JellySquare.temp[(i + 2) % 8] * JellySquare.edgeDamping
                + JellySquare.temp[(i + 4) % 8] * JellySquare.edgeDamping
                + JellySquare.temp[(i + 6) % 8] * JellySquare.edgeDamping;
        }
    }

    step() {
        // Move all points based on velocity
        for (let i = 0; i < 8; i++) {
            this.positions[i] += this.velocities[i] * JellySquare.dt;

            // Bounce off of canvas borders
            if (this.positions[i] < -1) {
                this.positions[i] = -1;
                this.velocities[i] = Math.abs(this.velocities[i]);
            }
            if (this.positions[i] > 1) {
                this.positions[i] = 1;
                this.velocities[i] = -Math.abs(this.velocities[i]);
            }

            // Apply drag
            this.velocities[i] *= 1 - JellySquare.drag;
        }
    }

    cleanup() {
        JellySquare.jellies.splice(JellySquare.jellies.indexOf(this), 1);
    }
}
