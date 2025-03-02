/// GENERAL VARIABLES ///

/** @type {HTMLCanvasElement} */ let canvas = null;
/** @type {WebGLRenderingContext} */ let gl = null;
/** @type {Camera} */ let camera = new Camera();
/** @type {Player} */ let player = null;
/** @type {WebGLTexture} */ let atlasTexture = null;
/** @type {WebGLTexture} */ let skyTexture = null;
/** @type {URL} */ const atlasUrl = new URL("../img/atlas.png", location.href);
/** @type {URL} */ const skyUrl = new URL("../img/", location.href);
/** @type {Skybox} */ let skybox = null;
/** @type {Water} */ let water = null;
/** @type {Sphere} */ let sphere = null;
/** @type {Light} */ let light = null;
/** @type {Light} */ let spotLight = null;
/** @type {Array<VoxelChunk>} */ let chunks = [];
/** @type {number} */ let lastSpaceTime = 0;
/** @type {number} */ let gravity = 15;
/** @type {boolean} */ let showNormals = false;
/** @type {number} */ let diffuseAmount = 0;
/** @type {number} */ let specularAmount = 0;
/** @type {number} */ let specularExponent = 0;
/** @type {number} */ let doLighting = 0;
/** @type {Array<number>} */ let ambientColor = [0, 0, 0];

