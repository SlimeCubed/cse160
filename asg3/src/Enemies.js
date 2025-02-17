class Enemy {
    constructor() {}
    update(dt) {}
    render() {}
    delete() {}
    shouldDespawn() {
        return false;
    }
    rayCast(x, y, z, dx, dy, dz) {
        return Infinity;
    }
    intersectSphere(x, y, z, radius) {
        return false;
    }
    shot(byPlayer) {}
    exploded(byPlayer) {}
}

class Effect {
    update(dt) {}
    render() {}
    shouldDespawn() {
        return false;
    }
    delete() {}
}

class Crawler extends Enemy {
    static _vertexCount = 0;
    static _bodyBuffer = null;

    constructor(pos) {
        super();
        this._points = [];
        this._ups = [];
        for (let i = 0; i < 4; i++) {
            const r = i / 4 * Math.PI * 2;
            this._points[i] = new Vector3(pos.elements);
            this._points[i].elements[0] += Math.cos(r) * 0.25;
            this._points[i].elements[2] += Math.sin(r) * 0.25;
            this._ups[i] = new Vector3([0, 1, 0]);
        }
        this._checkpoint = new Vector3(pos.elements);
        
        this.speed = 3;
        this.bodyLength = 2;
        this.dead = false;
        this.damage = 0.4;
        this.loop = null;

        if (!Crawler._bodyBuffer) {
            Crawler._bodyBuffer = gl.createBuffer();
            Crawler._buildMesh();
        }
    }

    static _buildMesh() {
        const data = [];
        const atlasWidth = 8;
        const atlasHeight = 8;
        const m = 0.5 / 128;
        let dataInd = 0;
        const pinch = 0.5;

        function add(x, y, z, u, v) {
            data[dataInd++] = (x * 2 - 1) * (1 - pinch * y);
            data[dataInd++] = y * 2 - 1;
            data[dataInd++] = (z * 2 - 1) * (1 - pinch * y);
            dataInd += 3;
            data[dataInd++] = u / atlasWidth;
            data[dataInd++] = v / atlasHeight;
            data[dataInd++] = 1;
            data[dataInd++] = 1;
            data[dataInd++] = 1;
        }

        function addFace(x1, y1, z1, u1, v1, x2, y2, z2, u2, v2, x3, y3, z3, u3, v3, x4, y4, z4, u4, v4) {
            add(x1, y1, z1, u1, v1);
            add(x2, y2, z2, u2, v2);
            add(x3, y3, z3, u3, v3);
            add(x1, y1, z1, u1, v1);
            add(x3, y3, z3, u3, v3);
            add(x4, y4, z4, u4, v4);
        }

        function addFaceDouble(x1, y1, z1, u1, v1, x2, y2, z2, u2, v2, x3, y3, z3, u3, v3, x4, y4, z4, u4, v4) {
            addFace(x1, y1, z1, u1, v1, x2, y2, z2, u2, v2, x3, y3, z3, u3, v3, x4, y4, z4, u4, v4);
            addFace(x1, y1, z1, u1, v1, x4, y4, z4, u4, v4, x3, y3, z3, u3, v3, x2, y2, z2, u2, v2);
        }

        // Bottom
        addFace(
            0, 0, 0, 1 + m, 0 + m,
            1, 0, 0, 1 + m, 1 - m,
            1, 0, 1, 2 - m, 1 - m,
            0, 0, 1, 2 - m, 0 + m,
        );

        // Top
        addFace(
            0, 0.85, 0, 0 + m, 0 + m,
            0, 0.85, 1, 1 - m, 0 + m,
            1, 0.85, 1, 1 - m, 1 - m,
            1, 0.85, 0, 0 + m, 1 - m,
        );

        // Front
        addFaceDouble(
            0, 0, 0, 0 + m, 2 - m,
            0, 1, 0, 0 + m, 1 + m,
            1, 1, 0, 1 - m, 1 + m,
            1, 0, 0, 1 - m, 2 - m,
        );

        // Back
        addFaceDouble(
            0, 0, 1, 0 + m, 2 - m,
            1, 0, 1, 1 - m, 2 - m,
            1, 1, 1, 1 - m, 1 + m,
            0, 1, 1, 0 + m, 1 + m,
        );

        // Left
        addFaceDouble(
            0, 0, 0, 0 + m, 2 - m,
            0, 0, 1, 1 - m, 2 - m,
            0, 1, 1, 1 - m, 1 + m,
            0, 1, 0, 0 + m, 1 + m,
        );

        // Right
        addFaceDouble(
            1, 0, 0, 0 + m, 2 - m,
            1, 1, 0, 0 + m, 1 + m,
            1, 1, 1, 1 - m, 1 + m,
            1, 0, 1, 1 - m, 2 - m,
        );

        computeNormals(data, 11, 0, 3);

        Crawler._vertexCount = data.length / 11;

        // Upload into buffer
        gl.bindBuffer(gl.ARRAY_BUFFER, Crawler._bodyBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(data), gl.STATIC_DRAW);
    }

    rayCast(x, y, z, dx, dy, dz) {
        let closest = Infinity;
        const s = 0.3;
        for (const point of this._points) {
            const p = point.elements;
            const result = rayCastAABB(
                x, y, z,
                dx, dy, dz,
                p[0] - s, p[1] - s, p[2] - s,
                p[0] + s, p[1] + s, p[2] + s
            );
            closest = Math.min(result, closest);
        }

        return closest;
    }

    intersectSphere(x, y, z, radius) {
        radius += 0.3;
        radius *= radius;
        for (const point of this._points) {
            const p = point.elements;
            const dx = p[0] - x;
            const dy = p[1] - y;
            const dz = p[2] - z;
            if (dx * dx + dy * dy + dz * dz < radius)
                return true;
        }

        return false;
    }

    shot(byPlayer) {
        if (this.dead) return;

        if (byPlayer)
            score += director.difficulty.scoreMultiplier;

        this.dead = true;

        audio.playPositioned(audio.sounds["shatter_" + randomInt(0, 3)], 0.4, this._points[1], 5);

        if (this.loop) {
            this.loop.gain.gain.linearRampToValueAtTime(0, audio.time + 0.1);
            setTimeout(() => {
                this.loop.disconnect();
            }, 500);
        }

        // Spawn shards
        const p = getVec3();
        const v = getVec3();
        for (let i = 0; i < 10; i++) {
            p.set(this._points[Math.min(Math.floor(Math.random() * this._points.length), this._points.length - 1)]);
            for (let j = 0; j < 3; j++) {
                p.elements[j] += Math.random() * 0.5 - 0.25;
                v.elements[j] = Math.random() * 2 - 1;
            }
            v.normalize().mul(Math.random() * 5 + 1);

            effects.unshift(new ShatterShard(p, v));
        }
        freeVec3(p);
        freeVec3(v);
    }

