// Vertex shader program for skybox
const VS_SKY = `
attribute vec3 a_Position;

uniform mat4 u_ProjectionMatrix;
uniform mat4 u_ViewMatrix;

varying vec3 v_Dir;

void main() {
    gl_Position.xyz = mat3(u_ViewMatrix) * a_Position;
    gl_Position.w = 1.0;
    gl_Position = u_ProjectionMatrix * gl_Position;
    v_Dir = a_Position;
}
`;

// Fragment shader program for skybox
const FS_SKY = `
uniform samplerCube u_Sky;
uniform lowp vec3 u_AmbientColor;
uniform int u_ShowNormals;
uniform int u_DoLighting;

varying highp vec3 v_Dir;

void main() {
    gl_FragColor = v_Dir.y < 0.0 ? vec4(0.1, 0.15, 0.2, 1.0) : textureCube(u_Sky, normalize(v_Dir));
    if (u_DoLighting != 0 && u_ShowNormals <= 0)
        gl_FragColor.rgb *= u_AmbientColor / vec3(0.6, 0.6, 0.8);
}
`;

class Skybox
{
    constructor() {
        this._buffer = gl.createBuffer();
        this._vertexCount = 0;

        this._buildMesh();
    }

    _buildMesh() {
        const data = [];
        const normal = new Vector3();
        const tangent = new Vector3();
        const bitangent = new Vector3();
        const point = new Vector3();
        let dataInd = 0;

        function add(point) {
            data[dataInd++] = point.elements[0];
            data[dataInd++] = point.elements[1];
            data[dataInd++] = point.elements[2];
        }

        // Loop through all faces
        for (let axis = 0; axis < 3; axis++) {
            for (let dir = -1; dir <= 1; dir += 2) {

                // Compute face normals and tangent
                normal.sub(normal);
                normal.elements[axis] = dir;

                tangent.sub(tangent);
                tangent.elements[(axis + 1) % 3] = 1;
                bitangent.set(normal).cross(tangent);

                add(point.set(normal).add(bitangent).add(tangent));
                add(point.set(normal).sub(bitangent).sub(tangent));
                add(point.set(normal).sub(bitangent).add(tangent));
                add(point.set(normal).add(bitangent).add(tangent));
                add(point.set(normal).add(bitangent).sub(tangent));
                add(point.set(normal).sub(bitangent).sub(tangent));
            }
        }
        this._vertexCount = data.length / 3;

        // Upload into buffer
        gl.bindBuffer(gl.ARRAY_BUFFER, this._buffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(data), gl.STATIC_DRAW);
    }

    render() {
        gl.useProgram(shaders.sky.program);
        gl.uniform1i(shaders.sky.u_Sky, 1);
        gl.bindBuffer(gl.ARRAY_BUFFER, this._buffer);
        gl.enableVertexAttribArray(shaders.sky.a_Position);
        gl.vertexAttribPointer(shaders.sky.a_Position, 3, gl.FLOAT, false, 0, 0);
        
        gl.disable(gl.DEPTH_TEST);
        gl.disable(gl.CULL_FACE);
        gl.drawArrays(gl.TRIANGLES, 0, this._vertexCount);
        gl.enable(gl.DEPTH_TEST);
        gl.enable(gl.CULL_FACE);
    }
}
