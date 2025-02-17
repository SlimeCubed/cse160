// Used https://webglfundamentals.org/ for some information about cubemaps

/// GENERAL VARIABLES ///

/** @type {HTMLCanvasElement} */ let canvas = null;
/** @type {HTMLDivElement} */ let popup = null;
/** @type {HTMLInputElement} */ let loadInput = null;
/** @type {HTMLInputElement} */ let saveInput = null;
/** @type {HTMLInputElement} */ let creativeCheckbox = null;
/** @type {WebGLRenderingContext} */ let gl = null;
/** @type {Camera} */ let camera = new Camera();
/** @type {Player} */ let player = null;
/** @type {WebGLTexture} */ let atlasTexture = null;
/** @type {WebGLTexture} */ let enemyTexture = null;
/** @type {WebGLTexture} */ let enemyGlowTexture = null;
/** @type {WebGLTexture} */ let playerTexture = null;
/** @type {WebGLTexture} */ let skyTexture = null;
/** @type {WebGLTexture} */ let blackTexture = null;
/** @type {URL} */ const atlasUrl = new URL("../img/atlas.png", location.href);
/** @type {URL} */ const enemyUrl = new URL("../img/enemy.png", location.href);
/** @type {URL} */ const enemyGlowUrl = new URL("../img/enemyglow.png", location.href);
/** @type {URL} */ const playerUrl = new URL("../img/player.png", location.href);
/** @type {URL} */ const skyUrl = new URL("../img/", location.href);
/** @type {Skybox} */ let skybox = null;
/** @type {Water} */ let water = null;
/** @type {Cursor} */ let cursor = null;
/** @type {Matrix4} */ let uiMatrix = new Matrix4();
/** @type {number} */ let currentBlock = VoxelChunk.blocks.bricks;
/** @type {Array<VoxelChunk>} */ let chunks = [];
/** @type {number} */ let lastSpeedPlaceTime = performance.now() / 1000;
/** @type {number} */ let lastSpaceTime = 0;
/** @type {number} */ let screenShake = 0;
/** @type {number} */ let gravity = 15;
/** @type {VoxelChunk} */ let blockPreview = null;
/** @type {boolean} */ let creative = false;
/** @type {Pathfinder} */ let toPlayer = new Pathfinder(15);
/** @type {PathMap} */ let pathMap = null;
/** @type {Director} */ let director = null;
/** @type {Array<Enemy>} */ let enemies = [];
/** @type {Array<Effect>} */ let effects = [];
/** @type {AudioManager} */ let audio = null;

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
        /** @type {WebGLUniformLocation} */ u_Glow: null,
        /** @type {WebGLUniformLocation} */ u_LightDirection: null,
        /** @type {WebGLUniformLocation} */ u_Overlay: null,
    },
    sky: {
        /** @type {WebGLProgram} */ program: null,
        /** @type {GLint} */ a_Position: null,
        /** @type {WebGLUniformLocation} */ u_ViewMatrix: null,
        /** @type {WebGLUniformLocation} */ u_ProjectionMatrix: null,
        /** @type {WebGLUniformLocation} */ u_Sky: null,
    },
    water: {
        /** @type {WebGLProgram} */ program: null,
        /** @type {GLint} */ a_Position: null,
        /** @type {WebGLUniformLocation} */ u_ModelMatrix: null,
        /** @type {WebGLUniformLocation} */ u_ViewMatrix: null,
        /** @type {WebGLUniformLocation} */ u_ProjectionMatrix: null,
        /** @type {WebGLUniformLocation} */ u_Sky: null,
        /** @type {WebGLUniformLocation} */ u_Time: null,
    },
    sprite: {
        /** @type {WebGLProgram} */ program: null,
        /** @type {GLint} */ a_Position: null,
        /** @type {WebGLUniformLocation} */ u_UiMatrix: null,
        /** @type {WebGLUniformLocation} */ u_ModelMatrix: null,
        /** @type {WebGLUniformLocation} */ u_Color: null,
    },
    solid: {
        /** @type {WebGLProgram} */ program: null,
        /** @type {GLint} */ a_Position: null,
        /** @type {WebGLUniformLocation} */ u_ModelMatrix: null,
        /** @type {WebGLUniformLocation} */ u_ViewMatrix: null,
        /** @type {WebGLUniformLocation} */ u_ProjectionMatrix: null,
        /** @type {WebGLUniformLocation} */ u_Color: null,
    }
};