    exploded(byPlayer) {
        this.shot(byPlayer);
    }

    shouldDespawn() {
        return this.dead;
    }

    update(dt) {
        // Move head
        const temp = getVec3();
        const nextPos = pathMap.getNextPos(
            Math.floor(this._points[0].elements[0]),
            Math.floor(this._points[0].elements[1]),
            Math.floor(this._points[0].elements[2]),
            toPlayer);

        if (nextPos) {
            for (let i = 0; i < 3; i++)
                this._checkpoint.elements[i] = nextPos[i] + 0.5;
            this._checkpoint = snapToClosest(this._checkpoint, 2, 0.5, -1) || this._checkpoint;
        }

        if (!this.loop && !this.dead) {
            this.loop = audio.playLoop(audio.sounds.skitter, 0, this._points[1], 1.5);
            this.loop.source.detune.value = Math.random() * 40 - 20
            this.loop.gain.gain.linearRampToValueAtTime(1, audio.time + 0.5);
        }
        if (this.loop) {
            this.loop.pan.positionX.linearRampToValueAtTime(this._points[1].elements[0], audio.time + 0.05);
            this.loop.pan.positionY.linearRampToValueAtTime(this._points[1].elements[1], audio.time + 0.05);
            this.loop.pan.positionZ.linearRampToValueAtTime(this._points[1].elements[2], audio.time + 0.05);
        }

        temp.set(this._checkpoint).sub(this._points[0]).normalize().mul(dt * this.speed * director.difficulty.enemySpeed * 0.8);
        if (isNaN(temp.elements[0])) {
            for (let i = 0; i < 3; i++)
                temp.elements[i] = 0;
        }
        this._points[0].add(temp);
        temp.set(this._points[0]).sub(this._points[1]).normalize().mul(dt * this.speed * 0.2);
        if (isNaN(temp.elements[0])) {
            for (let i = 0; i < 3; i++)
                temp.elements[i] = 0;
        }
        this._points[0].add(temp);

        // Move tail segments
        const targetDist = this.bodyLength / (this._points.length - 1);
        for (let i = 0; i < this._points.length; i++) {

            // Realign up direction
            const hoverPos = snapToClosest(this._points[i], 2, 0, -0.5);
            temp.set(this._points[i]).sub(hoverPos).normalize();
            if (isNaN(temp.elements[0])) {
                temp.elements[0] = 0;
                temp.elements[1] = 1;
                temp.elements[2] = 0;
            }
            temp.mul(1 - Math.pow(0.5, dt * 5));
            this._ups[i].add(temp).normalize();
            
            // Snap to ground
            hoverPos.sub(this._points[i]);
            if (hoverPos.magnitude() < 0.5 || i > 0) {
                const mag = hoverPos.magnitude();
                hoverPos.mul((mag - 0.5) * (1 - Math.pow(0.5, dt * 60)));
                this._points[i].add(hoverPos);
            }

            // Push away from nearby enemies
            const push = getVec3();
            for (const other of enemies) {
                if (other === this || !(other instanceof Crawler)) continue;

                for (const otherPoint of other._points) {
                    push.set(this._points[i])
                        .sub(otherPoint);
                    
                    let pushDist = Vector3.dot(push, push);
                    if (pushDist < 1) {
                        pushDist = Math.sqrt(pushDist);
                        push.mul(1 - pushDist)
                            .mul(1 - Math.pow(0.5, dt * 30));
                        this._points[i].add(push);
                    }
                }
            }
            freeVec3(push);

            if (i > 0) {
                // Pull towards previous chunk
                temp.set(this._points[i - 1]);
                temp.sub(this._points[i]);
                const dist = temp.magnitude();
                if (dist > targetDist) {
                    temp.normalize().mul(dist - targetDist);
                    this._points[i].add(temp);
                }
            }
        }
        freeVec3(temp);

        if (this.isTouchingPlayer())
            this.attack();
    }

    attack() {
        player.hit(this.damage * director.difficulty.damageMultiplier);
    }

    isTouchingPlayer() {
        const p = player.position.elements;
        const s = player.size;
        const e = this._points[0].elements;
        const m = 0.2;

        for (let i = 0; i < 3; i++) {
            if (Math.abs(e[i] - p[i]) > s[i] + m)
                return false;
        }

        return true;
    }

    render() {
        gl.useProgram(shaders.block.program);
        gl.uniform1i(shaders.block.u_Atlas, 2);
        gl.uniform1i(shaders.block.u_Glow, 3);
        gl.bindBuffer(gl.ARRAY_BUFFER, Crawler._bodyBuffer);
        gl.enableVertexAttribArray(shaders.block.a_Position);
        gl.enableVertexAttribArray(shaders.block.a_Normal);
        gl.enableVertexAttribArray(shaders.block.a_Uv);
        gl.enableVertexAttribArray(shaders.block.a_Color);
        gl.vertexAttribPointer(shaders.block.a_Position, 3, gl.FLOAT, false, 4 * 11, 0);
        gl.vertexAttribPointer(shaders.block.a_Normal, 3, gl.FLOAT, true, 4 * 11, 4 * 3);
        gl.vertexAttribPointer(shaders.block.a_Uv, 2, gl.FLOAT, false, 4 * 11, 4 * 6);
        gl.vertexAttribPointer(shaders.block.a_Color, 3, gl.FLOAT, false, 4 * 11, 4 * 8);

        const temp = getMat4();
        const look = getMat4();
        const fwd = getVec3();

        for (let i = 0; i < this._points.length; i++) {
            const prev = this._points[Math.min(i + 1, this._points.length - 1)];
            const next = this._points[Math.max(i - 1, 0)];

            const up = this._ups[i];

            fwd.set(next).sub(prev).normalize();
            look.setLookAt(
                0, 0, 0,
                fwd.elements[0], fwd.elements[1], fwd.elements[2],
                up.elements[0], up.elements[1], up.elements[2]);
            look.transpose();

            temp.setTranslate(this._points[i].elements[0], this._points[i].elements[1], this._points[i].elements[2])
                .multiply(look)
                .scale(0.4, 0.4, 0.4);
            
            gl.uniformMatrix4fv(shaders.block.u_ModelMatrix, false, temp.elements);
            gl.drawArrays(gl.TRIANGLES, 0, Crawler._vertexCount);
        }

        freeMat4(temp);
        freeMat4(look);
        freeVec3(fwd);
    }
}

