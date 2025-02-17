// Vertex shader program for trail
const VS_SOLID = `
attribute vec3 a_Position;

uniform mat4 u_ProjectionMatrix;
uniform mat4 u_ViewMatrix;
uniform mat4 u_ModelMatrix;

void main() {
    gl_Position = u_ProjectionMatrix * u_ViewMatrix * u_ModelMatrix * vec4(a_Position, 1.0);
}
`;

// Fragment shader program for trail
const FS_SOLID = `
uniform lowp vec4 u_Color;

void main() {
    gl_FragColor = u_Color;
}
`;

class Bow {
    constructor() {
        this.minCharge = 0.25;
        this.charge = 0;
        this.overcharge = 0;
        this.bowOut = 0;
        this.arrowNotched = false;
        this.arrows = [];

        this._buffer = gl.createBuffer();
        this._limbVertices = 0;
        this._stringVertices = 0;
        this._arrowVertices = 0;
        this._buildMesh();
    }

    update(dt) {
        this.timeSinceShot += dt;
        this.bowOut = Math.max(this.bowOut - dt, 0);

        // Charge bow
        if (!creative) {
            if (input.placeBlock) {
                this.arrowNotched = true;
                this.bowOut = 0.75;
                this.charge = this.charge + dt;
                if (this.charge > 1) {
                    this.overcharge += this.charge - 1;
                    this.charge = 1;
                }
            } else if (this.charge > this.minCharge) {
                this.shoot((this.charge - this.minCharge) / (1 - this.minCharge), this.overcharge > 1);
                this.charge = 0;
                this.overcharge = 0;
            } else {
                this.charge = Math.max(this.charge - dt, 0);
                this.overcharge = 0;
            }
        }

        let anyDespawn = false;
        for (const arrow of this.arrows) {
            arrow.update(dt);
            if (arrow.shouldDespawn())
                anyDespawn = true;
        }

        if (anyDespawn) {
            this.arrows = this.arrows.filter(arrow => !arrow.shouldDespawn());
        }
    }

    shoot(charge, overcharged) {
        this.arrowNotched = false;

        // Spawn a new arrow
        const vel = getVec3();
        const pos = getVec3();
        vel.set(camera.forward).mul(20 + charge * 80);
        pos.set(camera.position).addMultiple(camera.right, 0.25);

        this.arrows.push(new Arrow(pos, vel, overcharged));

        audio.playPanned(audio.sounds.arrow_fire, 0.8, 0.3);

        freeVec3(vel);
        freeVec3(pos);
    }

