// Vertex shader program for the light model
const VS_LIGHT = `
attribute vec3 a_Position;

uniform mat4 u_ProjectionMatrix;
uniform mat4 u_ViewMatrix;
uniform mat4 u_ModelMatrix;

void main() {
    gl_Position = u_ProjectionMatrix * u_ViewMatrix * u_ModelMatrix * vec4(a_Position, 1);
}
`;

// Fragment shader program for the light model
const FS_LIGHT = `
uniform lowp vec3 u_Color;

void main() {
    gl_FragColor = vec4(u_Color, 1.0);
}
`;

class Light {
    constructor(spot) {
        this._buffer = gl.createBuffer();
        this._vertexCount = 0;
        this._modelMatrix = new Matrix4();
        this._grabDist = null;
        this.position = new Vector3();
        this.color = [1, 1, 1];
        this.animate = false;
        this.spot = spot;
        this.spotDir = new Vector3([0, -1, 0]);
        this.spotCone = new Vector3([0, -1, 0]);
        this.spotSize = 1;
        this.intensity = 0;

        this._buildMesh();
    }

    _buildMesh() {
        const data = [];
        let dataInd = 0;

        function add(x, y, z) {
            data[dataInd++] = x * 2 - 1;
            data[dataInd++] = y * 2 - 1;
            data[dataInd++] = z * 2 - 1;
        }

        function addFace(x1, y1, z1, x2, y2, z2, x3, y3, z3, x4, y4, z4) {
            add(x1, y1, z1);
            add(x2, y2, z2);
            add(x3, y3, z3);
            add(x1, y1, z1);
            add(x3, y3, z3);
            add(x4, y4, z4);
        }

        function addTri(x1, y1, z1, x2, y2, z2, x3, y3, z3) {
            add(x1, y1, z1);
            add(x2, y2, z2);
            add(x3, y3, z3);
        }

        if (this.spot) {
            addFace(0,0,0, 0,1,0, 1,1,0, 1,0,0);
            addTri(0,1,0, 0,0,0, 0.5,0.5,1);
            addTri(1,1,0, 0,1,0, 0.5,0.5,1);
            addTri(1,0,0, 1,1,0, 0.5,0.5,1);
            addTri(0,0,0, 1,0,0, 0.5,0.5,1);
        } else {
            addFace(0,0,0, 1,0,0, 1,0,1, 0,0,1);
            addFace(0,1,0, 0,1,1, 1,1,1, 1,1,0);
            addFace(0,0,0, 0,1,0, 1,1,0, 1,0,0);
            addFace(0,0,1, 1,0,1, 1,1,1, 0,1,1);
            addFace(0,0,0, 0,0,1, 0,1,1, 0,1,0);
            addFace(1,0,0, 1,1,0, 1,1,1, 1,0,1);
        }

        this._vertexCount = data.length / 3;

        // Upload into buffer
        gl.bindBuffer(gl.ARRAY_BUFFER, this._buffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(data), gl.STATIC_DRAW);
    }

    update(dt) {
    }

    grab() {
        const temp = getVec3();
        temp.set(this.position).sub(camera.position);
        this._grabDist = temp.magnitude();
        freeVec3(temp);
    }

    release() {
        this._grabDist = null;
    }

    render() {
        if (this._grabDist !== null) {
            this.spotDir.set(camera.forward);
            let dist = this._grabDist;
            const hit = castAllChunks(camera.position, camera.forward);
            if (hit) {
                const dx = hit.hitX + hit.normalX * 0.2 - camera.position.elements[0];
                const dy = hit.hitY + hit.normalY * 0.2 - camera.position.elements[1];
                const dz = hit.hitZ + hit.normalZ * 0.2 - camera.position.elements[2];

                dist = Math.min(dist, Math.sqrt(dx * dx + dy * dy + dz * dz));
            }

            this.position.set(camera.position);
            this.position.addMultiple(camera.forward, dist);
        } else if (this.animate) {
            const dx = this.position.elements[0] - 0.5;
            const dz = this.position.elements[2] - 0.5;
            const dist = Math.sqrt(dx * dx + dz * dz);

            const rot = performance.now() / 1000 * Math.PI;
            this.position.elements[0] = 0.5 + Math.cos(rot) * dist;
            this.position.elements[2] = 0.5 + Math.sin(rot) * dist;
        }

        const f = 1 / (1 - this.spotSize);
        this.spotCone.set(this.spotDir).mul(f);

        this._modelMatrix.setTranslate(this.position.elements[0], this.position.elements[1], this.position.elements[2])
            .scale(0.2, 0.2, 0.2);

        if (this.spot) {
            const temp = getMat4();
            const e = this.spotDir.elements;
            temp.lookAt(0, 0, 0, e[0], e[1], e[2], Math.abs(e[1]) === 1 ? 1 : 0, Math.abs(e[1]) === 1 ? 0 : 1, 0).transpose();
            this._modelMatrix.multiply(temp);
            freeMat4(temp);
        }

        gl.useProgram(shaders.light.program);
        gl.uniformMatrix4fv(shaders.light.u_ModelMatrix, false, this._modelMatrix.elements);
        gl.uniform3fv(shaders.light.u_Color, this.color);
        gl.bindBuffer(gl.ARRAY_BUFFER, this._buffer);
        gl.enableVertexAttribArray(shaders.light.a_Position);
        gl.vertexAttribPointer(shaders.light.a_Position, 3, gl.FLOAT, false, 0, 0);
        
        gl.drawArrays(gl.TRIANGLES, 0, this._vertexCount);
    }
}