const shaders = {
    block: {
        /** @type {WebGLProgram} */ program: null,
        /** @type {GLint} */ a_Position: null,
        /** @type {GLint} */ a_Normal: null,
        /** @type {GLint} */ a_Uv: null,
        /** @type {GLint} */ a_Color: null,
        /** @type {WebGLUniformLocation} */ u_ModelMatrix: null,
        /** @type {WebGLUniformLocation} */ u_ViewMatrix: null,
        /** @type {WebGLUniformLocation} */ u_ProjectionMatrix: null,
        /** @type {WebGLUniformLocation} */ u_Atlas: null,
        /** @type {WebGLUniformLocation} */ u_ShowNormals: null,
        /** @type {WebGLUniformLocation} */ u_DoLighting: null,
        /** @type {WebGLUniformLocation} */ u_LightPosition: null,
        /** @type {WebGLUniformLocation} */ u_LightColor: null,
        /** @type {WebGLUniformLocation} */ u_LightIntensity: null,
        /** @type {WebGLUniformLocation} */ u_DiffuseAmount: null,
        /** @type {WebGLUniformLocation} */ u_SpecularAmount: null,
        /** @type {WebGLUniformLocation} */ u_SpecularExponent: null,
        /** @type {WebGLUniformLocation} */ u_AmbientColor: null,
        /** @type {WebGLUniformLocation} */ u_SpotLightPosition: null,
        /** @type {WebGLUniformLocation} */ u_SpotLightCone: null,
        /** @type {WebGLUniformLocation} */ u_SpotLightColor: null,
        /** @type {WebGLUniformLocation} */ u_SpotLightIntensity: null,
    },
    sky: {
        /** @type {WebGLProgram} */ program: null,
        /** @type {GLint} */ a_Position: null,
        /** @type {WebGLUniformLocation} */ u_ViewMatrix: null,
        /** @type {WebGLUniformLocation} */ u_ProjectionMatrix: null,
        /** @type {WebGLUniformLocation} */ u_Sky: null,
        /** @type {WebGLUniformLocation} */ u_ShowNormals: null,
        /** @type {WebGLUniformLocation} */ u_DoLighting: null,
        /** @type {WebGLUniformLocation} */ u_AmbientColor: null,
    },
    water: {
        /** @type {WebGLProgram} */ program: null,
        /** @type {GLint} */ a_Position: null,
        /** @type {WebGLUniformLocation} */ u_ModelMatrix: null,
        /** @type {WebGLUniformLocation} */ u_ViewMatrix: null,
        /** @type {WebGLUniformLocation} */ u_ProjectionMatrix: null,
        /** @type {WebGLUniformLocation} */ u_Sky: null,
        /** @type {WebGLUniformLocation} */ u_Time: null,
        /** @type {WebGLUniformLocation} */ u_ShowNormals: null,
        /** @type {WebGLUniformLocation} */ u_DoLighting: null,
        /** @type {WebGLUniformLocation} */ u_LightPosition: null,
        /** @type {WebGLUniformLocation} */ u_LightColor: null,
        /** @type {WebGLUniformLocation} */ u_LightIntensity: null,
        /** @type {WebGLUniformLocation} */ u_DiffuseAmount: null,
        /** @type {WebGLUniformLocation} */ u_SpecularAmount: null,
        /** @type {WebGLUniformLocation} */ u_SpecularExponent: null,
        /** @type {WebGLUniformLocation} */ u_AmbientColor: null,
        /** @type {WebGLUniformLocation} */ u_SpotLightPosition: null,
        /** @type {WebGLUniformLocation} */ u_SpotLightCone: null,
        /** @type {WebGLUniformLocation} */ u_SpotLightColor: null,
        /** @type {WebGLUniformLocation} */ u_SpotLightIntensity: null,
    },
    sphere: {
        /** @type {WebGLProgram} */ program: null,
        /** @type {GLint} */ a_Position: null,
        /** @type {GLint} */ a_Normal: null,
        /** @type {WebGLUniformLocation} */ u_NormalMatrix: null,
        /** @type {WebGLUniformLocation} */ u_ModelMatrix: null,
        /** @type {WebGLUniformLocation} */ u_ViewMatrix: null,
        /** @type {WebGLUniformLocation} */ u_ProjectionMatrix: null,
        /** @type {WebGLUniformLocation} */ u_SphereColor: null,
        /** @type {WebGLUniformLocation} */ u_ShowNormals: null,
        /** @type {WebGLUniformLocation} */ u_DoLighting: null,
        /** @type {WebGLUniformLocation} */ u_LightPosition: null,
        /** @type {WebGLUniformLocation} */ u_LightColor: null,
        /** @type {WebGLUniformLocation} */ u_LightIntensity: null,
        /** @type {WebGLUniformLocation} */ u_DiffuseAmount: null,
        /** @type {WebGLUniformLocation} */ u_SpecularAmount: null,
        /** @type {WebGLUniformLocation} */ u_SpecularExponent: null,
        /** @type {WebGLUniformLocation} */ u_AmbientColor: null,
        /** @type {WebGLUniformLocation} */ u_SpotLightPosition: null,
        /** @type {WebGLUniformLocation} */ u_SpotLightCone: null,
        /** @type {WebGLUniformLocation} */ u_SpotLightColor: null,
        /** @type {WebGLUniformLocation} */ u_SpotLightIntensity: null,
    },
    light: {
        /** @type {WebGLProgram} */ program: null,
        /** @type {GLint} */ a_Position: null,
        /** @type {WebGLUniformLocation} */ u_NormalMatrix: null,
        /** @type {WebGLUniformLocation} */ u_ModelMatrix: null,
        /** @type {WebGLUniformLocation} */ u_ViewMatrix: null,
        /** @type {WebGLUniformLocation} */ u_ProjectionMatrix: null,
        /** @type {WebGLUniformLocation} */ u_LightColor: null,
        /** @type {WebGLUniformLocation} */ u_Color: null,
    },
};

const input = {
    forward: false,
    back: false,
    left: false,
    right: false,
    up: false,
    down: false,
    grab: false
};

/// GENERAL GRAPHICS CODE ///