    _buildMesh() {
        let data = [];
        const m = 0.1 / 16;
        let dataInd = 0;
        const atlasWidth = 16;
        const atlasHeight = 16;

        function add(x, y, z, u, v) {
            data[dataInd++] = (x - 0.5) / 8;
            data[dataInd++] = y / 8;
            data[dataInd++] = (z - 0.5) / 8;
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

        // Limb
        addFace( // Bottom
            0, 0, 0, 6 + m, 0 + m,
            1, 0, 0, 6 + m, 1 - m,
            1, 0, 1, 7 - m, 1 - m,
            0, 0, 1, 7 - m, 0 + m,
        );
        addFace( // Top
            0, 4, 0, 6 + m, 0 + m,
            0, 4, 1, 7 - m, 0 + m,
            1, 4, 1, 7 - m, 1 - m,
            1, 4, 0, 6 + m, 1 - m,
        );
        addFace( // Front
            0, 0, 0, 5 + m, 4 - m,
            0, 4, 0, 5 + m, 0 + m,
            1, 4, 0, 6 - m, 0 + m,
            1, 0, 0, 6 - m, 4 - m,
        );
        addFace( // Back
            0, 0, 1, 5 + m, 4 - m,
            1, 0, 1, 6 - m, 4 - m,
            1, 4, 1, 6 - m, 0 + m,
            0, 4, 1, 5 + m, 0 + m,
        );
        addFace( // Left
            0, 0, 0, 5 + m, 12 - m,
            0, 0, 1, 6 - m, 12 - m,
            0, 4, 1, 6 - m, 8 + m,
            0, 4, 0, 5 + m, 8 + m,
        );
        addFace( // Right
            1, 0, 0, 5 + m, 12 - m,
            1, 4, 0, 5 + m, 8 + m,
            1, 4, 1, 6 - m, 8 + m,
            1, 0, 1, 6 - m, 12 - m,
        );
        this._limbVertices = data.length / 11;

        // String
        addFaceDouble(
            0.5, 0, 0, 0 + m, 16 - m,
            0.5, 0, 1, 1 + m, 16 - m,
            0.5, 16, 1, 1 + m, 0 + m,
            0.5, 16, 0, 0 + m, 0 + m,
        );
        this._stringVertices = data.length / 11 - this._limbVertices;

        // Arrow
        addFaceDouble(
            0.5, 0, 0, 1 + m, 16 - m,
            0.5, 0, 1, 2 + m, 16 - m,
            0.5, 16, 1, 2 + m, 0 + m,
            0.5, 16, 0, 1 + m, 0 + m,
        );
        addFaceDouble(
            0, 0, 0.5, 1 + m, 16 - m,
            1, 0, 0.5, 2 + m, 16 - m,
            1, 16, 0.5, 2 + m, 0 + m,
            0, 16, 0.5, 1 + m, 0 + m,
        );
        this._arrowVertices = data.length / 11 - this._stringVertices - this._limbVertices;

        computeNormals(data, 11, 0, 3);
        gl.bindBuffer(gl.ARRAY_BUFFER, this._buffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(data), gl.STATIC_DRAW);
    }

    _drawLimb(m) {
        gl.uniformMatrix4fv(shaders.block.u_ModelMatrix, false, m.elements);
        gl.drawArrays(gl.TRIANGLES, 0, this._limbVertices);
    }

    _drawString(m) {
        gl.uniformMatrix4fv(shaders.block.u_ModelMatrix, false, m.elements);
        gl.drawArrays(gl.TRIANGLES, this._limbVertices, this._stringVertices);
    }

    _drawArrow(m) {
        if (this.overcharge > 1 && (this.overcharge * 10 % 1) < 0.5) {
            gl.uniform4f(shaders.block.u_Overlay, 1, 0, 0, 0.5);
        }
        gl.uniformMatrix4fv(shaders.block.u_ModelMatrix, false, m.elements);
        gl.drawArrays(gl.TRIANGLES, this._limbVertices + this._stringVertices, this._arrowVertices);
        gl.uniform4f(shaders.block.u_Overlay, 0, 0, 0, 0);
    }

    render() {
        gl.useProgram(shaders.block.program);
        gl.uniform1i(shaders.block.u_Atlas, 5);
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

        const base = getMat4();
        const part = getMat4();
        const basePart = getMat4();

        // Move bow
        const move = Math.min(this.bowOut * 5, 1);
        const out = 0.3 + 0.2 * move;
        const up = move * 0.5 - 0.6 + 0.1 * this.charge;
        const forward = 1 + Math.min(this.charge * 2, 1) * 0.1;
        const turn = (1 - move) * 80;
        base.setTranslate(camera.position.elements[0], camera.position.elements[1], camera.position.elements[2])
            .translate(camera.forward.elements[0] * forward, camera.forward.elements[1] * forward, camera.forward.elements[2] * forward)
            .translate(camera.right.elements[0] * out, camera.right.elements[1] * out, camera.right.elements[2] * out)
            .translate(camera.up.elements[0] * up, camera.up.elements[1] * up, camera.up.elements[2] * up)
            .rotate(camera.yaw, 0, 1, 0)
            .rotate(camera.pitch, 1, 0, 0)
            .rotate(turn / 4, 0, 1, 0)
            .rotate(turn, 0, 0, 1)
            .scale(0.4, 0.4, 0.4);
        
        // Draw bow limbs
        const tempVec = getVec4();
        const limbAng = 10 + this.charge * 10;
        const stringAng = this.charge * 35 + this.arrowNotched * 10;
        for (let dir = 0; dir < 2; dir++) {
            part.setRotate(180 * dir, 0, 0, 1);
            for (let i = 0; i < 3; i++) {
                part.rotate(limbAng, 1,0,0);
                this._drawLimb(basePart.set(base).multiply(part));
                part.translate(0, 0.45, 0)
                    .scale(0.99, 1, 1);
            }

            tempVec.elements[0] = 0;
            tempVec.elements[1] = 0;
            tempVec.elements[2] = 0;
            tempVec.elements[3] = 1;
            const limbEnd = part.multiplyVector4(tempVec);
            const e = limbEnd.elements;
            const pinchZ = limbEnd.elements[2] + Math.abs(e[1]) * Math.tan(stringAng * Math.PI / 180);
            part.setTranslate(0, 0, pinchZ)
                .rotate(stringAng * -Math.sign(e[1]), 1, 0, 0)
                .scale(Math.sign(e[1]), e[1] / 2 / Math.cos(stringAng * Math.PI / 180), 1);
            this._drawString(basePart.set(base).multiply(part));
            
            // Draw arrow
            if (dir === 0 && this.arrowNotched) {
                part.setTranslate(0, 0, pinchZ)
                    .rotate(Math.atan2(1.25 / 16, pinchZ) * 180 / Math.PI, 0, 1, 0)
                    .rotate(90, -1, 0, 0)
                    .rotate(45, 0, 1, 0);
                this._drawArrow(basePart.set(base).multiply(part));
            }
        }

        freeVec4(tempVec);
        freeMat4(base);
        freeMat4(part);
        freeMat4(basePart);

        for (const arrow of this.arrows)
            arrow.render();

        
        for (let i = this.arrows.length - 1; i >= 0; i--) {

        }
    }
}

class Arrow
{
    static _arrowBuffer = null;
    static _arrowVertices = 0;
    
