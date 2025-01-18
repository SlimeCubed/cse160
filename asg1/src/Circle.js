class Circle
{
    constructor(x, y, r, g, b, size, vertices) {
        this.vertices = vertices;
        this.buffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, this.buffer);

        const verts = new Float32Array(vertices * 2);
        for (let i = 0; i < vertices; i++) {
            const rads = i / vertices * Math.PI * 2 + Math.PI / 2;
            verts[i * 2 + 0] = x + size * Math.cos(rads) / canvas.width;
            verts[i * 2 + 1] = y + size * Math.sin(rads) / canvas.height;
        }
        gl.bufferData(gl.ARRAY_BUFFER, verts, gl.STATIC_DRAW);

        this.r = r;
        this.g = g;
        this.b = b;
    }

    render() {
        gl.uniform4f(u_Color, this.r, this.g, this.b, 1);

        gl.bindBuffer(gl.ARRAY_BUFFER, this.buffer);
        gl.vertexAttribPointer(a_Position, 2, gl.FLOAT, false, 0, 0);
        gl.enableVertexAttribArray(a_Position);

        gl.drawArrays(gl.TRIANGLE_FAN, 0, this.vertices);
    }

    cleanup() {
        gl.deleteBuffer(this.buffer);
    }
}