class ShatterShard extends Effect {
    static _buffer = null;
    static _vertexCount = 0;

    constructor(position, velocity) {
        super();
        this.position = new Vector3(position.elements);
        this.velocity = new Vector3(velocity.elements);
        this.rotationAxis = new Vector3();
        for (let i = 0; i < 3; i++)
            this.rotationAxis.elements[i] = Math.random() * 2 - 1;
        this.rotationAxis.normalize();

        this.rotationSpeed = Math.random() * 360 * 2;
        this.rotation = Math.random() * 360;
        this.lifetime = Math.random() * 0.75 + 0.25;
        if (Math.random() < 0.3)
            this.lifetime += 1.5;
        this.age = 0;
        this._matrix = new Matrix4();

        const rotation = getMat4();
        rotation.setRotate(Math.random() * Math.PI * 2, Math.random() * 2 - 1, Math.random() * 2 - 1, Math.random() * 2 - 1);

        this._matrix.set(rotation)
            .scale(0.15 + Math.random() * 0.15, 0.15, 0.15)
            .multiply(rotation.transpose());

        freeMat4(rotation);

        if (ShatterShard._buffer === null)
            ShatterShard._buildMesh();
    }

    update(dt) {
        this.rotation += this.rotationSpeed * dt;
        this.age += dt;

        this.velocity.mul(Math.pow(0.5, dt));
        this.velocity.elements[1] -= dt * gravity;

        const s = 0.1;
        const delta = getVec3();
        delta.set(this.velocity).mul(dt);

        const p = this.position.elements;
        const v = this.velocity.elements;
        const d = delta.elements;

        const hit = moveAndCollide(
            p[0], p[1], p[2],
            s, s, s,
            d[0], d[1], d[2]
        );
        if (hit) {
            this.position.elements[0] = hit.x;
            this.position.elements[1] = hit.y;
            this.position.elements[2] = hit.z;
            if (hit.normalX) v[0] = Math.abs(v[0]) * hit.normalX * 0.8;
            if (hit.normalY) v[1] = Math.abs(v[1]) * hit.normalY * 0.8;
            if (hit.normalZ) v[2] = Math.abs(v[2]) * hit.normalZ * 0.8;
        }

        freeVec3(delta);
    }

    render() {
        gl.useProgram(shaders.block.program);
        gl.uniform1i(shaders.block.u_Atlas, 2);
        gl.uniform1i(shaders.block.u_Glow, 3);
        gl.bindBuffer(gl.ARRAY_BUFFER, ShatterShard._buffer);
        gl.enableVertexAttribArray(shaders.block.a_Position);
        gl.enableVertexAttribArray(shaders.block.a_Normal);
        gl.enableVertexAttribArray(shaders.block.a_Uv);
        gl.enableVertexAttribArray(shaders.block.a_Color);
        gl.vertexAttribPointer(shaders.block.a_Position, 3, gl.FLOAT, false, 4 * 11, 0);
        gl.vertexAttribPointer(shaders.block.a_Normal, 3, gl.FLOAT, true, 4 * 11, 4 * 3);
        gl.vertexAttribPointer(shaders.block.a_Uv, 2, gl.FLOAT, false, 4 * 11, 4 * 6);
        gl.vertexAttribPointer(shaders.block.a_Color, 3, gl.FLOAT, false, 4 * 11, 4 * 8);

        const temp = getMat4();

        const scale = Math.sqrt(Math.max(1 - this.age / this.lifetime, 0));
        temp.setTranslate(this.position.elements[0], this.position.elements[1], this.position.elements[2])
            .scale(scale, scale, scale)
            .rotate(this.rotation, this.rotationAxis.elements[0], this.rotationAxis.elements[1], this.rotationAxis.elements[2])
            .multiply(this._matrix);

        gl.uniformMatrix4fv(shaders.block.u_ModelMatrix, false, temp.elements);
        gl.drawArrays(gl.TRIANGLES, 0, ShatterShard._vertexCount);

        freeMat4(temp);
    }

    shouldDespawn() {
        return this.age > this.lifetime;
    }

    static _buildMesh() {
        const data = [];
        const atlasWidth = 8;
        const atlasHeight = 8;
        const m = 0.5 / 128;
        let dataInd = 0;

        function add(x, y, z, u, v) {
            data[dataInd++] = x * 2 - 1;
            data[dataInd++] = y * 2 - 1;
            data[dataInd++] = z * 2 - 1;
            dataInd += 3;
            data[dataInd++] = u / atlasWidth;
            data[dataInd++] = v / atlasHeight;
            data[dataInd++] = 1;
            data[dataInd++] = 1;
            data[dataInd++] = 1;
        }

        function addFace(x1, y1, z1, u1, v1, x2, y2, z2, u2, v2, x3, y3, z3, u3, v3, x4, y4, z4, u4, v4) {
            add(x1, y1, z1, u1, v1);
            add(x2, y2, z2, u2, v2);
            add(x3, y3, z3, u3, v3);
            add(x1, y1, z1, u1, v1);
            add(x3, y3, z3, u3, v3);
            add(x4, y4, z4, u4, v4);
        }

        function addFaceDouble(x1, y1, z1, u1, v1, x2, y2, z2, u2, v2, x3, y3, z3, u3, v3, x4, y4, z4, u4, v4) {
            addFace(x1, y1, z1, u1, v1, x2, y2, z2, u2, v2, x3, y3, z3, u3, v3, x4, y4, z4, u4, v4);
            addFace(x1, y1, z1, u1, v1, x4, y4, z4, u4, v4, x3, y3, z3, u3, v3, x2, y2, z2, u2, v2);
        }

        // Bottom
        addFace(
            0, 0, 0, 0 + m, 0 + m,
            1, 0, 0, 0 + m, 1 - m,
            1, 0, 1, 1 - m, 1 - m,
            0, 0, 1, 1 - m, 0 + m,
        );

        // Top
        addFace(
            0, 1, 0, 0 + m, 0 + m,
            0, 1, 1, 1 - m, 0 + m,
            1, 1, 1, 1 - m, 1 - m,
            1, 1, 0, 0 + m, 1 - m,
        );

        // Front
        addFaceDouble(
            0, 0, 0, 0 + m, 1 - m,
            0, 1, 0, 0 + m, 0 + m,
            1, 1, 0, 1 - m, 0 + m,
            1, 0, 0, 1 - m, 1 - m,
        );

        // Back
        addFaceDouble(
            0, 0, 1, 0 + m, 1 - m,
            1, 0, 1, 1 - m, 1 - m,
            1, 1, 1, 1 - m, 0 + m,
            0, 1, 1, 0 + m, 0 + m,
        );

        // Left
        addFaceDouble(
            0, 0, 0, 0 + m, 1 - m,
            0, 0, 1, 1 - m, 1 - m,
            0, 1, 1, 1 - m, 0 + m,
            0, 1, 0, 0 + m, 0 + m,
        );

        // Right
        addFaceDouble(
            1, 0, 0, 0 + m, 1 - m,
            1, 1, 0, 0 + m, 0 + m,
            1, 1, 1, 1 - m, 0 + m,
            1, 0, 1, 1 - m, 1 - m,
        );

        computeNormals(data, 11, 0, 3);

        ShatterShard._vertexCount = data.length / 11;

        // Upload into buffer
        ShatterShard._buffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, ShatterShard._buffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(data), gl.STATIC_DRAW);
    }
}