function renderScene() {
    // Clear screen
    gl.clearColor(0.2, 0.2, 0.2, 1);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    // Update camera
    camera.updateProjectionMatrix(canvas.width / canvas.height);
    camera.updateViewMatrix();

    // Set uniforms
    for (const shaderName in shaders) {
        const shader = shaders[shaderName];
        gl.useProgram(shader.program);
        if (shader.u_ProjectionMatrix != undefined) gl.uniformMatrix4fv(shader.u_ProjectionMatrix, false, camera.projectionMatrix.elements);
        if (shader.u_ViewMatrix != undefined) gl.uniformMatrix4fv(shader.u_ViewMatrix, false, camera.viewMatrix.elements);
        if (shader.u_ShowNormals != undefined) gl.uniform1i(shader.u_ShowNormals, showNormals ? 1 : 0);
        if (shader.u_DoLighting != undefined) gl.uniform1i(shader.u_DoLighting, doLighting ? 1 : 0);
        if (shader.u_SunDirection != undefined) gl.uniform3fv(shader.u_SunDirection, sunDirection.elements);
        if (shader.u_SunColor != undefined) gl.uniform3fv(shader.u_SunColor, sunColor);
        if (shader.u_LightPosition != undefined) gl.uniform3fv(shader.u_LightPosition, light.position.elements);
        if (shader.u_LightColor != undefined) gl.uniform3fv(shader.u_LightColor, light.color);
        if (shader.u_LightIntensity != undefined) gl.uniform1f(shader.u_LightIntensity, light.intensity);
        if (shader.u_DiffuseAmount != undefined) gl.uniform1f(shader.u_DiffuseAmount, diffuseAmount);
        if (shader.u_SpecularAmount != undefined) gl.uniform1f(shader.u_SpecularAmount, specularAmount);
        if (shader.u_SpecularExponent != undefined) gl.uniform1f(shader.u_SpecularExponent, specularExponent);
        if (shader.u_AmbientColor != undefined) gl.uniform3fv(shader.u_AmbientColor, ambientColor);
        if (shader.u_SpotLightPosition != undefined) gl.uniform3fv(shader.u_SpotLightPosition, spotLight.position.elements);
        if (shader.u_SpotLightCone != undefined) gl.uniform3fv(shader.u_SpotLightCone, spotLight.spotCone.elements);
        if (shader.u_SpotLightColor != undefined) gl.uniform3fv(shader.u_SpotLightColor, spotLight.color);
        if (shader.u_SpotLightIntensity != undefined) gl.uniform1f(shader.u_SpotLightIntensity, spotLight.intensity);
    }

    skybox.render();

    // Draw blocks
    for (const chunk of chunks)
        chunk.render();

    water.render();
    sphere.render();
    light.render();
    spotLight.render();
}


/// SETUP CODE ///

function loadImage(url) {
    return new Promise(resolve => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.src = url.toString();
    });
}

async function loadTextures() {
    atlasTexture = gl.createTexture();
    skyTexture = gl.createTexture();

    let atlasImage = loadImage(atlasUrl);
    let skyImages = [
        loadImage(skyUrl + "px.jpg"),
        loadImage(skyUrl + "nx.jpg"),
        loadImage(skyUrl + "py.jpg"),
        loadImage(skyUrl + "ny.jpg"),
        loadImage(skyUrl + "pz.jpg"),
        loadImage(skyUrl + "nz.jpg")
    ];

    // Wait for everything to load
    atlasImage = await atlasImage;
    for (let i = 0; i < 6; i++)
        skyImages[i] = await skyImages[i];

    // Atlas
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, atlasTexture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST_MIPMAP_LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texImage2D(
        gl.TEXTURE_2D,
        0,
        gl.RGBA,
        gl.RGBA,
        gl.UNSIGNED_BYTE,
        atlasImage
    );
    gl.generateMipmap(gl.TEXTURE_2D);

    // Cubemap
    const targets = [
        gl.TEXTURE_CUBE_MAP_POSITIVE_X,
        gl.TEXTURE_CUBE_MAP_NEGATIVE_X,
        gl.TEXTURE_CUBE_MAP_POSITIVE_Y,
        gl.TEXTURE_CUBE_MAP_NEGATIVE_Y,
        gl.TEXTURE_CUBE_MAP_POSITIVE_Z,
        gl.TEXTURE_CUBE_MAP_NEGATIVE_Z,
    ];
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_CUBE_MAP, skyTexture);
    for (let i = 0; i < 6; i++) {
        gl.texImage2D(
            targets[i],
            0,
            gl.RGBA,
            gl.RGBA,
            gl.UNSIGNED_BYTE,
            skyImages[i]
        );
    }
    gl.generateMipmap(gl.TEXTURE_CUBE_MAP);
    gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
}

