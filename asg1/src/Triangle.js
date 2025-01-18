class Triangle
{
    constructor(x, y, r, g, b, size) {
        this.buffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, this.buffer);

        // Create an equilateral triangle
        const dx = size / canvas.width;
        const dy = size / canvas.height * Math.sqrt(3) / 2;
        const verts = new Float32Array([
            x, y + dy,
            x - dx, y - dy,
            x + dx, y - dy
        ]);
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

        gl.drawArrays(gl.TRIANGLES, 0, 3);
    }

    cleanup() {
        gl.deleteBuffer(this.buffer);
    }
}
