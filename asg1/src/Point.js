class Point
{
    constructor(x, y, r, g, b, size) {
        this.x = x;
        this.y = y;
        this.r = r;
        this.g = g;
        this.b = b;
        this.size = size;
    }

    render() {
        gl.disableVertexAttribArray(a_Position);
        gl.vertexAttrib4f(a_Position, this.x, this.y, 0, 1);

        gl.uniform4f(u_Color, this.r, this.g, this.b, 1);
        gl.uniform1f(u_PointSize, this.size);
        gl.drawArrays(gl.POINTS, 0, 1);
    }
}