class Explosion extends Effect {
    static _buffer = null;
    static _vertexCount = 0;

    constructor(position, maxRadius, r, g, b, playerDamage) {
        super();
        this.position = new Vector3(position.elements);
        this.r = r;
        this.g = g;
        this.b = b;
        this.playerDamage = playerDamage;
        this.byPlayer = playerDamage === 0;

        this.lifetime = 0.8;
        this.age = 0;
        this.radius = 0;
        this.maxRadius = maxRadius;

        if (Explosion._buffer === null)
            Explosion._buildMesh();
    }

    update(dt) {
        this.age += dt;
        const t = this.age / this.lifetime;
        this.radius = Math.sqrt(1 - (t - 1) * (t - 1)) * this.maxRadius;
        
        const p = this.position.elements;
        if (this.age < 0.5) {
            for (const enemy of enemies) {
                if (enemy.intersectSphere(p[0], p[1], p[2], this.radius)) {
                    enemy.exploded(this.byPlayer);
                }
            }
        }

        if (this.age < 0.5 && this.playerDamage > 0) {
            const dx = p[0] - player.position.elements[0];
            const dy = p[1] - player.position.elements[1];
            const dz = p[2] - player.position.elements[2];

            const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
            if (dist < this.radius + 0.25) {
                player.hit(this.playerDamage, true);
                this.playerDamage = 0;
            }
        }
    }

    render() {
        gl.useProgram(shaders.solid.program);
        gl.bindBuffer(gl.ARRAY_BUFFER, Explosion._buffer);
        gl.enableVertexAttribArray(shaders.solid.a_Position);
        gl.vertexAttribPointer(shaders.solid.a_Position, 3, gl.FLOAT, false, 0, 0);

        const temp = getMat4();
        temp.setTranslate(this.position.elements[0], this.position.elements[1], this.position.elements[2])
            .scale(this.radius, this.radius, this.radius);

        gl.enable(gl.BLEND);
        gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
        gl.depthMask(false);
        gl.disable(gl.CULL_FACE);

        gl.uniform4f(shaders.solid.u_Color, this.r, this.g, this.b, 1 - this.age / this.lifetime);
        gl.uniformMatrix4fv(shaders.solid.u_ModelMatrix, false, temp.elements);
        gl.drawArrays(gl.TRIANGLES, 0, Explosion._vertexCount);

        gl.disable(gl.BLEND);
        gl.depthMask(true);
        gl.enable(gl.CULL_FACE);

        freeMat4(temp);
    }

    shouldDespawn() {
        return this.age > this.lifetime;
    }

    static _buildMesh() {
        const data = [];
        let dataInd = 0;

        function add(x, y, z) {
            data[dataInd++] = x;
            data[dataInd++] = y;
            data[dataInd++] = z;
        }

        function addFace(x1, y1, z1, x2, y2, z2, x3, y3, z3, x4, y4, z4) {
            add(x1, y1, z1);
            add(x2, y2, z2);
            add(x3, y3, z3);
            add(x1, y1, z1);
            add(x3, y3, z3);
            add(x4, y4, z4);
        }

        const pitchDivs = 8;
        const yawDivs = 16;
        for (let p = 0; p < pitchDivs; p++) {
            for (let y = 0; y < yawDivs; y++) {
                const fromPitch = p / pitchDivs * Math.PI - Math.PI / 2;
                const toPitch = (p + 1) / pitchDivs * Math.PI - Math.PI / 2;
                const fromYaw = y / yawDivs * Math.PI * 2;
                const toYaw = (y + 1) / yawDivs * Math.PI * 2;

                const p1c = Math.cos(fromPitch);
                const p1s = Math.sin(fromPitch);
                const p2c = Math.cos(toPitch);
                const p2s = Math.sin(toPitch);
                const y1c = Math.cos(fromYaw);
                const y1s = Math.sin(fromYaw);
                const y2c = Math.cos(toYaw);
                const y2s = Math.sin(toYaw);
                addFace(
                    y1c * p1c, p1s, y1s * p1c,
                    y1c * p2c, p2s, y1s * p2c,
                    y2c * p2c, p2s, y2s * p2c,
                    y2c * p1c, p1s, y2s * p1c,
                );
            }
        }

        Explosion._vertexCount = data.length / 3;

        // Upload into buffer
        Explosion._buffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, Explosion._buffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(data), gl.STATIC_DRAW);
    }
}

class Director extends Enemy {
    static _dirs = [[1,0], [-1,0], [0,1], [0,-1]];

    constructor(xMin, yMin, zMin, xMax, yMax, zMax) {
        super();

        this.difficulty = this.getDifficulty(0);

        this._flash = 0;
        this.position = new Vector3([0.5, 8, 0.5]);
        this._spawnPoints = [];

        this._bounds = [xMin, yMin, zMin, xMax, yMax, zMax];
        this._spawnDelay = 1;
        this._numCrawlersBeforeNextFlier = 20;

        this._anim = 0;
        this._matrix = new Matrix4();
        this._buffer = null;
        this._vertexCount = 0;
        this._buildMesh();

        this._findSpawnPoints();
        this.reset();
    }