    static _maxTrailPoints = 10;
    static _trailVertexBuffer = null;
    static _trailVertexData = null;
    static _trailElementBuffer = null;
    static _trailElements = 0;

    constructor(position, velocity, overcharged) {
        this.position = new Vector3(position.elements);
        this.velocity = new Vector3(velocity.elements);
        this.direction = new Vector3(velocity.elements).normalize();
        this.overcharged = overcharged;
        this.stuck = false;
        this.hidden = false;
        this.age = 0;
        this._trailDead = false;
        this._trailPoints = [new Vector3(position.elements)];
        this._trailTimer = 0;

        if (Arrow._trailVertexBuffer === null)
            Arrow._buildTrailMesh();
        if (Arrow._arrowBuffer === null)
            Arrow._buildArrowMesh();
    }

    update(dt) {
        if (!this.stuck)
            this.fly(dt);

        this.age += dt;

        this._trailTimer += dt * 30;
        if (this._trailTimer > 1) {
            this._trailTimer -= 1;
            this._trailPoints.unshift(new Vector3(this.position.elements));

            if (this._trailPoints.length > Arrow._maxTrailPoints + 1)
                this._trailPoints.pop();
        }
    }

    shouldDespawn() {
        if (this.age > 20 || this.hidden && this._trailDead)
            return true;

        // Despawn when trail goes fully underwater
        if (this.position.elements[1] < -10) {
            for (const trailPoint of this._trailPoints) {
                if (trailPoint[1] > -5) return false;
            }
            return true;
        }
        return false;
    }

    fly(dt) {
        this.velocity.elements[1] -= gravity * dt;

        const delta = getVec3();

        const x = this.position.elements[0];
        const y = this.position.elements[1];
        const z = this.position.elements[2];

        // Move and cast against chunks
        let hitAnything = false;
        delta.set(this.velocity).mul(dt);
        const dist = delta.magnitude();
        const hit = castAllChunks(this.position, delta);
        if (hit) {
            const dx = hit.hitX - x;
            const dy = hit.hitY - y;
            const dz = hit.hitZ - z;
            const newDist = Math.sqrt(dx * dx + dy * dy + dz * dz);
            if (newDist < dist) {
                delta.mul(newDist / dist);
                this.velocity.mul(0);
                this.stuck = true;
                hitAnything = true;
            }
        }

        this.position.add(delta);

        // Cast against enemies
        delta.normalize();
        let closestEnemy = null;
        let closestEnemyDist = dist;
        for (const enemy of enemies) {
            const enemyDist = enemy.rayCast(
                x, y, z,
                delta.elements[0], delta.elements[1], delta.elements[2]
            );
            if (enemyDist < closestEnemyDist) {
                closestEnemy = enemy;
                closestEnemyDist = enemyDist
            }
        }

        if (closestEnemy !== null) {
            this.position.elements[0] = x + delta.elements[0] * closestEnemyDist;
            this.position.elements[1] = y + delta.elements[1] * closestEnemyDist;
            this.position.elements[2] = z + delta.elements[2] * closestEnemyDist;
            closestEnemy.shot(true);
            this.stuck = true;
            this.hidden = true;
            hitAnything = true;
        }

        if (hitAnything)
            this.hitSomething();

        freeVec3(delta);

        if (this.velocity.magnitude() > 0.01)
            this.direction.set(this.velocity);
    }