function setupGL() {
    // Load shaders
    shaders.block.program = createProgram(gl, VS_BLOCK, FS_BLOCK);
    shaders.sky.program = createProgram(gl, VS_SKY, FS_SKY);
    shaders.water.program = createProgram(gl, VS_WATER, FS_WATER);
    shaders.sphere.program = createProgram(gl, VS_SPHERE, FS_SPHERE);
    shaders.light.program = createProgram(gl, VS_LIGHT, FS_LIGHT);

    // Get variable locations
    for (const shaderName of Object.getOwnPropertyNames(shaders)) {
        const shader = shaders[shaderName];
        for (const paramName of Object.getOwnPropertyNames(shader)) {
            if (paramName.startsWith("a_")) shader[paramName] = gl.getAttribLocation(shader.program, paramName);
            else if (paramName.startsWith("u_")) shader[paramName] = gl.getUniformLocation(shader.program, paramName);
        }
    }

    // Prepare for rendering
    gl.enable(gl.DEPTH_TEST);
    gl.enable(gl.CULL_FACE);

    player = new Player();
    skybox = new Skybox();
    water = new Water();
    sphere = new Sphere();
    light = new Light(false);
    light.position.elements[0] = 3;
    light.position.elements[1] = 3;
    light.position.elements[2] = 3;
    spotLight = new Light(true);
    spotLight.position.elements[0] = -2;
    spotLight.position.elements[1] = 8;
    spotLight.position.elements[2] = -2;
    spotLight.spotDir.set(sphere.position).sub(spotLight.position).normalize();

    loadTextures();
}

function resize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    gl.viewport(0, 0, canvas.width, canvas.height);
    camera.updateProjectionMatrix(canvas.width / canvas.height);
}

function turnCamera(degreesLeft, degreesUp) {
    camera.yaw += degreesLeft;
    camera.pitch = Math.max(-90, Math.min(camera.pitch + degreesUp, 90));
}

function toggleKey(code, pressed) {
    switch (code) {
        case "KeyW": input.forward = pressed; break;
        case "KeyS": input.back = pressed; break;
        case "KeyA": input.left = pressed; break;
        case "KeyD": input.right = pressed; break;
        case "Space": input.up = pressed; break;
        case "ShiftLeft": input.down = pressed; break;
    }
    
    if (pressed) {
        switch (code) {
            case "Space":
                if (lastSpaceTime + 0.25 > performance.now() / 1000)
                    player.flying = !player.flying;
                if (!player.flying && player.canJump)
                    player.jump();
                lastSpaceTime = performance.now() / 1000;
                break;
        }
    }
}

function stopAllKeys() {
    for (const key of Object.getOwnPropertyNames(input)) {
        input[key] = false;
    }
}

/**
 * @param {Blob} blob 
 */
async function load(blob) {
    let buffer;
    const magicBytes = new Uint8Array(await blob.slice(0, 2).arrayBuffer());
    if (magicBytes[0] === 0x1f && magicBytes[1] == 0x8B) {
        const reader = blob.stream().pipeThrough(new DecompressionStream("gzip")).getReader();
        const decompressedData = [];

        let res;
        while (!(res = await reader.read()).done) {
            decompressedData.push(res.value);
        }
        buffer = await new Blob(decompressedData).arrayBuffer();
    } else {
        buffer = await blob.arrayBuffer();
    }

    for (const chunk of chunks)
        chunk.delete();
    chunks = [];
    let i = 0;
    while (i < buffer.byteLength) {
        const chunk = new VoxelChunk();
        i += chunk.deserialize(buffer.slice(i));
        chunks.push(chunk);
    }

    return i;
}

function updateEntities(dt) {
    // Update player
    player.update(dt);
    camera.position.set(player.position);
    camera.position.elements[1] += player.size[1] / 2 - 0.25 - 0.25 * player.crouch;
    light.update(dt);
    spotLight.update(dt);
}