    render() {
        gl.useProgram(shaders.block.program);
        gl.uniform1i(shaders.block.u_Atlas, 2);
        gl.uniform1i(shaders.block.u_Glow, 3);
        gl.bindBuffer(gl.ARRAY_BUFFER, this._buffer);
        gl.enableVertexAttribArray(shaders.block.a_Position);
        gl.enableVertexAttribArray(shaders.block.a_Normal);
        gl.enableVertexAttribArray(shaders.block.a_Uv);
        gl.enableVertexAttribArray(shaders.block.a_Color);
        gl.vertexAttribPointer(shaders.block.a_Position, 3, gl.FLOAT, false, 4 * 11, 0);
        gl.vertexAttribPointer(shaders.block.a_Normal, 3, gl.FLOAT, true, 4 * 11, 4 * 3);
        gl.vertexAttribPointer(shaders.block.a_Uv, 2, gl.FLOAT, false, 4 * 11, 4 * 6);
        gl.vertexAttribPointer(shaders.block.a_Color, 3, gl.FLOAT, false, 4 * 11, 4 * 8);

        if (this.difficulty.level === 0)
            gl.uniform4f(shaders.block.u_Overlay, 0.1, 0.1, 0.3, 0.7);
        else
            gl.uniform4f(shaders.block.u_Overlay, 1, 1, 1, Math.pow(this._flash, 4));
        
        gl.uniformMatrix4fv(shaders.block.u_ModelMatrix, false, this._matrix.elements);
        gl.drawArrays(gl.TRIANGLES, 0, this._vertexCount);
        
        gl.uniform4f(shaders.block.u_Overlay, 0, 0, 0, 0);
    }

    update(dt) {
        this._anim += dt * Math.max(this.difficulty.level, 0.2);
        this._flash = Math.max(this._flash - dt * 0.5, 0);

        if (score > this.difficulty.maxScore)
            this.difficulty = this.getDifficulty(this.difficulty.level + 1);

        this._matrix.setTranslate(this.position.elements[0], this.position.elements[1], this.position.elements[2])
            .rotate(this._anim * 90, 1, 1, 1)
            .rotate(this._anim * 22, 1, 0, 0);

        this._spawnDelay -= dt * this.difficulty.spawnRate;
        if (this._spawnDelay <= 0) {
            this._spawnDelay += 1;

            const spawnPoint = chooseRandom(this._spawnPoints);

            if (this._numCrawlersBeforeNextFlier > 0) {
                enemies.push(new Crawler(spawnPoint));
                this._numCrawlersBeforeNextFlier--;
            } else {
                enemies.push(new Flier(spawnPoint));
                this._numCrawlersBeforeNextFlier = Math.floor(Math.random() * 10) + 5;
            }
        }
    }

    rayCast(x, y, z, dx, dy, dz) {
        const invMat = getMat4()
            .setInverseOf(this._matrix);

        // Get local position
        let tempVec = getVec4();
        tempVec.elements[0] = x;
        tempVec.elements[1] = y;
        tempVec.elements[2] = z;
        tempVec.elements[3] = 1;
        tempVec = invMat.multiplyVector4(tempVec);
        x = tempVec.elements[0];
        y = tempVec.elements[1];
        z = tempVec.elements[2];
        
        // Get local direction
        tempVec.elements[0] = dx;
        tempVec.elements[1] = dy;
        tempVec.elements[2] = dz;
        tempVec.elements[3] = 0;
        tempVec = invMat.multiplyVector4(tempVec);
        dx = tempVec.elements[0];
        dy = tempVec.elements[1];
        dz = tempVec.elements[2];

        freeVec4(tempVec);
        freeMat4(invMat);

        // Cast
        return rayCastAABB(x, y, z, dx, dy, dz, -1, -1, -1, 1, 1, 1);
    }

    shot() {
        if (this.difficulty.level === 0)
            score = 0;

        this._flash = 1;
        this.difficulty = this.getDifficulty(this.difficulty.level + 1);
        applyScreenShake(0.75);
    }

    getDifficulty(newLevel) {
        const diff = {
            level: newLevel,
            spawnRate: 1,
            enemySpeed: 1,
            damageMultiplier: 1,
            scoreMultiplier: newLevel,
            maxScore: 50 * (Math.pow(2, newLevel) - 1)
        };
        switch (newLevel) {
            case 0:
                diff.spawnRate = 0;
                diff.maxScore = Infinity;
                break;
            case 1:
                diff.spawnRate = 0.4;
                break;
            case 2:
                diff.spawnRate = 0.6;
                diff.enemySpeed = 1.1;
                break;
            default:
                diff.spawnRate = Math.min(0.2 + 0.2 * newLevel, 1.25);
                diff.enemySpeed = 1.1 + (newLevel - 2) * 0.1;
                diff.damageMultiplier = 1 + 0.25 * (newLevel - 2);
                break;
        }

        return diff;
    }

    reset() {
        this.difficulty = this.getDifficulty(0);
        this._numCrawlersBeforeNextFlier = 20;
    }