    hitSomething() {
        audio.playPositioned(audio.sounds.arrow_hit, 0.3, this.position, 2);

        if (this.overcharged)
            this.explode();
    }

    explode() {
        audio.playPositioned(audio.sounds["boom_" + randomInt(0, 3)], 0.4, this.position, 10);
        effects.push(new Explosion(this.position, 3, 1, 0.4, 0.2, 0));
        this.hidden = true;
        this.stuck = true;
    }

    render() {
        const modelMat = getMat4();
        const look = getMat4();

        if (!this.hidden) {
            // Rotate to direction
            look.setLookAt(
                0, 0, 0,
                this.direction.elements[0], this.direction.elements[1], this.direction.elements[2],
                0, 1, 0);
            look.transpose();

            // Move to position
            modelMat.setTranslate(this.position.elements[0], this.position.elements[1], this.position.elements[2])
                .multiply(look)
                .rotate(-90, 1, 0, 0);

            // Draw arrow
            gl.useProgram(shaders.block.program);
            gl.bindBuffer(gl.ARRAY_BUFFER, Arrow._arrowBuffer);
            gl.vertexAttribPointer(shaders.block.a_Position, 3, gl.FLOAT, false, 4 * 11, 0);
            gl.vertexAttribPointer(shaders.block.a_Normal, 3, gl.FLOAT, true, 4 * 11, 4 * 3);
            gl.vertexAttribPointer(shaders.block.a_Uv, 2, gl.FLOAT, false, 4 * 11, 4 * 6);
            gl.vertexAttribPointer(shaders.block.a_Color, 3, gl.FLOAT, false, 4 * 11, 4 * 8);

            gl.uniformMatrix4fv(shaders.block.u_ModelMatrix, false, modelMat.elements);
            gl.drawArrays(gl.TRIANGLES, 0, Arrow._arrowVertices);
        }

        if (!this._trailDead) {
            // Update trail model
            let anyTrail = false;
            const prev = getVec3();
            const cur = getVec3();
            const next = getVec3();
            const dir = getVec3();
            const up = getVec3();
            const right = getVec3();
            const p = getVec3();
            for (let i = 0; i < Arrow._maxTrailPoints; i++) {
                this._getSmoothedTrailPoint(i - 1, prev);
                this._getSmoothedTrailPoint(i, cur);
                this._getSmoothedTrailPoint(i + 1, next);

                const alongTrail = (i + this._trailTimer) / (Arrow._maxTrailPoints - 1);
                let radius = Math.sin(alongTrail * Math.PI) * 0.02;
                if (i === 0 || i === Arrow._maxTrailPoints - 1 || cur.elements[1] < -0.5)
                    radius = 0;

                dir.set(prev).sub(next);
                if (dir.magnitude() < 0.001) {
                    dir.set(this.direction);
                    radius = 0;
                } else {
                    anyTrail = true;
                }

                up.mul(0);
                up.elements[1] = 1;
                right.set(dir).cross(up);
                up.set(right).cross(dir);

                dir.normalize();
                up.normalize();
                right.normalize();

                for (let j = 0; j < 4; j++) {
                    const radians = j / 4 * Math.PI;
                    const o = (i * 4 + j) * 3;
                    p.set(cur)
                        .addMultiple(up, Math.cos(radians) * radius)
                        .addMultiple(right, Math.sin(radians) * radius);
                    Arrow._trailVertexData[o + 0] = p.elements[0];
                    Arrow._trailVertexData[o + 1] = p.elements[1];
                    Arrow._trailVertexData[o + 2] = p.elements[2];
                }
            }

            if (this.stuck && !anyTrail) {
                this._trailDead = true;
            }

            freeVec3(prev);
            freeVec3(cur);
            freeVec3(next);
            freeVec3(dir);
            freeVec3(up);
            freeVec3(right);
            freeVec3(p);

            gl.useProgram(shaders.solid.program);
            gl.bindBuffer(gl.ARRAY_BUFFER, Arrow._trailVertexBuffer);
            gl.bufferSubData(gl.ARRAY_BUFFER, 0, Arrow._trailVertexData);

            // Draw trail
            modelMat.setIdentity();

            gl.enableVertexAttribArray(shaders.solid.a_Position);
            gl.vertexAttribPointer(shaders.solid.a_Position, 3, gl.FLOAT, false, 0, 0);
            gl.uniformMatrix4fv(shaders.solid.u_ModelMatrix, false, modelMat.elements);

            if (this.overcharged)
                gl.uniform4f(shaders.solid.u_Color, 1, 0.4, 0.2, 1);
            else
                gl.uniform4f(shaders.solid.u_Color, 1, 1, 1, 1);

            gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, Arrow._trailElementBuffer);
            gl.drawElements(gl.TRIANGLES, Arrow._trailElements, gl.UNSIGNED_SHORT, 0);
        }

