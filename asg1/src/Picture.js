function drawPicture() {
    clearShapes();

    const verts = new Float32Array(6);
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.vertexAttribPointer(a_Position, 2, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(a_Position);

    const background = [0.294, 0.675, 0.929];
    const body = [0.706, 0.518, 0.322];
    const chest = [0.851, 0.788, 0.667];
    const nose = [0.729, 0.349, 0.510];
    const tailBase = [0.549, 0.376, 0.200];
    const tailTip = body;
    const ear = tailBase;
    const eye = [0.165, 0.165, 0.165];
    const whisker = [0.900, 0.900, 0.900];

    const triangles = [
        // Background
        [-100,-100, -100,100, 100,100, background],
        [-100,-100, 100,100, 100,-100, background],

        // Lower body
        [5,7, 4,8, 5,10, body],
        [2,8, 4,8, 5,10, body],
        [2,8, 5,10, 2,10, body],
        [4,0, 4,6, 9,6, body],
        [4,0, 9,6, 9,0, body],

        // Back arc
        [5,6, 9,6, 9,7, body],
        [5,6, 9,7, 8.75,8.5, body],
        [5,6, 8.75,8.5, 7.5,9.75, body],
        [5,6, 7.5,9.75, 6,10, body],
        [5,6, 6,10, 5,10, body],

        // Chest patch
        [2,0, 4,0, 2,1, chest],
        [4,0, 2,1, 4,1, chest],
        [2,1, 4,1, 3,1.5, chest],
        [3,1.5, 4,1, 5,1.5, chest],
        [3,1.5, 5,1.5, 3,6, chest],
        [5,1.5, 3,6, 5,7, chest],
        [3,6, 5,7, 2,7, chest],
        [5,7, 2,7, 4,8, chest],
        [2,7, 4,8, 2,8, chest],

        // Tail
        [9,1, 9,3.5, 10,2.5, tailBase],
        [9,1, 10,2.5, 10,1, tailBase],
        [3,4, 2,4, 3,3, tailBase],
        [1,3, 3,3, 2,4, tailBase],
        [1,2, 1,3, 3,3, tailTip],
        [1,2, 3,2, 3,3, tailTip],
        [3,2, 3,3, 4,2.5, tailTip],

        // Head arc
        [1,10, 5,10, 5,11, body],
        [1,10, 5,11, 4.75,12.5, body],
        [1,10, 4.75,12.5, 3.5,13.75, body],
        [1,10, 3.5,13.75, 2,14, body],
        [1,10, 2,14, 1,14, body],

        // Snout
        [1,12.5, 1,10, 0.3,10.3, body],
        [1,12.5, 0.3,10.3, 0,11, body],
        [1,12.5, 0,11, 0,11.5, body],
        [0,12, 0,11.5, 0.5,12, nose],

        // Eye
        [1.5,12, 1.5,13, 2.33,13, eye],

        // Ear
        [2.66,13, 3.5,12.5, 2.66,15.5, ear],

        // Whiskers
        [1.33,10.5, 1.66,10.5, 1.5,8.5, whisker],
        [2.5,11.33, 2.5,11.66, 4.5, 11.5, whisker],
        [2.25,10.5, 2.5,10.75, 3.5,9.5, whisker],
    ];

    const gridSize = 16;
    const offsetX = 4;
    const offsetY = 0;

    for (const tri of triangles) {
        for (let i = 0; i < 6; i++) {
            verts[i] = (tri[i] + (i % 2 ? offsetY : offsetX)) / gridSize * 2 - 1;
        }
        gl.bufferData(gl.ARRAY_BUFFER, verts, gl.STATIC_DRAW);
        let r = tri[6][0];
        let g = tri[6][1];
        let b = tri[6][2];
        gl.uniform4f(u_Color, r, g, b, 1);
        gl.drawArrays(gl.TRIANGLES, 0, 3);
    }
}
