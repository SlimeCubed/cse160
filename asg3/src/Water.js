// Vertex shader program for water
const VS_WATER = `
attribute vec3 a_Position;

uniform mat4 u_ProjectionMatrix;
uniform mat4 u_ViewMatrix;
uniform mat4 u_ModelMatrix;

varying vec3 v_WorldPos;
varying vec3 v_DeltaFromCamera;

void main() {
    vec4 worldPos = u_ModelMatrix * vec4(a_Position, 1.0);
    vec4 viewPos =  u_ViewMatrix * worldPos;
    gl_Position = u_ProjectionMatrix * viewPos;

    mat3 viewRotate = mat3(
        u_ViewMatrix[0][0], u_ViewMatrix[1][0], u_ViewMatrix[2][0],
        u_ViewMatrix[0][1], u_ViewMatrix[1][1], u_ViewMatrix[2][1],
        u_ViewMatrix[0][2], u_ViewMatrix[1][2], u_ViewMatrix[2][2]
    );
    v_DeltaFromCamera = viewRotate * viewPos.xyz;
    v_WorldPos = worldPos.xyz;
}
`;

// Fragment shader program for water
const FS_WATER = `
uniform samplerCube u_Sky;
uniform highp mat4 u_ViewMatrix;
uniform highp float u_Time;

varying highp vec3 v_WorldPos;
varying highp vec3 v_DeltaFromCamera;

void main() {
    highp float dist = length(v_DeltaFromCamera.xz) / abs(v_DeltaFromCamera.y);

    highp float u = sin(v_WorldPos.x + u_Time * 4.0) * 0.03;
    highp float v = sin(v_WorldPos.z + v_WorldPos.x * 0.3 + u_Time * 3.0) * 0.03;
    mediump vec3 normal = normalize(vec3(u, 1.0 + dist * 2.0, v));

    mediump vec4 sky = textureCube(u_Sky, normalize(reflect(v_DeltaFromCamera, normal)));
    lowp float skyLum = dot(vec3(0.2126, 0.7152, 0.0722), sky.rgb);

    gl_FragColor = vec4(sky.rgb, skyLum) * 0.5;
}
`;

class Water
{
    constructor() {
        this._buffer = gl.createBuffer();
        this._vertexCount = 0;
        this._modelMatrix = new Matrix4();
        this._modelMatrix.setTranslate(0, -0.5, 0);

        this._buildMesh();
    }

    _buildMesh() {
        const data = [];
        let dataInd = 0;

        function add(x, y, z) {
            data[dataInd++] = x;
            data[dataInd++] = y;
            data[dataInd++] = z;
        }

        // Loop through points in circle
        const innerRadius = 200;
        const radius = 10000;
        const verts = 64;
        for (let i = 0; i < verts; i++) {
            const r = i / verts * Math.PI * 2;
            const nextR = (i + 1) / verts * Math.PI * 2
            add(0, 0, 0);
            add(innerRadius * Math.cos(r), 0, radius * Math.sin(r));
            add(innerRadius * Math.cos(nextR), 0, radius * Math.sin(nextR));
            add(innerRadius * Math.cos(r), 0, radius * Math.sin(r));
            add(radius * Math.cos(r), 0, radius * Math.sin(r));
            add(radius * Math.cos(nextR), 0, radius * Math.sin(nextR));
            add(innerRadius * Math.cos(r), 0, radius * Math.sin(r));
            add(radius * Math.cos(nextR), 0, radius * Math.sin(nextR));
            add(innerRadius * Math.cos(nextR), 0, radius * Math.sin(nextR));
        }
        this._vertexCount = data.length / 3;

        // Upload into buffer
        gl.bindBuffer(gl.ARRAY_BUFFER, this._buffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(data), gl.STATIC_DRAW);
    }

    render() {
        gl.useProgram(shaders.water.program);
        gl.uniform1i(shaders.water.u_Sky, 1);
        gl.uniform1f(shaders.water.u_Time, performance.now() / 1000.0);
        gl.uniformMatrix4fv(shaders.water.u_ModelMatrix, false, this._modelMatrix.elements);
        gl.bindBuffer(gl.ARRAY_BUFFER, this._buffer);
        gl.enableVertexAttribArray(shaders.water.a_Position);
        gl.vertexAttribPointer(shaders.water.a_Position, 3, gl.FLOAT, false, 0, 0);
        
        gl.enable(gl.BLEND);
        gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
        gl.disable(gl.CULL_FACE);
        gl.depthMask(false);

        gl.drawArrays(gl.TRIANGLES, 0, this._vertexCount);

        gl.disable(gl.BLEND);
        gl.enable(gl.CULL_FACE);
        gl.depthMask(true);
    }
}