        freeMat4(look);
        freeMat4(modelMat);
    }

    _getSmoothedTrailPoint(i, out) {
        const from = this._getTrailPoint(i);

        if (i === Arrow._maxTrailPoints - 1) {
            const to = this._getTrailPoint(i - 1);
            out.set(to)
                .sub(from)
                .mul(this._trailTimer)
                .add(from);
        } else {
            out.set(from);
        }
    }

    _getTrailPoint(i) {
        if (i <= 0 || this._trailPoints.length === 0) {
            return this.position;
        } else {
            return this._trailPoints[Math.min(i - 1, this._trailPoints.length - 1)];
        }
    }

    static _buildTrailMesh() {
        Arrow._trailVertexBuffer = gl.createBuffer();
        Arrow._trailVertexData = new Float32Array(Arrow._maxTrailPoints * 4 * 3);
        gl.bindBuffer(gl.ARRAY_BUFFER, Arrow._trailVertexBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, Arrow._trailVertexData.byteLength, gl.DYNAMIC_DRAW);

        const elementData = makeCylinderElements(Arrow._maxTrailPoints, 4);
        Arrow._trailElementBuffer = gl.createBuffer();
        Arrow._trailElements = elementData.length;
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, Arrow._trailElementBuffer);
        gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, elementData, gl.STATIC_DRAW);
    }

    static _buildArrowMesh() {
        Arrow._arrowBuffer = gl.createBuffer();
        
        let data = [];
        let dataInd = 0;
        const m = 0.1 / 16;

        function add(x, y, z, u, v) {
            data[dataInd++] = (x - 0.5) / 8;
            data[dataInd++] = y / 8 - 1;
            data[dataInd++] = (z - 0.5) / 8;
            dataInd += 3;
            data[dataInd++] = u / 16;
            data[dataInd++] = v / 16;
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

        addFaceDouble(
            0.5, 0, 0, 1 + m, 16 - m,
            0.5, 0, 1, 2 + m, 16 - m,
            0.5, 16, 1, 2 + m, 0 + m,
            0.5, 16, 0, 1 + m, 0 + m,
        );
        addFaceDouble(
            0, 0, 0.5, 1 + m, 16 - m,
            1, 0, 0.5, 2 + m, 16 - m,
            1, 16, 0.5, 2 + m, 0 + m,
            0, 16, 0.5, 1 + m, 0 + m,
        );

        Arrow._arrowVertices = dataInd / 11;

        computeNormals(data, 11, 0, 3);
        gl.bindBuffer(gl.ARRAY_BUFFER, Arrow._arrowBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(data), gl.STATIC_DRAW);
    }
}
