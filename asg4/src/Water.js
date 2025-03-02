// Vertex shader program for water
const VS_WATER = `
attribute vec3 a_Position;

uniform mat4 u_ProjectionMatrix;
uniform mat4 u_ViewMatrix;
uniform mat4 u_ModelMatrix;

// Lighting
varying vec3 v_WorldPosition;
varying vec3 v_ViewDir;

void main() {
    vec4 worldPosition = u_ModelMatrix * vec4(a_Position, 1.0);
    vec4 viewPosition =  u_ViewMatrix * worldPosition;
    gl_Position = u_ProjectionMatrix * viewPosition;

    // Lighting
    v_ViewDir = mat3(
        u_ViewMatrix[0][0], u_ViewMatrix[1][0], u_ViewMatrix[2][0],
        u_ViewMatrix[0][1], u_ViewMatrix[1][1], u_ViewMatrix[2][1],
        u_ViewMatrix[0][2], u_ViewMatrix[1][2], u_ViewMatrix[2][2]
    ) * viewPosition.xyz;
    v_WorldPosition = worldPosition.xyz;
}
`;

// Fragment shader program for water
const FS_WATER = `
uniform samplerCube u_Sky;
uniform highp float u_Time;

// Lighting
uniform int u_ShowNormals;
uniform int u_DoLighting;
uniform highp vec3 u_LightPosition;
uniform highp vec3 u_LightColor;
uniform lowp float u_LightIntensity;
uniform highp vec3 u_SpotLightPosition;
uniform highp vec3 u_SpotLightCone;
uniform highp vec3 u_SpotLightColor;
uniform lowp float u_SpotLightIntensity;
uniform lowp float u_DiffuseAmount;
uniform lowp float u_SpecularAmount;
uniform lowp float u_SpecularExponent;
uniform highp vec3 u_AmbientColor;
varying highp vec3 v_WorldPosition;
varying highp vec3 v_ViewDir;
varying mediump vec3 v_Normal;

lowp vec3 light(mediump vec3 pos, mediump vec3 normal, mediump vec3 color, highp vec3 viewDir) {
    if (u_DoLighting == 0) return color;
    lowp vec3 res = vec3(0.0, 0.0, 0.0);
    viewDir = normalize(viewDir);
    
    res += u_AmbientColor * color; // Ambient

    // Point light
    mediump vec3 lightDir = normalize(u_LightPosition - pos);
    mediump float factor = 1.0 / dot(u_LightPosition - pos, u_LightPosition - pos) * u_LightIntensity;
    lowp float diffuseDot = dot(normal, lightDir);
    if (diffuseDot > 0.0) {
        res += u_LightColor * color * diffuseDot * u_DiffuseAmount * factor; // Diffuse
        res += pow(max(dot(reflect(lightDir, normal), viewDir), 0.0), u_SpecularExponent * 5.0) * u_LightColor * u_SpecularAmount * factor; // Specular
    }

    // Spot light
    lightDir = normalize(u_SpotLightPosition - pos);
    factor = 1.0 / dot(u_SpotLightPosition - pos, u_SpotLightPosition - pos) * (dot(u_SpotLightCone, lightDir) < -1.0 ? 1.0 : 0.0) * u_SpotLightIntensity;
    diffuseDot = dot(normal, lightDir);
    if (diffuseDot > 0.0) {
        res += u_SpotLightColor * color * max(dot(normal, lightDir), 0.0) * u_DiffuseAmount * factor; // Diffuse
        res += u_SpotLightColor * pow(max(dot(reflect(lightDir, normal), viewDir), 0.0), u_SpecularExponent * 5.0) * u_SpecularAmount * factor; // Specular
    }

    return res;
}

void main() {
    highp float dist = length(v_ViewDir.xz) / abs(v_ViewDir.y);

    highp float u = sin(v_WorldPosition.x + u_Time * 4.0) * 0.03;
    highp float v = sin(v_WorldPosition.z + v_WorldPosition.x * 0.3 + u_Time * 3.0) * 0.03;
    mediump vec3 normal = normalize(vec3(u, 1.0 + dist * 2.0, v));

    if (u_ShowNormals > 0) {
        gl_FragColor = vec4(normal * 0.5 + 0.5, 1.0);
        return;
    }

    mediump vec4 sky = textureCube(u_Sky, normalize(reflect(v_ViewDir, normal)));
    sky.rgb *= u_AmbientColor;
    lowp float skyLum = dot(vec3(0.2126, 0.7152, 0.0722), sky.rgb);

    gl_FragColor = vec4(sky.rgb, skyLum) * 0.15;
    gl_FragColor.rgb += light(v_WorldPosition, normal, vec3(0.1, 0.15, 0.2), v_ViewDir);
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