const input = {
    forward: false,
    back: false,
    left: false,
    right: false,
    up: false,
    down: false,
    speedPlace: false,
    spherePlace: false,
    placeBlock: false,
    breakBlock: false,
    chunksWiggle: false,
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
        if (shader.u_LightDirection != undefined) gl.uniform3f(shader.u_LightDirection, 0.9095, 0.0894, -0.4058);
        if (shader.u_UiMatrix) gl.uniformMatrix4fv(shader.u_UiMatrix, false, uiMatrix.elements);
    }

    // Draw skybox
    skybox.render();

    // Draw blocks
    for (const chunk of chunks)
        chunk.render();

    // Draw enemies
    for (const enemy of enemies)
        enemy.render();

    // And player items
    player.render();

    // And effects
    for (const effect of effects)
        effect.render();

    // Draw water
    water.render();

    // Draw preview block
    if (creative) {
        const tempMat = getMat4();
        const tempVec = getVec3();

        gl.clear(gl.DEPTH_BUFFER_BIT);
        gl.useProgram(shaders.block.program);
        tempVec.elements[0] = 1;
        tempVec.elements[1] = 1;
        tempVec.elements[2] = 1;
        tempVec.normalize();
        gl.uniform3fv(shaders.block.u_LightDirection, tempVec.elements);
        gl.uniformMatrix4fv(shaders.block.u_ProjectionMatrix, false, uiMatrix.elements);

        const zoom = input.spherePlace ? 0.5 : 1;
        tempMat.setScale(zoom, zoom, 1/500);
        gl.uniformMatrix4fv(shaders.block.u_ViewMatrix, false, tempMat.elements);
        tempMat.setTranslate(100 / zoom, 100 / zoom, 0)
            .scale(80, 80, 80)
            .rotate(performance.now() / 1000 * 90 * (1 + 3 * input.speedPlace), 0.3, 1, 0)
            .translate(-0.5, -0.5, -0.5);
        blockPreview.setModelMatrix(tempMat);
        blockPreview.render();

        freeMat4(tempMat);
        freeVec3(tempVec);
    }

    // Draw UI
    gl.useProgram(shaders.sprite.program);
    cursor.render();
    player.hurtOverlay.render();
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
    enemyTexture = gl.createTexture();
    enemyGlowTexture = gl.createTexture();
    playerTexture = gl.createTexture();
    skyTexture = gl.createTexture();
    blackTexture = gl.createTexture();

    let atlasImage = loadImage(atlasUrl);
    let skyImages = [
        loadImage(skyUrl + "px.jpg"),
        loadImage(skyUrl + "nx.jpg"),
        loadImage(skyUrl + "py.jpg"),
        loadImage(skyUrl + "ny.jpg"),
        loadImage(skyUrl + "pz.jpg"),
        loadImage(skyUrl + "nz.jpg")
    ];
    let enemyImage = loadImage(enemyUrl);
    let enemyGlowImage = loadImage(enemyGlowUrl);
    let playerImage = loadImage(playerUrl);

    // Wait for everything to load
    atlasImage = await atlasImage;
    enemyImage = await enemyImage;
    enemyGlowImage = await enemyGlowImage;
    playerImage = await playerImage;
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

    // Enemy
    gl.activeTexture(gl.TEXTURE2);
    gl.bindTexture(gl.TEXTURE_2D, enemyTexture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST_MIPMAP_LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texImage2D(
        gl.TEXTURE_2D,
        0,
        gl.RGBA,
        gl.RGBA,
        gl.UNSIGNED_BYTE,
        enemyImage
    );
    gl.generateMipmap(gl.TEXTURE_2D);

    // Enemy glow
    gl.activeTexture(gl.TEXTURE3);
    gl.bindTexture(gl.TEXTURE_2D, enemyGlowTexture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST_MIPMAP_LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texImage2D(
        gl.TEXTURE_2D,
        0,
        gl.RGBA,
        gl.RGBA,
        gl.UNSIGNED_BYTE,
        enemyGlowImage
    );
    gl.generateMipmap(gl.TEXTURE_2D);

    // Black
    gl.activeTexture(gl.TEXTURE4);
    gl.bindTexture(gl.TEXTURE_2D, blackTexture);
    gl.texImage2D(
        gl.TEXTURE_2D,
        0,
        gl.RGBA,
        1, 1, 0,
        gl.RGBA,
        gl.UNSIGNED_BYTE,
        new Uint8Array([0, 0, 0, 0])
    );

    // Player
    gl.activeTexture(gl.TEXTURE5);
    gl.bindTexture(gl.TEXTURE_2D, playerTexture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST_MIPMAP_LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texImage2D(
        gl.TEXTURE_2D,
        0,
        gl.RGBA,
        gl.RGBA,
        gl.UNSIGNED_BYTE,
        playerImage
    );
    gl.generateMipmap(gl.TEXTURE_2D);
}

function setupGL() {
    // Load shaders
    shaders.block.program = createProgram(gl, VS_BLOCK, FS_BLOCK);
    shaders.sky.program = createProgram(gl, VS_SKY, FS_SKY);
    shaders.water.program = createProgram(gl, VS_WATER, FS_WATER);
    shaders.sprite.program = createProgram(gl, VS_SPRITE, FS_SPRITE);
    shaders.solid.program = createProgram(gl, VS_SOLID, FS_SOLID);

    // Get variable locations
    shaders.block.a_Position = gl.getAttribLocation(shaders.block.program, "a_Position");
    shaders.block.a_Normal = gl.getAttribLocation(shaders.block.program, "a_Normal");
    shaders.block.a_Uv = gl.getAttribLocation(shaders.block.program, "a_Uv");
    shaders.block.a_Color = gl.getAttribLocation(shaders.block.program, "a_Color");
    shaders.block.u_ModelMatrix = gl.getUniformLocation(shaders.block.program, "u_ModelMatrix");
    shaders.block.u_ViewMatrix = gl.getUniformLocation(shaders.block.program, "u_ViewMatrix");
    shaders.block.u_ProjectionMatrix = gl.getUniformLocation(shaders.block.program, "u_ProjectionMatrix");
    shaders.block.u_Atlas = gl.getUniformLocation(shaders.block.program, "u_Atlas");
    shaders.block.u_Glow = gl.getUniformLocation(shaders.block.program, "u_Glow");
    shaders.block.u_LightDirection = gl.getUniformLocation(shaders.block.program, "u_LightDirection");
    shaders.block.u_Overlay = gl.getUniformLocation(shaders.block.program, "u_Overlay");
    
    shaders.sky.a_Position = gl.getAttribLocation(shaders.sky.program, "a_Position");
    shaders.sky.u_ViewMatrix = gl.getUniformLocation(shaders.sky.program, "u_ViewMatrix");
    shaders.sky.u_ProjectionMatrix = gl.getUniformLocation(shaders.sky.program, "u_ProjectionMatrix");
    shaders.sky.u_Sky = gl.getUniformLocation(shaders.sky.program, "u_Sky");
    
    shaders.water.a_Position = gl.getAttribLocation(shaders.water.program, "a_Position");
    shaders.water.u_ModelMatrix = gl.getUniformLocation(shaders.water.program, "u_ModelMatrix");
    shaders.water.u_ViewMatrix = gl.getUniformLocation(shaders.water.program, "u_ViewMatrix");
    shaders.water.u_ProjectionMatrix = gl.getUniformLocation(shaders.water.program, "u_ProjectionMatrix");
    shaders.water.u_Sky = gl.getUniformLocation(shaders.water.program, "u_Sky");
    shaders.water.u_Time = gl.getUniformLocation(shaders.water.program, "u_Time");

    shaders.sprite.a_Position = gl.getAttribLocation(shaders.sprite.program, "a_Position");
    shaders.sprite.u_ModelMatrix = gl.getUniformLocation(shaders.sprite.program, "u_ModelMatrix");
    shaders.sprite.u_UiMatrix = gl.getUniformLocation(shaders.sprite.program, "u_UiMatrix");
    shaders.sprite.u_Color = gl.getUniformLocation(shaders.sprite.program, "u_Color");

    shaders.solid.a_Position = gl.getAttribLocation(shaders.solid.program, "a_Position");
    shaders.solid.u_ModelMatrix = gl.getUniformLocation(shaders.solid.program, "u_ModelMatrix");
    shaders.solid.u_ViewMatrix = gl.getUniformLocation(shaders.solid.program, "u_ViewMatrix");
    shaders.solid.u_ProjectionMatrix = gl.getUniformLocation(shaders.solid.program, "u_ProjectionMatrix");
    shaders.solid.u_Color = gl.getUniformLocation(shaders.solid.program, "u_Color");

    // Prepare for rendering
    gl.enable(gl.DEPTH_TEST);
    gl.enable(gl.CULL_FACE);

    player = new Player();
    skybox = new Skybox();
    water = new Water();
    blockPreview = new VoxelChunk();
    updatePreview();
    cursor = new Cursor();
    cursor.r = 0.5;
    cursor.g = 0.5;
    cursor.b = 0.5;
    cursor.a = 0.75;

    loadTextures();
}

function resize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    gl.viewport(0, 0, canvas.width, canvas.height);
    camera.updateProjectionMatrix(canvas.width / canvas.height);

    uiMatrix.setOrtho(0, canvas.width, 0, canvas.height, -1, 1);
    cursor.x = canvas.width / 2;
    cursor.y = canvas.height / 2;
}

function turnCamera(degreesLeft, degreesUp) {
    camera.yaw += degreesLeft;
    camera.pitch = Math.max(-90, Math.min(camera.pitch + degreesUp, 90));
}

function updatePreview() {
    blockPreview.setBlock(0, 0, 0, currentBlock);
    const exterior = input.spherePlace ? currentBlock : 0;
    blockPreview.setBlock(1, 0, 0, exterior);
    blockPreview.setBlock(-1, 0, 0, exterior);
    blockPreview.setBlock(0, 1, 0, exterior);
    blockPreview.setBlock(0, -1, 0, exterior);
    blockPreview.setBlock(0, 0, 1, exterior);
    blockPreview.setBlock(0, 0, -1, exterior);
}

function toggleKey(code, pressed) {
    switch (code) {
        case "KeyW": input.forward = pressed; break;
        case "KeyS": input.back = pressed; break;
        case "KeyA": input.left = pressed; break;
        case "KeyD": input.right = pressed; break;
        case "Space": input.up = pressed; break;
        case "ShiftLeft": input.down = pressed; break;
        case "Equal": input.chunksWiggle = pressed; break;
    }

    if (pressed) {
        const lastBlock = currentBlock;
        switch (code) {
            case "Digit1": currentBlock = VoxelChunk.blocks.bricks; break;
            case "Digit2": currentBlock = VoxelChunk.blocks.dirt; break;
            case "Digit3": currentBlock = VoxelChunk.blocks.grass; break;
            case "Digit4": currentBlock = VoxelChunk.blocks.tiles; break;
            case "Digit5": currentBlock = VoxelChunk.blocks.woodBeam; break;
            case "Digit6": currentBlock = VoxelChunk.blocks.paintedWood; break;
            case "Digit7": currentBlock = VoxelChunk.blocks.rock; break;
            case "Digit8": currentBlock = VoxelChunk.blocks.sand; break;
            case "Digit9": currentBlock = VoxelChunk.blocks.gravel; break;
            case "Space":
                if (lastSpaceTime + 0.25 > performance.now() / 1000 && creative)
                    player.flying = !player.flying;
                if (!player.flying && player.canJump)
                    player.jump();
                lastSpaceTime = performance.now() / 1000;
                break;
            case "KeyV": input.speedPlace = !input.speedPlace; break;
            case "KeyB":
                input.spherePlace = !input.spherePlace;
                updatePreview();
                break;
            case "Minus":
                const newChunk = new VoxelChunk();
                newChunk.setBlock(
                    Math.floor(player.position.elements[0]),
                    Math.max(Math.floor(player.position.elements[1]), -5),
                    Math.floor(player.position.elements[2]),
                    currentBlock
                );
                chunks.push(newChunk);
                break;
            case "Backspace":
                camera.updateViewMatrix();
                const hit = castAllChunks(camera.position, camera.forward);
                if (hit) {
                    const p = new Vector3([
                        hit.hitX + hit.normalX,
                        hit.hitY + hit.normalY,
                        hit.hitZ + hit.normalZ
                    ]);

                    enemies.push(new Flier(p));
                }
                break;
        }

        if (currentBlock !== lastBlock)
            updatePreview();
    }
}

function stopAllKeys() {
    for (const key of Object.getOwnPropertyNames(input)) {
        input[key] = false;
    }
}

async function save() {
    // for (let i = 0; i < chunks.length; i++)
    //     chunks[i].save(saveInput.value + "_" + i + ".voxel");

    const data = [];
    for (let i = 0; i < chunks.length; i++) {
        data[i] = chunks[i].serialize();
    }

    const reader = new Blob(data).stream().pipeThrough(new CompressionStream("gzip")).getReader();
    const compressedData = [];

    let res;
    while (!(res = await reader.read()).done) {
        compressedData.push(res.value);
    }

    return new Blob(compressedData);
}

async function saveToFile(name) {
    if (!name)
        name = saveInput.value + ".voxel";

    const blob = await save();
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.href = url;
    link.download = name;
    link.click();
}

/**
 * @param {Blob} blob 
 */
async function load(blob) {
    // chunks = [ new VoxelChunk() ];
    // chunks[0].load(file.stream());

    let buffer;
    const magicBytes = await blob.slice(0, 2).bytes();
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

function snapToNearbyTraversable(p) {
    if (Pathfinder.isTraversable(p.elements[0], p.elements[1], p.elements[2]))
        return true;

    for (let oz = -1; oz <= 1; oz++) {
        for (let ox = -1; ox <= 1; ox++) {
            if (Pathfinder.isTraversable(p.elements[0] + ox, p.elements[1], p.elements[2] + oz)) {
                p.elements[0] += ox;
                p.elements[2] += oz;
                return true;
            }
        }
    }

    return false;
}

function applyScreenShake(amount) {
    screenShake = Math.max(screenShake, amount);
}

function updateEntities(dt) {
    // Despawn entities in creative mode
    if (creative) {
        if (enemies.length > 0)
            enemies = [];
        if (director) {
            director.delete();
            director = null;
        }
        if (pathMap)
            pathMap = null
    } else {
        if (!director || !pathMap) {
            setupLevel();
        }
    }

    // Update player
    player.update(dt);
    camera.position.set(player.position);
    camera.position.elements[1] += player.size[1] / 2 - 0.25 - 0.25 * player.crouch;
    camera.roll = 0;
    if (screenShake > 0) {
        for (let i = 0; i < 3; i++)
            camera.position.elements[i] += (Math.random() * 2 - 1) * screenShake * 0.1;
        camera.roll = (Math.random() * 2 - 1) * screenShake * 1.5;
    }
    screenShake = Math.max(screenShake - dt, 0);

    // Find a good place for enemies to pathfind to
    const p = new Vector3(player.position.elements);
    p.elements[1] -= player.size[1] / 2 - 0.1;
    if (!snapToNearbyTraversable(p)) {
        p.elements[1] = snapToGround(p, player.size[0], player.size[2], -1) + 0.5;
        snapToNearbyTraversable(p);
    }

    // Update pathfinding
    toPlayer.setDestination(p.elements[0], p.elements[1], p.elements[2]);

    // Update enemies
    let anyEnemiesDespawned = false;
    for (let i = enemies.length - 1; i >= 0; i--) {
        enemies[i].update(dt);
        if (enemies[i].shouldDespawn()) {
            enemies[i].delete();
            anyEnemiesDespawned = true;
        }
    }

    // Update effects
    let anyEffectsDespawned = false;
    for (const effect of effects) {
        effect.update(dt);
        if (effect.shouldDespawn()) {
            effect.delete();
            anyEffectsDespawned = true;
        }
    }

    // Speedplace blocks
    if (input.speedPlace && performance.now() / 1000 > lastSpeedPlaceTime + 0.1 && creative) {
        if (input.placeBlock) {
            placeBlock();
        } else if (input.breakBlock) {
            breakBlock();
        }
    }

    audio.update();

    // Remove dead entities
    if (anyEnemiesDespawned)
        enemies = enemies.filter(enemy => !enemy.shouldDespawn());
    if (anyEffectsDespawned)
        effects = effects.filter(effect => !effect.shouldDespawn())
}

let lastTime = performance.now();
function mainLoop() {
    const dt = Math.min(0.1, (performance.now() - lastTime) / 1000);
    lastTime = performance.now();

    updateEntities(dt);
    renderScene();
    
    // Update HTML elements
    if (popup.style.bottom === "" && document.pointerLockElement === canvas)
        popup.style.bottom = -popup.clientHeight + "px";
    else if (popup.style.bottom !== "" && document.pointerLockElement !== canvas)
        popup.style.bottom = "";

    requestAnimationFrame(mainLoop);
}

function breakBlock() {
    camera.updateViewMatrix();
    const hit = castAllChunks(camera.position, camera.forward);

    if (hit) {
        lastSpeedPlaceTime = performance.now() / 1000;
        updateBlocks(
            hit.chunk,
            hit.voxelX,
            hit.voxelY,
            hit.voxelZ,
            input.spherePlace ? 2.5 : 0,
            0
        );
    }
}

function placeBlock() {
    camera.updateViewMatrix();
    const hit = castAllChunks(camera.position, camera.forward);
    
    if (hit) {
        lastSpeedPlaceTime = performance.now() / 1000;
        updateBlocks(
            hit.chunk,
            hit.voxelX + hit.normalX,
            hit.voxelY + hit.normalY,
            hit.voxelZ + hit.normalZ,
            input.spherePlace ? 2.5 : 0,
            currentBlock
        );
    }
}

function updateBlocks(chunk, x, y, z, radius, id) {
    const ri = Math.max(Math.ceil(radius - 1), 0);
    for (let ox = -ri; ox <= ri; ox++) {
        for (let oy = -ri; oy <= ri; oy++) {
            for (let oz = -ri; oz <= ri; oz++) {
                if (Math.sqrt(ox * ox + oy * oy + oz * oz) <= radius
                    && (!id || !chunk.getBlock(x + ox, y + oy, z + oz))) {
                    chunk.setBlock(x + ox, y + oy, z + oz, id);
                }
            }
        }
    }

    if (id === 0 && chunk.isEmpty()) {
        chunk.delete();
        chunks.splice(chunks.indexOf(chunk), 1);
    }
}

function clearLevel() {
    chunks = [];

    const chunk = new VoxelChunk();
    chunks.push(chunk);

    for (let x = -3; x <= 3; x++) {
        for (let z = -3; z <= 3; z++) {
            chunk.setBlock(x, -1, z, VoxelChunk.blocks.bricks);
        }
    }
}

function setupLevel() {
    const [min, max] = getWorldMinMax();

    const centerX = Math.floor((max[0] + min[0]) / 2);
    const centerZ = Math.floor((max[2] + min[2]) / 2);
    const radius = Math.floor(Math.max(max[0] - min[0], max[1] - min[1], max[2] - min[2]) / 2);

    const y = Math.round(snapToGround(new Vector3(centerX, 100, centerZ), 0.25, 0.25, -1));
    pathMap = new PathMap(centerX, y, centerZ, radius);
    director = new Director(min[0], min[1], min[2], max[0], max[1], max[2]);
    enemies = [director];
}

async function loadFirstLevel() {
    const blob = await (await fetch("levels/default.voxel")).blob();
    await load(blob);
    requestAnimationFrame(mainLoop);

    player.flying = false;
    player.position.elements[0] = 0;
    player.position.elements[1] = 29;
    player.position.elements[2] = 0;
    player.moveAndCollide(0, -30, 0);
}

function main() {
    canvas = document.getElementById("webgl");
    popup = document.getElementById("popup");
    loadInput = document.getElementById("loadInput");
    saveInput = document.getElementById("saveInput");
    creativeCheckbox = document.getElementById("creative");
    gl = canvas.getContext("webgl");
    setupGL();

    // Load voxel files
    loadInput.addEventListener("input", function () {
        if (loadInput.files !== null && loadInput.files.length > 0) {
            load(loadInput.files.item(0));
        }
    });

    // Toggle creative mode
    creativeCheckbox.addEventListener("input", function() {
        creative = creativeCheckbox.checked;
    });

    // Rotate camera on mouse input
    canvas.addEventListener("mousemove", function (event) {
        if (document.pointerLockElement === canvas) {
            const scale = 180 / canvas.height;
            turnCamera(-event.movementX * scale, -event.movementY * scale);
        }
    });

    // Listen for mouse clicks
    canvas.addEventListener("pointerdown", function (event) {
        // Audio context can only be opened on user interaction
        audio.start();

        if (document.pointerLockElement) {
            if (event.button === 0) {
                if (creative) breakBlock();
                input.breakBlock = true;
            } else if (event.button === 2) {
                if (creative) placeBlock();
                input.placeBlock = true;
            }
        }
    });

    canvas.addEventListener("pointerup", function (event) {
        if (event.button === 0) {
            input.breakBlock = false;
        } else if (event.button === 2) {
            input.placeBlock = false;
        }
    });

    canvas.addEventListener("click", function (event) {
        if (!document.pointerLockElement)
            canvas.requestPointerLock({ unadjustedMovement: true });
    });

    // Disable context menu so right click works
    canvas.addEventListener("contextmenu", function (event) {
        event.preventDefault();
        return false;
    });

    canvas.addEventListener("lostpointercapture", stopAllKeys());

    // Listen for key presses
    document.addEventListener("keydown", function (event) {
        if (event.repeat) return;

        if (document.pointerLockElement === canvas)
            toggleKey(event.code, true)
    });
    document.addEventListener("keyup", function (event) {
        toggleKey(event.code, false);
    });

    // Set up audio
    audio = new AudioManager();

    // Resize canvas to fit the screen
    window.addEventListener("resize", resize);
    resize();

    loadFirstLevel();
}