    _buildMesh() {
        const data = [];
        const atlasWidth = 2;
        const atlasHeight = 2;
        const m = 0.5 / 128;
        let dataInd = 0;

        function add(x, y, z, u, v) {
            data[dataInd++] = x * 2 - 1;
            data[dataInd++] = y * 2 - 1;
            data[dataInd++] = z * 2 - 1;
            dataInd += 3;
            data[dataInd++] = u / atlasWidth;
            data[dataInd++] = v / atlasHeight;
            data[dataInd++] = 1;
            data[dataInd++] = 1;
            data[dataInd++] = 1;
        }

        function addFace(x1, y1, z1, u1, v1, x2, y2, z2, u2, v2, x3, y3, z3, u3, v3, x4, y4, z4, u4, v4) {
            add(x1, y1, z1, u1, v1);
            add(x2, y2, z2, u2, v2);
            add(x3, y3, z3, u3, v3);
            add(x1, y1, z1, u1, v1);
            add(x3, y3, z3, u3, v3);
            add(x4, y4, z4, u4, v4);
        }

        // Bottom
        addFace(
            0, 0, 0, 1 + m, 0 + m,
            1, 0, 0, 1 + m, 1 - m,
            1, 0, 1, 2 - m, 1 - m,
            0, 0, 1, 2 - m, 0 + m,
        );

        // Top
        addFace(
            0, 1, 0, 1 + m, 0 + m,
            0, 1, 1, 2 - m, 0 + m,
            1, 1, 1, 2 - m, 1 - m,
            1, 1, 0, 1 + m, 1 - m,
        );

        // Front
        addFace(
            0, 0, 0, 1 + m, 1 - m,
            0, 1, 0, 1 + m, 0 + m,
            1, 1, 0, 2 - m, 0 + m,
            1, 0, 0, 2 - m, 1 - m,
        );

        // Back
        addFace(
            0, 0, 1, 1 + m, 1 - m,
            1, 0, 1, 2 - m, 1 - m,
            1, 1, 1, 2 - m, 0 + m,
            0, 1, 1, 1 + m, 0 + m,
        );

        // Left
        addFace(
            0, 0, 0, 1 + m, 1 - m,
            0, 0, 1, 2 - m, 1 - m,
            0, 1, 1, 2 - m, 0 + m,
            0, 1, 0, 1 + m, 0 + m,
        );

        // Right
        addFace(
            1, 0, 0, 1 + m, 1 - m,
            1, 1, 0, 1 + m, 0 + m,
            1, 1, 1, 2 - m, 0 + m,
            1, 0, 1, 2 - m, 1 - m,
        );

        computeNormals(data, 11, 0, 3);

        this._vertexCount = data.length / 11;

        // Upload into buffer
        this._buffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, this._buffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(data), gl.STATIC_DRAW);
    }

    _findSpawnPoints() {
        this._spawnPoints = [];

        const y = -1;
        const xMin = this._bounds[0];
        const xMax = this._bounds[3];
        const zMin = this._bounds[2];
        const zMax = this._bounds[5];
        for (let x = xMin; x < xMax; x++) {
            for (let z = zMin; z < zMax; z++) {
                if (this._isValidSpawnPoint(x, y, z, true))
                    this._spawnPoints.push(new Vector3([x + 0.5, y + 0.5, z + 0.5]));
            }
        }

        if (this._spawnPoints.length === 0) {
            for (let x = xMin; x < xMax; x++) {
                for (let z = zMin; z < zMax; z++) {
                    if (this._isValidSpawnPoint(x, y, z, false))
                        this._spawnPoints.push(new Vector3([x + 0.5, y + 0.5, z + 0.5]));
                }
            }
        }

        if (this._spawnPoints.length === 0) {
            this._spawnPoints.push(new Vector3([0.5, -0.5, 0.5]));
        }
    }

    _isValidSpawnPoint(x, y, z, needsFloor) {
        // Make sure the tile is accessible
        if (!pathMap.isMapped(x, y, z) || !Pathfinder.obstructed(x, y - 1, z) && needsFloor)
            return false;

        // Make sure there is a wall next to it to climb on
        for (const [dx, dz] of Director._dirs) {
            if (Pathfinder.obstructed(x + dx, y, z + dz))
                return true;
        }

        return false;
    }
}

class Flier extends Enemy {
    static _laserRings = 32;
    static _laserDivs = 4;
    static _laserVertexBuffer = null;
    static _laserVertexData = null;
    static _laserElementBuffer = null;
    static _laserElements = 0;

    constructor(pos) {
        super();
        this.position = new Vector3(pos.elements);
        this.velocity = new Vector3();
        this._matrix = new Matrix4();
        this._bodyBuffer = null;
        this._bodyVertices = 0;
        
        this.speed = 8;
        this.damage = 0.8;
        this.explosionRadius = 6;
        this.maxLaserCooldown = 6;
        this.laserChargeTime = 3;
        this.width = 1;
        this.height = 2;
        
        this.dead = false;
        this.spin = 0;
        this.laserCharge = 0;
        this.laserCooldown = 3;
        this.laserTarget = null;
        this.moveTarget = new Vector3(pos.elements);
        this.moveTarget.elements[1]
        this.moveTargetDuration = 2;
        this.spawnAnim = 2;

        if (!this._bodyBuffer) {
            this._buildMesh();
        }
        if (!Flier._laserVertexBuffer) {
            Flier._buildLaserMesh();
        }
    }
    
