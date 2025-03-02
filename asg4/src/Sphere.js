// Vertex shader program for the sphere
const VS_SPHERE = `
attribute vec3 a_Position;
attribute vec3 a_Normal;

uniform mat4 u_ProjectionMatrix;
uniform mat4 u_ViewMatrix;
uniform mat4 u_ModelMatrix;
uniform mat3 u_NormalMatrix;

// Lighting
varying vec3 v_WorldPosition;
varying vec3 v_ViewDir;
varying vec3 v_Normal;

void main() {
    vec4 worldPosition = u_ModelMatrix * vec4(a_Position, 1);
    vec4 viewPosition = u_ViewMatrix * worldPosition;
    gl_Position = u_ProjectionMatrix * viewPosition;
    v_Normal = u_NormalMatrix * a_Normal;

    // Lighting
    v_ViewDir = mat3(
        u_ViewMatrix[0][0], u_ViewMatrix[1][0], u_ViewMatrix[2][0],
        u_ViewMatrix[0][1], u_ViewMatrix[1][1], u_ViewMatrix[2][1],
        u_ViewMatrix[0][2], u_ViewMatrix[1][2], u_ViewMatrix[2][2]
    ) * viewPosition.xyz;
    v_WorldPosition = worldPosition.xyz;
}
`;

// Fragment shader program for the sphere
const FS_SPHERE = `
uniform lowp vec3 u_SphereColor;

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
        res += pow(max(dot(reflect(lightDir, normal), viewDir), 0.0), u_SpecularExponent) * u_LightColor * u_SpecularAmount * factor; // Specular
    }

    // Spot light
    lightDir = normalize(u_SpotLightPosition - pos);
    factor = 1.0 / dot(u_SpotLightPosition - pos, u_SpotLightPosition - pos) * (dot(u_SpotLightCone, lightDir) < -1.0 ? 1.0 : 0.0) * u_SpotLightIntensity;
    diffuseDot = dot(normal, lightDir);
    if (diffuseDot > 0.0) {
        res += u_SpotLightColor * color * max(dot(normal, lightDir), 0.0) * u_DiffuseAmount * factor; // Diffuse
        res += u_SpotLightColor * pow(max(dot(reflect(lightDir, normal), viewDir), 0.0), u_SpecularExponent) * u_SpecularAmount * factor; // Specular
    }

    return res;
}

void main() {
    mediump vec3 normal = normalize(v_Normal);
    if (u_ShowNormals > 0) {
        gl_FragColor = vec4(normal * 0.5 + 0.5, 1.0);
        return;
    }

    gl_FragColor.rgb = light(v_WorldPosition, normal, u_SphereColor, v_ViewDir);
    gl_FragColor.a = 1.0;
}
`;

class Sphere {
    constructor() {
        this._buffer = gl.createBuffer();
        this._vertexCount = 0;
        this._modelMatrix = new Matrix4();
        this._normalMatrix = new Matrix4();
        this.color = [1, 1, 1];
        this.position = new Vector3([0.5, 5, 0.5]);

        this._buildMesh();
    }

    _buildMesh() {
        const data = [];
        let dataInd = 0;

        function add(pitch, yaw) {
            const pc = Math.cos(pitch);
            const ps = Math.sin(pitch);
            const yc = Math.cos(yaw);
            const ys = Math.sin(yaw);
            data[dataInd++] = pc * yc;
            data[dataInd++] = ps;
            data[dataInd++] = pc * ys;
            data[dataInd++] = pc * yc;
            data[dataInd++] = ps;
            data[dataInd++] = pc * ys;
        }

        // Generate sphere
        const rings = 32;
        const ringVerts = 64;
        const dp = Math.PI / rings;
        const dy = Math.PI * 2 / ringVerts;
        for (let ring = 0; ring < rings; ring++) {
            const p = ring * dp - Math.PI / 2;
            for (let vert = 0; vert < ringVerts; vert++) {
                const y = vert * dy;
                add(p, y);
                add(p + dp, y);
                add(p + dp, y + dy);
                add(p, y);
                add(p + dp, y + dy);
                add(p, y + dy);
            }
        }

        this._vertexCount = data.length / 6;

        // Upload into buffer
        gl.bindBuffer(gl.ARRAY_BUFFER, this._buffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(data), gl.STATIC_DRAW);
    }

    render() {
        this._normalMatrix.set(this._modelMatrix)
            .transpose()
            .invert();

        const n = this._normalMatrix.elements;

        this._modelMatrix.setTranslate(this.position.elements[0], this.position.elements[1], this.position.elements[2]);

        gl.useProgram(shaders.sphere.program);
        gl.uniformMatrix4fv(shaders.sphere.u_ModelMatrix, false, this._modelMatrix.elements);
        gl.uniformMatrix3fv(shaders.sphere.u_NormalMatrix, false, [ n[0], n[1], n[2], n[4], n[5], n[6], n[8], n[9], n[10] ]);
        gl.uniform3fv(shaders.sphere.u_SphereColor, this.color);
        gl.bindBuffer(gl.ARRAY_BUFFER, this._buffer);
        gl.enableVertexAttribArray(shaders.sphere.a_Position);
        gl.vertexAttribPointer(shaders.sphere.a_Position, 3, gl.FLOAT, false, 24, 0);
        gl.enableVertexAttribArray(shaders.sphere.a_Normal);
        gl.vertexAttribPointer(shaders.sphere.a_Normal, 3, gl.FLOAT, false, 24, 12);
        
        gl.drawArrays(gl.TRIANGLES, 0, this._vertexCount);
    }
}