let lastTime = performance.now();
function mainLoop() {
    const dt = Math.min(0.1, (performance.now() - lastTime) / 1000);
    lastTime = performance.now();

    updateEntities(dt);
    renderScene();

    requestAnimationFrame(mainLoop);
}

async function loadFirstLevel() {
    const blob = await (await fetch("levels/default.voxel")).blob();
    await load(blob);

    player.flying = true;
    player.position.elements[0] = 0.5;
    player.position.elements[1] = 29;
    player.position.elements[2] = 7.5;
    player.moveAndCollide(0, -30, 0);
}

function bindInput(id, setter) {
    const elem = document.getElementById(id);
    const checkbox = elem.type === "checkbox";
    elem.addEventListener("input", event => {
        setter(checkbox ? event.target.checked : event.target.value);
    });
    setter(checkbox ? elem.checked : elem.value);
}

function main() {
    canvas = document.getElementById("webgl");
    gl = canvas.getContext("webgl");
    setupGL();

    // Bind HTML inputs
    bindInput("show-normals", x => showNormals = x);
    bindInput("lighting", x => doLighting = x);
    bindInput("animate-light", x => light.animate = x);
    bindInput("diffuse", x => diffuseAmount = x);
    bindInput("specular", x => specularAmount = x);
    bindInput("intensity", x => light.intensity = 1 / Math.pow(1.001 - x, 2) - 1);
    bindInput("specular-size", x => specularExponent = 1 / (x * x));
    bindInput("spot-size", x => spotLight.spotSize = x);
    bindInput("spot-intensity", x => spotLight.intensity = 1 / Math.pow(1.001 - x, 2) - 1);
    for (let i = 0; i < 3; i++) {
        bindInput("color-" + i, x => light.color[i] = x);
        bindInput("spot-color-" + i, x => spotLight.color[i] = x);
        bindInput("ambient-color-" + i, x => ambientColor[i] = x);
        bindInput("sphere-color-" + i, x => sphere.color[i] = x);
    }

    // Rotate camera on mouse input
    canvas.addEventListener("mousemove", function (event) {
        if (document.pointerLockElement === canvas) {
            const scale = 180 / 1080;
            turnCamera(-event.movementX * scale, -event.movementY * scale);
        }
    });

    canvas.addEventListener("click", function (event) {
        if (!document.pointerLockElement)
            canvas.requestPointerLock({ unadjustedMovement: true });
    });

    canvas.addEventListener("mousedown", function (event) {
        const p = camera.position.elements;
        const d = camera.forward.elements;
        let l = light.position.elements;
        const s = 0.3;
        if (isFinite(rayCastAABB(
            p[0], p[1], p[2],
            d[0], d[1], d[2],
            l[0] - s, l[1] - s, l[2] - s,
            l[0] + s, l[1] + s, l[2] + s,
        ))) {
            light.grab();
            return;
        }

        l = spotLight.position.elements;
        if (isFinite(rayCastAABB(
            p[0], p[1], p[2],
            d[0], d[1], d[2],
            l[0] - s, l[1] - s, l[2] - s,
            l[0] + s, l[1] + s, l[2] + s,
        ))) {
            spotLight.grab();
            return;
        }
    });

    canvas.addEventListener("mouseup", function (event) {
        light.release();
        spotLight.release();
    });

    // Disable context menu so right click works
    canvas.addEventListener("contextmenu", function (event) {
        event.preventDefault();
        return false;
    });

    canvas.addEventListener("lostpointercapture", stopAllKeys);

    // Listen for key presses
    document.addEventListener("keydown", function (event) {
        if (event.repeat) return;

        if (document.pointerLockElement === canvas)
            toggleKey(event.code, true)
    });
    document.addEventListener("keyup", function (event) {
        toggleKey(event.code, false);
    });

    // Resize canvas to fit the screen
    window.addEventListener("resize", resize);
    resize();

    loadFirstLevel().then(function() {
        requestAnimationFrame(mainLoop);
    });
}