    _buildMesh() {
        const data = [];
        const atlasWidth = 2;
        const atlasHeight = 2;
        const m = 0.5 / 128;
        let dataInd = 0;

        function add(x, y, z, u, v) {
            data[dataInd++] = x * 2 - 1;
            data[dataInd++] = y * 2 - 1;
            data[dataInd++] = z * 2 - 1;
            dataInd += 3;
            data[dataInd++] = u / atlasWidth;
            data[dataInd++] = v / atlasHeight;
            data[dataInd++] = 1;
            data[dataInd++] = 1;
            data[dataInd++] = 1;
        }

        function addFace(x1, y1, z1, u1, v1, x2, y2, z2, u2, v2, x3, y3, z3, u3, v3, x4, y4, z4, u4, v4) {
            add(x1, y1, z1, u1, v1);
            add(x2, y2, z2, u2, v2);
            add(x3, y3, z3, u3, v3);
            add(x1, y1, z1, u1, v1);
            add(x3, y3, z3, u3, v3);
            add(x4, y4, z4, u4, v4);
        }

        // Bottom
        addFace(
            0, 0, 0, 0 + m, 1 + m,
            1, 0, 0, 0 + m, 2 - m,
            1, 0, 1, 1 - m, 2 - m,
            0, 0, 1, 1 - m, 1 + m,
        );

        // Top
        addFace(
            0, 1, 0, 0 + m, 1 + m,
            0, 1, 1, 1 - m, 1 + m,
            1, 1, 1, 1 - m, 2 - m,
            1, 1, 0, 0 + m, 2 - m,
        );

        // Front
        addFace(
            0, 0, 0, 0 + m, 2 - m,
            0, 1, 0, 0 + m, 1 + m,
            1, 1, 0, 1 - m, 1 + m,
            1, 0, 0, 1 - m, 2 - m,
        );

        // Back
        addFace(
            0, 0, 1, 0 + m, 2 - m,
            1, 0, 1, 1 - m, 2 - m,
            1, 1, 1, 1 - m, 1 + m,
            0, 1, 1, 0 + m, 1 + m,
        );

        // Left
        addFace(
            0, 0, 0, 0 + m, 2 - m,
            0, 0, 1, 1 - m, 2 - m,
            0, 1, 1, 1 - m, 1 + m,
            0, 1, 0, 0 + m, 1 + m,
        );

        // Right
        addFace(
            1, 0, 0, 0 + m, 2 - m,
            1, 1, 0, 0 + m, 1 + m,
            1, 1, 1, 1 - m, 1 + m,
            1, 0, 1, 1 - m, 2 - m,
        );

        this._bodyVertices = data.length / 11;

        
        // Transform vertices
        let temp = getVec4();
        const look = getMat4();

        look.setLookAt(
            0, 0, 0,
            Math.sqrt(3), Math.sqrt(3), Math.sqrt(3),
            0, 1, 0
        );
        
        this._matrix.setRotate(90, 1, 0, 0)
            .scale(this.width / 2, this.width / 2, this.height / 2)
            .multiply(look.transpose());

        for (let i = 0; i < this._bodyVertices; i++) {
            const o = i * 11;
            temp.elements[0] = data[o + 0];
            temp.elements[1] = data[o + 1];
            temp.elements[2] = data[o + 2];
            temp.elements[3] = 1;

            temp = this._matrix.multiplyVector4(temp);

            data[o + 0] = temp.elements[0];
            data[o + 1] = temp.elements[1];
            data[o + 2] = temp.elements[2];
        }

        freeVec4(temp);
        freeMat4(look);

        computeNormals(data, 11, 0, 3);

        // Upload into buffer
        this._bodyBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, this._bodyBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(data), gl.STATIC_DRAW);
    }

    static _buildLaserMesh() {
        Flier._laserVertexBuffer = gl.createBuffer();
        Flier._laserVertexData = new Float32Array(Flier._laserRings * Flier._laserDivs * 3);
        gl.bindBuffer(gl.ARRAY_BUFFER, Flier._laserVertexBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, Flier._laserVertexData.byteLength, gl.DYNAMIC_DRAW);

        const elementData = makeCylinderElements(Flier._laserRings, Flier._laserDivs);
        Flier._laserElementBuffer = gl.createBuffer();
        Flier._laserElements = elementData.length;
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, Flier._laserElementBuffer);
        gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, elementData, gl.STATIC_DRAW);
    }

    rayCast(x, y, z, dx, dy, dz) {
        const p = this.position.elements;
        return rayCastAABB(
            x, y, z,
            dx, dy, dz,
            p[0] - this.width / 2, p[1] - this.height / 2, p[2] - this.width / 2,
            p[0] + this.width / 2, p[1] + this.height / 2, p[2] + this.width / 2
        );
    }

    intersectSphere(x, y, z, radius) {
        radius += 0.3;
        radius *= radius;
        const p = this.position.elements;
        const dx = p[0] - x;
        const dy = p[1] - y;
        const dz = p[2] - z;
        return dx * dx + dy * dy + dz * dz < radius;
    }

    shot(byPlayer) {
        if (this.dead) return;

        if (byPlayer)
            score += 2 * director.difficulty.scoreMultiplier;

        this.dead = true;

        audio.playPositioned(audio.sounds["shatter_" + randomInt(0, 3)], 0.4, this.position, 7);
        audio.playPositioned(audio.sounds["flier_cry_" + randomInt(0, 4)], 0.15, this.position, 20);

        if (this.loop) {
            this.loop.gain.gain.linearRampToValueAtTime(0, audio.time + 1);
            setTimeout(() => {
                this.loop.disconnect();
            }, 1500);
        }

        // Spawn shards
        const p = getVec3();
        const v = getVec3();
        for (let i = 0; i < 30; i++) {
            p.set(this.position);
            for (let j = 0; j < 3; j++) {
                p.elements[j] += (Math.random() - 0.5) * (j === 1 ? this.height : this.width);
                v.elements[j] = Math.random() * 2 - 1;
            }
            v.normalize().mul(Math.random() * 10 + 2);

            const shard = new ShatterShard(p, v);
            shard.lifetime += 1;
            effects.unshift(shard);
        }
        freeVec3(p);
        freeVec3(v);
    }

    exploded(byPlayer) {
        this.shot(byPlayer);
    }

    shouldDespawn() {
        return this.dead;
    }

    update(dt) {
        const temp = getVec3();
        temp.set(this.velocity).mul(dt);

        if (!this.loop && !this.dead) {
            this.loop = audio.playLoop(audio.sounds.flier_hum, 1, this.position, 4);
        }
        if (this.loop) {
            this.loop.pan.positionX.linearRampToValueAtTime(this.position.elements[0], audio.time + 0.05);
            this.loop.pan.positionY.linearRampToValueAtTime(this.position.elements[1], audio.time + 0.05);
            this.loop.pan.positionZ.linearRampToValueAtTime(this.position.elements[2], audio.time + 0.05);
            this.loop.source.detune.linearRampToValueAtTime(this.velocity.magnitude() * 100, audio.time + 0.05);
        }

        this.spin += dt * 100 * (1 - 5 * this.laserCharge);

        if (this.spawnAnim > 0) {
            this.velocity.elements[1] = 5;
            this.spawnAnim = Math.max(0, this.spawnAnim - dt);
            this.position.add(temp);
        } else {
            // Collide with terrain
            const hit = moveAndCollide(
                this.position.elements[0], this.position.elements[1], this.position.elements[2],
                this.width, this.height, this.width,
                temp.elements[0], temp.elements[1], temp.elements[2]
            );
            this.position.elements[0] = hit.x;
            this.position.elements[1] = hit.y;
            this.position.elements[2] = hit.z;

            if (hit.normalX !== 0) this.velocity.elements[0] = 0;
            if (hit.normalY !== 0) this.velocity.elements[1] = 0;
            if (hit.normalZ !== 0) this.velocity.elements[2] = 0;
        }

        // Move towards destination
        temp.set(this.moveTarget)
            .sub(this.position);

        const targetDist = temp.magnitude();
        if (targetDist > 5) {
            temp.mul(5 / targetDist);
        }
        this.velocity.addMultiple(temp, dt * this.speed * director.difficulty.enemySpeed);
        this.velocity.mul(Math.pow(0.5, dt * 10));

        // Choose a new destination periodically
        this.moveTargetDuration = Math.max(this.moveTargetDuration - dt, 0);
        if (this.moveTargetDuration === 0) {
            this.moveTarget.elements[0] = Math.random() * 2 - 1;
            this.moveTarget.elements[1] = Math.random();
            this.moveTarget.elements[2] = Math.random() * 2 - 1;
            this.moveTarget.normalize()
                .mul(Math.random() * 20 + 10)
                .add(player.position);

            this.moveTargetDuration = Math.random() * 5 + 2;
        }

        // Shoot
        if (this.laserCooldown > 0) {
            this.laserCooldown = Math.max(this.laserCooldown - dt, 0);
        } else {
            // Set new target
            if (this.laserTarget === null) {

                // Predict player position
                const dir = getVec3();
                this.laserTarget = new Vector3(player.position.elements)
                    .addMultiple(player.velocity, this.laserChargeTime * Math.random())
                    .sub(this.position);
                this.laserTarget.elements[1] -= player.size[1] / 2;
                dir.set(this.laserTarget).normalize();

                const hit = castAllChunks(this.position, this.laserTarget);
                if (hit) {
                    this.laserTarget.elements[0] = hit.hitX;
                    this.laserTarget.elements[1] = hit.hitY;
                    this.laserTarget.elements[2] = hit.hitZ;
                } else {
                    this.laserTarget.set(this.position);
                }

                // Bring up to water surface
                if (this.laserTarget.elements[1] < -0.5 || !hit) {
                    const pushBack = (-0.5 - this.laserTarget.elements[1]) / dir.elements[1];
                    this.laserTarget.addMultiple(dir, pushBack);
                }

                freeVec3(dir);
            }

            const lastLaserCharge = this.laserCharge;
            this.laserCharge = Math.min(this.laserCharge + dt / this.laserChargeTime, 1);

            // Play sound right before shooting
            if (lastLaserCharge < 0.9 && this.laserCharge >= 0.9)
                audio.playPositioned(audio.sounds["flier_shoot_" + randomInt(0, 3)], 0.5, this.position, 7);

            if (this.laserCharge === 1)
                this.shoot();
        }

        freeVec3(temp);
    }

    shoot() {
        this.laserCharge = 0;
        this.laserCooldown = this.maxLaserCooldown * (0.75 + Math.random() * 0.25);

        const sound = audio.playPositioned(audio.sounds["boom_" + randomInt(0, 3)], 0.4, this.position, 10);
        sound.source.detune.value = -1200 + Math.random() * 500;

        effects.push(new Explosion(this.laserTarget, this.explosionRadius, 1, 0.5, 0.8, this.damage));

        this.laserTarget = null;
    }

    render() {
        gl.useProgram(shaders.block.program);
        gl.uniform1i(shaders.block.u_Atlas, 2);
        gl.uniform1i(shaders.block.u_Glow, 3);
        gl.bindBuffer(gl.ARRAY_BUFFER, this._bodyBuffer);
        gl.enableVertexAttribArray(shaders.block.a_Position);
        gl.enableVertexAttribArray(shaders.block.a_Normal);
        gl.enableVertexAttribArray(shaders.block.a_Uv);
        gl.enableVertexAttribArray(shaders.block.a_Color);
        gl.vertexAttribPointer(shaders.block.a_Position, 3, gl.FLOAT, false, 4 * 11, 0);
        gl.vertexAttribPointer(shaders.block.a_Normal, 3, gl.FLOAT, true, 4 * 11, 4 * 3);
        gl.vertexAttribPointer(shaders.block.a_Uv, 2, gl.FLOAT, false, 4 * 11, 4 * 6);
        gl.vertexAttribPointer(shaders.block.a_Color, 3, gl.FLOAT, false, 4 * 11, 4 * 8);

        // Draw body
        this._matrix.setTranslate(this.position.elements[0], this.position.elements[1], this.position.elements[2])
            .rotate(this.spin, 0, 1, 0);

        gl.uniformMatrix4fv(shaders.block.u_ModelMatrix, false, this._matrix.elements);
        gl.drawArrays(gl.TRIANGLES, 0, this._bodyVertices);

        if (this.laserTarget) {
            this._renderLaser();
        }
    }

    _renderLaser() {
        const to = getVec3();
        const from = getVec3();
        const dir = getVec3();
        const p = getVec3();
        const up = getVec3();
        const right = getVec3();
        
        to.set(this.laserTarget);
        from.set(this.position);
        dir.set(to).sub(from).normalize();
        from.addMultiple(dir, 2);

        up.mul(0).elements[1] = 1;
        right.set(dir).cross(up).normalize();
        up.set(right).cross(dir).normalize();
        
        // Update laser model
        let dataInd = 0;
        for (let i = 0; i < Flier._laserRings; i++) {
            const t = i / (Flier._laserRings - 1);
            let radius = Math.sqrt(t * (1 - t) * 4) * 0.1 * Math.pow(this.laserCharge, 0.5) * (1 - Math.pow(this.laserCharge, 4));

            const pulseT = (this.laserCharge - 0.9) / (1 - 0.9);
            const pulse = 0.5 + 0.5 * Math.cos(Math.max(-1, Math.min((t - pulseT) * 10, 1)) * Math.PI);
            radius += pulse * 0.2;

            for (let j = 0; j < Flier._laserDivs; j++) {
                const radians = j / Flier._laserDivs * Math.PI;
                p.set(from).mul(1 - t)
                    .addMultiple(to, t)
                    .addMultiple(up, Math.cos(radians) * radius)
                    .addMultiple(right, Math.sin(radians) * radius);
                Flier._laserVertexData[dataInd++] = p.elements[0];
                Flier._laserVertexData[dataInd++] = p.elements[1];
                Flier._laserVertexData[dataInd++] = p.elements[2];
            }
        }

        freeVec3(to);
        freeVec3(from);
        freeVec3(dir);
        freeVec3(p);
        freeVec3(right);

        // Draw
        const modelMatrix = getMat4();

        gl.useProgram(shaders.solid.program);
        gl.bindBuffer(gl.ARRAY_BUFFER, Flier._laserVertexBuffer);
        gl.bufferSubData(gl.ARRAY_BUFFER, 0, Flier._laserVertexData);

        gl.enableVertexAttribArray(shaders.solid.a_Position);
        gl.vertexAttribPointer(shaders.solid.a_Position, 3, gl.FLOAT, false, 0, 0);
        gl.uniformMatrix4fv(shaders.solid.u_ModelMatrix, false, modelMatrix.elements);
        gl.uniform4f(shaders.solid.u_Color, 1, 0.8, 0.9, 1);

        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, Flier._laserElementBuffer);
        gl.drawElements(gl.TRIANGLES, Flier._laserElements, gl.UNSIGNED_SHORT, 0);

        freeMat4(modelMatrix);
    }
}
