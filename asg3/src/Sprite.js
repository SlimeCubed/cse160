// Vertex shader program for sprite
const VS_SPRITE = `
attribute vec2 a_Position;

uniform mat4 u_UiMatrix;
uniform mat4 u_ModelMatrix;

void main() {
    gl_Position = u_UiMatrix * u_ModelMatrix * vec4(a_Position, 0.0, 1.0);
}
`;

// Fragment shader program for sprite
const FS_SPRITE = `
uniform lowp vec4 u_Color;

void main() {
    gl_FragColor = u_Color;
}
`;

class Cursor
{
    constructor() {
        this._buffer = gl.createBuffer();
        this._vertexCount = 0;
        this._modelMatrix = new Matrix4();
        this.x = 0;
        this.y = 0;
        this.r = 1;
        this.g = 1;
        this.b = 1;
        this.a = 1;

        this._buildMesh();
    }

    _buildMesh() {
        const data = [];
        let dataInd = 0;

        function add(x, y, rotation) {
            data[dataInd++] = Math.cos(rotation) * x + Math.sin(rotation) * y;
            data[dataInd++] = Math.cos(rotation) * y - Math.sin(rotation) * x;
        }

        // Center dot
        add(-1, -1, 0);
        add(1, -1, 0);
        add(1, 1, 0);
        add(-1, -1, 0);
        add(1, 1, 0);
        add(-1, 1, 0);

        // Extents
        for (let i = 0; i < 4; i++) {
            const r = i / 4 * Math.PI * 2;
            add(-8, -1, r);
            add(-3, -1, r);
            add(-3,  1, r);
            add(-8, -1, r);
            add(-3,  1, r);
            add(-8,  1, r);
        }
        this._vertexCount = dataInd / 2;

        // Upload into buffer
        gl.bindBuffer(gl.ARRAY_BUFFER, this._buffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(data), gl.STATIC_DRAW);
    }

    render() {
        this._modelMatrix.setTranslate(this.x, this.y, 0);

        gl.useProgram(shaders.sprite.program);
        gl.uniform4f(shaders.sprite.u_Color, this.r, this.g, this.b, this.a);
        gl.uniformMatrix4fv(shaders.sprite.u_ModelMatrix, false, this._modelMatrix.elements);
        gl.bindBuffer(gl.ARRAY_BUFFER, this._buffer);
        gl.enableVertexAttribArray(shaders.sprite.a_Position);
        gl.vertexAttribPointer(shaders.sprite.a_Position, 2, gl.FLOAT, false, 0, 0);
        
        gl.depthMask(false);
        gl.enable(gl.BLEND);
        gl.disable(gl.CULL_FACE);
        gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

        gl.drawArrays(gl.TRIANGLES, 0, this._vertexCount);

        gl.depthMask(true);
        gl.disable(gl.BLEND);
        gl.enable(gl.CULL_FACE);
    }
}

class HurtOverlay
{
    constructor() {
        this._buffer = gl.createBuffer();
        this._vertexCount = 0;
        this._modelMatrix = new Matrix4();
        this.r = 1;
        this.g = 1;
        this.b = 1;
        this.a = 0;

        this._buildMesh();
    }

    _buildMesh() {
        const data = [];
        let dataInd = 0;

        function add(x, y) {
            data[dataInd++] = x;
            data[dataInd++] = y;
        }

        // Full screen quad
        add(0, 0);
        add(1, 0);
        add(1, 1);
        add(0, 0);
        add(1, 1);
        add(0, 1);

        this._vertexCount = dataInd / 2;

        // Upload into buffer
        gl.bindBuffer(gl.ARRAY_BUFFER, this._buffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(data), gl.STATIC_DRAW);
    }

    render() {
        const temp = getMat4();
        temp.setScale(canvas.width, canvas.height);

        gl.useProgram(shaders.sprite.program);
        gl.uniform4f(shaders.sprite.u_Color, this.r, this.g, this.b, this.a);
        gl.uniformMatrix4fv(shaders.sprite.u_ModelMatrix, false, temp.elements);
        gl.bindBuffer(gl.ARRAY_BUFFER, this._buffer);
        gl.enableVertexAttribArray(shaders.sprite.a_Position);
        gl.vertexAttribPointer(shaders.sprite.a_Position, 2, gl.FLOAT, false, 0, 0);
        
        gl.depthMask(false);
        gl.enable(gl.BLEND);
        gl.disable(gl.DEPTH_TEST);
        gl.disable(gl.CULL_FACE);
        gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

        gl.drawArrays(gl.TRIANGLES, 0, this._vertexCount);

        gl.depthMask(true);
        gl.disable(gl.BLEND);
        gl.enable(gl.DEPTH_TEST);
        gl.enable(gl.CULL_FACE);

        freeMat4(temp);
    }
}
