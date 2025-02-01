// Vertex shader program
const VSHADER_SOURCE = `
attribute vec3 a_Position;
attribute vec3 a_Normal;
uniform mat4 u_WorldToScreen;
uniform mat4 u_ModelToWorld;
varying vec3 worldNormal;

void main() {
    gl_Position = u_WorldToScreen * u_ModelToWorld * vec4(a_Position, 1);
    worldNormal = mat3(u_ModelToWorld) * a_Normal;
}
`;

// Fragment shader program
const FSHADER_SOURCE = `
uniform lowp vec4 u_Color;
uniform lowp float u_Unlit;
varying mediump vec3 worldNormal;

void main() {
    mediump float light = dot(normalize(worldNormal), normalize(vec3(-0.3, 1, 0.2)));
    light = light * 0.3 + 0.7;
    gl_FragColor = u_Color;
    if (u_Unlit < 0.5)
        gl_FragColor.rgb *= light;
}
`;

/// GENERAL VARIABLES ///

/** @type {HTMLCanvasElement} */ let canvas = null;
/** @type {HTMLInputElement} */ let angleSliderA = null;
/** @type {HTMLInputElement} */ let angleSliderB = null;
/** @type {HTMLSpanElement} */ let fpsCounter = null;
/** @type {WebGLRenderingContext} */ let gl = null;
/** @type {GLint} */ let a_Position = null;
/** @type {GLint} */ let a_Normal = null;
/** @type {WebGLUniformLocation} */ let u_ModelToWorld = null;
/** @type {WebGLUniformLocation} */ let u_WorldToScreen = null;
/** @type {WebGLUniformLocation} */ let u_Color = null;
/** @type {WebGLUniformLocation} */ let u_Unlit = null;
/** @type {Matrix4} */ let viewToScreen = new Matrix4();
/** @type {number} */ let cameraElevation = 30;
/** @type {number} */ let cameraAzimuth = -50;
/** @type {number} */ let cameraDist = 15;
/** @type {Vector3} */ let cameraCenter = new Vector3();
/** @type {WebGLBuffer} */ let cubeModel = null;
/** @type {WebGLBuffer} */ let circleModel = null;
/** @type {number} */ const fov = 70;
/** @type {Array<number>} */ const currentColor = [0, 0, 0, 1];
/** @type {Vector3} */ const lightDir = new Vector3([0.3, -1, -0.2,]).normalize();
/** @type {number} */ let mouseX = 0;
/** @type {number} */ let mouseY = 0;
/** @type {number} */ let frames = 0;

/** @type {Array<Matrix4>} */ const tempMat4s = [];
/** @type {Array<Vector3>} */ const tempVec3s = [];

/// CROW VARIABLES ///

const floorY = -3;
const upperLegLength = 2.5;
const lowerLegLength = 2.75;
const colors = {
    sky: [0.68, 0.77, 0.87],
    ground: [0.6, 0.6, 0.6],
    shadow: [0.4, 0.4, 0.4],
    feathers: [0.2, 0.2, 0.23],
    legs: [0.4, 0.4, 0.4],
    talons: [0.2, 0.2, 0.2],
    eyes: [0.55, 0.45, 0.4],
    eyeShines: [0.5, 0.5, 0.5],
    pupils: [0, 0, 0],
    beak: [0.1, 0.1, 0.1],
};
const pose = {
    wingsOpen: 0,
    wingsDown: 1,
    tailSplay: 0,
    tailDown: 0,
    footPos: [
        new Vector4([1.5, floorY, 0, 1]),
        new Vector4([-1.5, floorY, 0, 1]),
    ],
    footAngle: [40, 40],
    talonCurl: [0, 0],
    bodyPos: new Vector3([0, 1.5, 0]),
    bodyElevation: -40,
    bodyAzimuth: 0,
    bodyTilt: 0,
    headAngles: new Vector3([35, 0, 0]),
    headOffset: new Vector3([0, 0, 0]),
    beakOpen: 0,
    blink: 0,
    wingsBend: 0,
};
const anim = {
    lastTime: 0,
    footFrom: [
        new Vector3(pose.footPos[0].elements),
        new Vector3(pose.footPos[1].elements),
    ],
    footTo: [
        new Vector3(pose.footPos[0].elements),
        new Vector3(pose.footPos[1].elements),
    ],
    footMove: [1, 1],
    turnHeadDelay: 0,
    lookTarget: new Vector3([0, 0, 10]),
    lookSideToSide: 0,
    lookTilt: 0,
    vel: new Vector3([0, 0, 0]),
    stepTimer: 0,
    stepCounter: 0,
    moveTo: null,
    newMoveDelay: 3,
    newLookDelay: 0,
    baseBodyHeight: 2,
    baseBodyElevation: -40,
    lookTargetAge: 0,
    blinkDelay: 1,
    keepCentered: false,
    paused: false,
    breathTimer: 0,

    startled: false,
    startleTimer: 0,
    startleDir: new Vector3([0, 0, 1]),
};

/// CROW ANIMATION CODE ///

function animateCrow() {
    const time = performance.now() / 1000;
    const dt = anim.paused ? 0 : Math.min(time - anim.lastTime, 0.1);
    anim.lastTime = time;

    anim.breathTimer += dt;
    anim.baseBodyElevation = -40 + Math.sin(anim.breathTimer) * 2.5;

    // Override pose with sliders
    const sliderA = angleSliderA.valueAsNumber / 100;
    const sliderB = angleSliderB.valueAsNumber / 100;
    if (!anim.startled && (sliderA !== 0 || sliderB !== 0)) {
        pose.wingsDown = Math.pow(1 - sliderA, 3);
        pose.wingsOpen = sliderA;
        pose.wingsBend = sliderB;
        pose.tailSplay = sliderA;
        anim.baseBodyElevation += sliderA * 25;
        anim.baseBodyHeight = 2 + sliderA;
    } else {
        pose.wingsDown = 1;
        pose.wingsOpen = 0;
        pose.wingsBend = 0;
        pose.tailSplay = 0;
        anim.baseBodyHeight = 2;
    }

    if (anim.startled) {
        animateStartle(dt);
    } else if (anim.moveTo !== null && !anim.paused) {
        animateWalk(dt);
    } else if (!anim.paused) {
        animateIdle(dt);
    }

    animateLook(dt);
    animateBlink(dt);
}

function startStartle() {
    const mousePos = getMouseWorldPos();

    anim.moveTo = null;
    anim.startled = true;
    anim.startleDir.set(mousePos).sub(pose.bodyPos);
    anim.startleDir.elements[1] = 0;
    anim.startleDir.normalize();
    anim.lookTarget.set(mousePos).sub(pose.bodyPos);
    if (anim.lookTarget.magnitude() < 8) {
        anim.lookTarget.elements[0] = anim.startleDir.elements[0] * 8;
        anim.lookTarget.elements[2] = anim.startleDir.elements[2] * 8;
    }
    anim.lookTarget.add(pose.bodyPos);
    anim.startleTimer = 0;
    anim.blinkDelay = 3;
    anim.newLookDelay = 5;
    anim.lookTilt = Math.random() * 90 - 45;
    anim.footMove[0] = 1;
    anim.footMove[1] = 1;
    pose.blink = 1;
}

function animateStartle(dt) {
    const temp = getVec3();
    const t = anim.startleTimer;
    pose.wingsOpen =
        (Math.sin(t * 16) * 0.5 + 0.5) * Math.max(1 - t, 0) * 0.5 +
        0.5 * Math.max(1 - t, 0);
    pose.wingsDown =
        (Math.cos(t * 16) * -0.5 + 0.5) * Math.max(1 - t, 0) +
        Math.pow(t / 1.5, 3);
    pose.beakOpen =
        Math.min(anim.startleTimer * 6, 1) *
        Math.max(1 - anim.startleTimer * 2, 0);

    const bodyDir = getVec3();
    bodyDir.elements[0] = Math.sin(pose.bodyAzimuth * Math.PI / 180);
    bodyDir.elements[2] = Math.cos(pose.bodyAzimuth * Math.PI / 180);

    const bodyPerp = getVec3();
    bodyPerp.elements[0] = -bodyDir.elements[2];
    bodyPerp.elements[2] = bodyDir.elements[0];

    const targetAngle = Math.atan2(anim.startleDir.elements[0], anim.startleDir.elements[2]) * 180 / Math.PI;
    pose.bodyAzimuth += dt * angleDiff(targetAngle, pose.bodyAzimuth) * anim.startleTimer * 90;

    // Move feet
    const footJump = Math.min(t / 0.4, 1);
    const bodyJump = Math.min(t / 0.5, 1);
    for (let foot = 0; foot < 2; foot++) {
        const side = foot * 2 - 1;
        temp.set(bodyPerp).mul((1 + Math.min(t, 0.4) * 2) * side);
        temp.add(pose.bodyPos);
        temp.elements[1] = footJump * (1 - footJump) * 4 * 2 + floorY;
        for (let i = 0; i < 3; i++) {
            pose.footPos[foot].elements[i] = temp.elements[i];
        }
        anim.footFrom[foot].set(pose.footPos[foot]);
        anim.footTo[foot].set(pose.footPos[foot]);
        pose.talonCurl[foot] = 1 - footJump;
        pose.footAngle[foot] = -pose.bodyElevation * footJump + (1 - footJump) * -90;
    }

    // Move body
    pose.bodyPos.elements[1] = anim.baseBodyHeight + bodyJump * (1 - bodyJump) * 4 * 2;

    if (t < 0.45) {
        temp.set(anim.startleDir);
        temp.mul(dt * -25 * Math.pow(1 - t / 0.45, 1.5));
        pose.bodyPos.add(temp);
    }

    pose.bodyElevation =
        anim.baseBodyElevation +
        Math.sin(t * Math.PI * 2) * Math.pow(Math.max(1 - t / 1.5, 0), 2) * 45;
    pose.tailSplay = Math.min(t * 8, 1) * Math.max(1 - t * 2, 0);
    pose.tailDown = pose.tailSplay * 2;

    anim.startleTimer += dt;
    if (anim.startleTimer > 1.5) {
        anim.startled = false;
        pose.wingsOpen = 0;
        pose.wingsDown = 1;
        pose.beakOpen = 0;
    }

    freeVec3(temp);
    freeVec3(bodyDir);
    freeVec3(bodyPerp);
}

function animateBlink(dt) {
    anim.blinkDelay = Math.max(anim.blinkDelay - dt, 0);
    pose.blink = Math.max(pose.blink - dt * 7, 0);
    if (anim.blinkDelay === 0) {
        if (Math.random() < 0.1) {
            anim.blinkDelay = 0.25;
        }
        anim.blinkDelay = 1 + Math.random() * 2;
        pose.blink = 1;
    }
}

function animateLook(dt) {
    // Check if the look target is mostly in front of the bird
    // If not, immediately choose a new look target
    const oldLookDelta = getVec3();
    const bodyDir = getVec3();
    oldLookDelta.set(anim.lookTarget).sub(pose.bodyPos);
    bodyDir.elements[0] = Math.sin(pose.bodyAzimuth * Math.PI / 180);
    bodyDir.elements[2] = Math.cos(pose.bodyAzimuth * Math.PI / 180);
    const forceNewLook = Vector3.dot(oldLookDelta, bodyDir) < -1 && !anim.startled;

    anim.newLookDelay = Math.max(0, anim.newLookDelay - dt);
    anim.lookTargetAge += dt;

    // Choose a new point to look at
    if (anim.newLookDelay === 0 || forceNewLook) {
        anim.newLookDelay = Math.random() * 2.5 + 0.5;
        anim.lookTargetAge = 0;
        anim.lookTilt = Math.random() * 90 - 45;

        const bodyPerp = getVec3();
        bodyPerp.elements[0] = bodyDir.elements[2];
        bodyPerp.elements[2] = -bodyDir.elements[0];
        bodyPerp.mul(50 * Math.random() - 25);

        const newLookOffset = getVec3()
            .set(bodyDir)
            .mul(30 * Math.random() + 10)
            .add(bodyPerp);

        anim.lookTarget.set(pose.bodyPos).add(newLookOffset);
        anim.lookTarget.elements[1] = floorY + Math.random() * 5;

        freeVec3(bodyPerp);
        freeVec3(newLookOffset);
    }

    // Update head angles
    const invBodyMatrix = getMat4()
        .setTranslate(0, 0, -3)
        .rotate(-pose.bodyElevation, 1, 0, 0)
        .rotate(-pose.bodyTilt, 0, 0, 1)
        .rotate(-pose.bodyAzimuth, 0, 1, 0)
        .translate(
            -pose.bodyPos.elements[0],
            -pose.bodyPos.elements[1],
            -pose.bodyPos.elements[2]
        );

    const localLookPos = invBodyMatrix.multiplyVector4(
        new Vector4([
            anim.lookTarget.elements[0],
            anim.lookTarget.elements[1],
            anim.lookTarget.elements[2],
            1,
        ])
    );
    const lookDir = getVec3();
    lookDir.set(localLookPos);
    lookDir.normalize();

    const t = 1 - Math.pow(0.0001, dt * Math.min(1, 0.1 + 10 * anim.lookTargetAge));
    pose.headAngles.elements[0] = lerp(
        pose.headAngles.elements[0],
        (Math.acos(lookDir.elements[1]) * 180) / Math.PI - 90,
        t
    );
    pose.headAngles.elements[1] = lerp(
        pose.headAngles.elements[1],
        (Math.atan2(lookDir.elements[0], lookDir.elements[2]) * 180) / Math.PI,
        t
    );
    pose.headAngles.elements[2] = lerp(
        pose.headAngles.elements[2],
        -pose.bodyElevation * lookDir.elements[0] + anim.lookTilt,
        t
    );

    // Update head offset
    for (let i = 0; i < 3; i++) {
        pose.headOffset.elements[i] = lerp(
            pose.headOffset.elements[i],
            lookDir.elements[i],
            t
        );
    }

    freeMat4(invBodyMatrix);
    freeVec3(lookDir);
    freeVec3(oldLookDelta);
    freeVec3(bodyDir);
}

function getMouseWorldPos() {
    const temp = getMat4();
    const camDir = getVec3();
    const camPos = getVec3();
    const azCos = Math.cos(cameraAzimuth * Math.PI / 180);
    const azSin = Math.sin(cameraAzimuth * Math.PI / 180);
    const elCos = Math.cos(cameraElevation * Math.PI / 180);
    const elSin = Math.sin(cameraElevation * Math.PI / 180);
    camDir.elements[0] = azSin * elCos;
    camDir.elements[1] = -elSin;
    camDir.elements[2] = -azCos * elCos;
    camPos.set(camDir).mul(-cameraDist).add(cameraCenter);

    const mouseDir = temp
        .setRotate(-cameraAzimuth, 0, 1, 0)
        .rotate(-cameraElevation, 1, 0, 0)
        .multiplyVector3(
            new Vector3([
                (2 * mouseX - canvas.width) / canvas.height,
                (canvas.height - 2 * mouseY) / canvas.height,
                -1 / Math.tan(fov * Math.PI / 180 / 2),
            ])
        );

    const res = new Vector3()
        .set(mouseDir)
        .mul((floorY - camPos.elements[1]) / mouseDir.elements[1])
        .add(camPos);

    freeVec3(camDir);
    freeVec3(camPos);
    freeMat4(temp);

    return res;
}

function animateWalk(dt) {
    const maxSpeed = 6;
    const accel = 30;
    const turnSpeed = 90;
    const temp = getVec3();

    let feetStable = true;
    let anyFootStable = false;
    for (let foot = 0; foot < 2; foot++) {
        const stable = isFootStable(foot);
        feetStable = feetStable && stable;
        anyFootStable = anyFootStable || stable;
    }

    let speed = anim.vel.magnitude();

    if (!anyFootStable) {
        // Increase speed up to cap
        speed = Math.min(speed + accel * dt, maxSpeed);

        // Rotate body towards target pos
        const diffX = anim.moveTo.elements[0] - pose.bodyPos.elements[0];
        const diffZ = anim.moveTo.elements[2] - pose.bodyPos.elements[2];
        const targetAngle = (Math.atan2(diffX, diffZ) * 180) / Math.PI;
        pose.bodyAzimuth = rotateTowards(
            pose.bodyAzimuth,
            targetAngle,
            (dt * turnSpeed * speed) / maxSpeed
        );

        // Rotate velocity in direction of body
        anim.vel.elements[0] = speed * Math.sin(pose.bodyAzimuth * Math.PI / 180);
        anim.vel.elements[1] = 0;
        anim.vel.elements[2] = speed * Math.cos(pose.bodyAzimuth * Math.PI / 180);
    } else {
        temp.set(anim.moveTo).sub(pose.bodyPos).mul(2);
        temp.elements[1] = 0;
        anim.vel.mul(0.9);
        anim.vel.add(temp.mul(0.1));

        if (anim.vel.magnitude() > maxSpeed) {
            anim.vel.normalize().mul(maxSpeed);
        }
    }

    // Step feet forward
    anim.stepTimer += dt * 2 * ((speed / maxSpeed) * 0.9 + 0.1);
    if (anim.stepTimer > 1) {
        anim.stepTimer -= 1;
        anim.stepCounter++;
        const foot = anim.stepCounter % 2;

        const y = floorY;
        let x = +(1 - 2 * foot) * 1.25;
        let z = 2;
        [x, z] = [
            pose.bodyPos.elements[0] +
                x * Math.cos(pose.bodyAzimuth / 180 * Math.PI) +
                z * Math.sin(pose.bodyAzimuth / 180 * Math.PI) +
                anim.vel.elements[0] * 0.2,
            pose.bodyPos.elements[2] +
                z * Math.cos(pose.bodyAzimuth / 180 * Math.PI) -
                x * Math.sin(pose.bodyAzimuth / 180 * Math.PI) +
                anim.vel.elements[2] * 0.2,
        ];

        const stablePos = getStableFootPos(foot);
        const distToStable = Math.sqrt(Math.pow(x - stablePos.elements[0], 2) + Math.pow(z - stablePos.elements[2], 2));
        if (distToStable < 3.5) {
            x = stablePos.elements[0];
            z = stablePos.elements[2];
        }

        if (!isFootStable(foot)) startStep(foot, x, y, z);
    }

    // Animate body
    pose.bodyTilt = Math.sin((anim.stepCounter + anim.stepTimer) * Math.PI) * 15 * speed / maxSpeed;
    pose.bodyPos.elements[1] =
        anim.baseBodyHeight +
        (Math.cos((anim.stepCounter + anim.stepTimer) * Math.PI * 2) * 0.25 + 0.25) * speed / maxSpeed;
    pose.bodyElevation =
        anim.baseBodyElevation +
        Math.sin((anim.stepCounter + anim.stepTimer) * Math.PI * 2) * 2.5 * speed / maxSpeed;

    for (let i = 0; i < 3; i++)
        pose.bodyPos.elements[i] += anim.vel.elements[i] * dt;

    for (let foot = 0; foot < 2; foot++) {
        animateFoot(foot, dt);
    }

    // Stop walking when close enough to destination
    const atTarget =
        Math.abs(pose.bodyPos.elements[0] - anim.moveTo.elements[0]) < 0.1 &&
        Math.abs(pose.bodyPos.elements[2] - anim.moveTo.elements[2]) < 0.1;

    if (
        atTarget &&
        feetStable &&
        anim.footMove[0] === 1 &&
        anim.footMove[1] === 1
    ) {
        anim.moveTo = null;
        anim.newMoveDelay = 2 + 5 * Math.random();
    }

    freeVec3(temp);
}

function animateIdle(dt) {
    anim.newMoveDelay = Math.max(anim.newMoveDelay - dt, 0);

    if (anim.newMoveDelay == 0) {
        let x = Math.random() * 30 - 15;
        let z = Math.random() * 30 - 15;
        const walkDist = Math.sqrt(Math.pow(x - pose.bodyPos.elements[0], 2) + Math.pow(z - pose.bodyPos.elements[2], 2));
        while (walkDist < 10) {
            x = Math.random() * 30 - 15;
            z = Math.random() * 30 - 15;
        }

        anim.moveTo = new Vector3([x, 0, z]);
    }

    pose.bodyPos.elements[1] = anim.baseBodyHeight;
    pose.bodyElevation = anim.baseBodyElevation;
    pose.footAngle[0] = -pose.bodyElevation;
    pose.footAngle[1] = -pose.bodyElevation;
}

function isFootStable(foot) {
    const stablePos = getStableFootPos(foot);
    const stableDist = Math.sqrt(
        Math.pow(anim.footTo[foot].elements[0] - stablePos.elements[0], 2) +
        Math.pow(anim.footTo[foot].elements[2] - stablePos.elements[2], 2));
    return  stableDist < 2;
}

function getStableFootPos(foot) {
    const dirX = Math.sin(pose.bodyAzimuth * Math.PI / 180);
    const dirZ = Math.cos(pose.bodyAzimuth * Math.PI / 180);
    const side = (2 * foot - 1) * 1.5;
    return new Vector3([
        anim.moveTo.elements[0] - dirZ * side * 0.8 - dirX,
        floorY,
        anim.moveTo.elements[2] + dirX * side * 0.8 - dirZ,
    ]);
}

function startStep(foot, x, y, z) {
    for (let i = 0; i < 3; i++)
        anim.footFrom[foot].elements[i] = pose.footPos[foot].elements[i];

    anim.footTo[foot].elements[0] = x;
    anim.footTo[foot].elements[1] = y;
    anim.footTo[foot].elements[2] = z;

    anim.footMove[foot] = 0;
}

function animateFoot(foot, dt) {
    const pos = getVec3();

    const move = anim.footMove[foot] = Math.min(anim.footMove[foot] + dt * 3, 1);
    const lerp = 0.5 - 0.5 * Math.cos(move * Math.PI);
    const lift = move * Math.cos(move * Math.PI / 2) * 2.7;

    pos.set(anim.footTo[foot])
        .sub(anim.footFrom[foot])
        .mul(lerp)
        .add(anim.footFrom[foot]);
    pos.elements[1] += lift * 1.5;

    for (let i = 0; i < 3; i++)
        pose.footPos[foot].elements[i] = pos.elements[i];

    pose.footAngle[foot] = -pose.bodyElevation * (1 - lift);
    pose.talonCurl[foot] = lift;

    freeVec3(pos);
}

/// CROW DRAWING CODE ///

function drawCrow(m) {
    const temp = getMat4();

    // Use cube mesh
    gl.bindBuffer(gl.ARRAY_BUFFER, cubeModel);
    gl.vertexAttribPointer(a_Position, 3, gl.FLOAT, false, 4 * 6, 0);
    gl.vertexAttribPointer(a_Normal, 3, gl.FLOAT, true, 4 * 6, 4 * 3);

    // Body
    temp.set(m);
    drawBody(temp);

    // Wings
    const wingsClosed = 1 - pose.wingsOpen;
    for (let wing = 0; wing < 2; wing++) {
        temp.set(m)
            .scale(wing === 0 ? 1 : -1, 1, 1)
            .translate(
                1 + Math.pow(wingsClosed, 0.5) * 0.5,
                1.15,
                1.25 - 0.5 * wingsClosed
            )
            .rotate(wingsClosed * 7, 0, 1, 0)
            .rotate(pose.wingsDown * -85, 0, 0, 1)
            .rotate(65 - pose.wingsOpen * 70, 0, 1, 0);
        drawWing(temp, pose.wingsOpen, pose.wingsBend);
    }

    // Tail feathers
    temp.set(m)
        .translate(0, 0.6, -2.75)
        .rotate(-5 - 15 * pose.tailDown, 1, 0, 0);
    drawTail(temp, pose.tailSplay);

    // Legs
    const look = getMat4();

    const endDelta = getVec3();
    for (let leg = 0; leg < 2; leg++) {
        temp.setInverseOf(m);
        const footPos = temp.multiplyVector4(pose.footPos[leg]);

        const side = 1 - 2 * leg;
        endDelta.set(footPos);
        const e = endDelta.elements;
        const ox = side;
        const oy = -1;
        const oz = -1.5;

        e[0] -= ox;
        e[1] -= oy;
        e[2] -= oz;

        const maxLength = (upperLegLength + lowerLegLength) * 0.95;
        if (endDelta.magnitude() > maxLength) {
            endDelta.normalize().mul(maxLength);
        }

        // Foot
        temp.set(m)
            .translate(e[0] + ox, e[1] + oy, e[2] + oz)
            .rotate(-pose.bodyTilt, 0, 0, 1)
            .rotate(pose.footAngle[leg], 1, 0, 0)
            .rotate(Math.atan2(e[2] - 5, e[0]) * 180 / Math.PI + 90, 0, 1, 0)
            .scale(side, 1, 1);
        drawFoot(temp, pose.talonCurl[leg]);

        // Leg
        look.setLookAt(0, 0, 0, e[0], e[1], e[2], 0, 0, 1).transpose();
        temp.set(m).translate(ox, oy, oz).multiply(look);
        drawLeg(temp, endDelta.magnitude());
    }

    const neckDelta = getVec3();
    neckDelta.set(pose.headOffset);
    neckDelta.elements[2] += 3.5 - 2;

    // Neck
    setDrawColor(colors.feathers);
    temp.set(m)
        .translate(
            neckDelta.elements[0] / 2,
            neckDelta.elements[1] / 2 + 0.25,
            neckDelta.elements[2] / 2 + 1.5
        )
        .scale(0.8, 0.8, 0.7)
        .rotate(pose.headAngles.elements[2] / 2, 0, 0, 1);
    drawFancyCube(temp);

    // Head
    temp.set(m)
        .translate(
            pose.headOffset.elements[0],
            pose.headOffset.elements[1],
            pose.headOffset.elements[2]
        )
        .translate(0, 0, 3.5)
        .rotate(pose.headAngles.elements[1], 0, 1, 0)
        .rotate(pose.headAngles.elements[0], 1, 0, 0)
        .rotate(pose.headAngles.elements[2], 0, 0, 1);
    drawHead(temp, pose.beakOpen, pose.blink);

    freeVec3(endDelta);
    freeMat4(look);
    freeMat4(temp);
}

function drawHead(m, open, blink) {
    const temp = getMat4();

    const upperBeak = getMat4();
    upperBeak
        .set(m)
        .translate(0, 0.15, 1)
        .rotate(-30 * open, 1, 0, 0);

    const lowerBeak = getMat4();
    lowerBeak
        .set(m)
        .translate(0, -0.15, 1)
        .rotate(30 * open, 1, 0, 0);

    // Main head
    setDrawColor(colors.feathers);
    temp.set(m).scale(1, 1, 1.1);
    drawFancyCube(temp);

    // Upper beak
    setDrawColor(colors.beak);
    temp.set(upperBeak)
        .translate(0, 0.3 - 0.15, 0.9 - 1)
        .rotate(15, 1, 0, 0)
        .scale(0.4, 0.3, 0.8)
        .translate(0, 0, 1);
    drawFancyCube(temp);

    temp.set(upperBeak)
        .translate(0, -0.3, 1.53)
        .rotate(45, 1, 0, 0)
        .scale(0.35, 0.23, 0.23);
    drawFancyCube(temp);

    // Lower beak
    temp.set(lowerBeak)
        .translate(0, -0.15, -0.1)
        .rotate(-5, 1, 0, 0)
        .scale(0.35, 0.2, 0.8)
        .translate(0, 0, 1);
    drawFancyCube(temp);

    // Eyes
    for (let side = -1; side <= 1; side += 2) {
        setDrawColor(colors.eyes);
        temp.set(m).translate(side, 0.1, 0.3).scale(0.1, 0.4, 0.4);
        drawFancyCube(temp);

        setDrawColor(colors.pupils);
        temp.set(m).translate(side, 0.1, 0.35).scale(0.11, 0.25, 0.25);
        drawFancyCube(temp);

        setDrawColor(colors.eyeShines);
        temp.set(m).translate(side, 0.3, 0.1).scale(0.12, 0.1, 0.1);
        drawFancyCube(temp);

        // Eyebrows
        setDrawColor(colors.feathers);
        temp.set(m)
            .translate(side * 0.97, 0.6, 0.3)
            .rotate(20 * side, 0, 0, 1)
            .scale(0.1, 0.2, 0.5);
        drawFancyCube(temp);

        // Eyelids
        temp.set(m)
            .translate(side, 0.05 + 0.42 * (1 - blink), 0.3)
            .scale(0.125, 0.42 * blink, 0.45);
        drawFancyCube(temp);
    }

    freeMat4(upperBeak);
    freeMat4(lowerBeak);
    freeMat4(temp);
}

function drawLeg(m, length) {
    // Inverse kinematics!
    const a = upperLegLength;
    const b = lowerLegLength;
    const c = Math.max(Math.abs(a - b), Math.min(length, a + b));
    let kneeAngle = Math.acos((a * a + b * b - c * c) / (2 * a * b));
    let hipAngle = Math.asin((b / c) * Math.sin(kneeAngle));
    kneeAngle *= 180 / Math.PI;
    hipAngle *= 180 / Math.PI;

    const upper = getMat4().set(m).rotate(-hipAngle, 1, 0, 0);
    const lower = getMat4()
        .set(upper)
        .translate(0, 0, -a)
        .rotate(180 - kneeAngle, 1, 0, 0);
    const temp = getMat4();

    // Upper leg
    setDrawColor(colors.feathers);
    temp.set(upper)
        .translate(0, 0, -a / 4)
        .scale(0.5, 0.5, a / 3);
    drawFancyCube(temp);

    temp.set(upper)
        .translate(0, 0, -a / 2)
        .scale(0.4, 0.4, a / 2);
    drawFancyCube(temp);

    // Lower leg
    temp.set(lower).translate(0, 0, -0.3).scale(0.3, 0.3, 0.6);
    drawFancyCube(temp);

    setDrawColor(colors.legs);
    temp.set(lower)
        .translate(0, 0, -b / 2)
        .scale(0.2, 0.2, b / 2);
    drawFancyCube(temp);

    freeMat4(upper);
    freeMat4(lower);
    freeMat4(temp);
}

function drawFoot(m, curl) {
    const temp = getMat4();

    temp.set(m);
    drawTalon(temp, curl);
    temp.set(m).rotate(-30, 0, 1, 0).scale(0.85, 0.85, 0.85);
    drawTalon(temp, curl);
    temp.set(m).rotate(30, 0, 1, 0).scale(0.85, 0.85, 0.85);
    drawTalon(temp, curl);
    temp.set(m).rotate(180, 0, 1, 0).scale(0.6, 0.6, 0.6);
    drawTalon(temp, curl);

    freeMat4(temp);
}

function drawTalon(m, curl) {
    const temp = getMat4();
    const bone = getMat4();

    bone.set(m)
        .translate(0, 0.4, 0)
        .rotate(curl * 20 + 5, 1, 0, 0);

    setDrawColor(colors.legs);
    temp.set(bone).scale(0.2, 0.2, 0.5).translate(0, -1, 1);
    drawFancyCube(temp);

    bone.translate(0, 0, 1).rotate(curl * 20, 1, 0, 0);

    temp.set(bone).scale(0.15, 0.15, 0.2).translate(0, -1, 1);
    drawFancyCube(temp);

    bone.translate(0, 0, 0.4).rotate(curl * 20 + 10, 1, 0, 0);

    setDrawColor(colors.talons);
    temp.set(bone).scale(0.1, 0.1, 0.2).translate(0, -1, 1);
    drawFancyCube(temp);

    freeMat4(temp);
    freeMat4(bone);
}

function drawTail(m, splay) {
    const temp = getMat4();
    setDrawColor(colors.feathers);

    for (let i = 0; i < 8; i++) {
        const t = (i / 7) * 2 - 1;
        temp.set(m)
            .translate(t * 0.5, 0, 0)
            .rotate(180 - t * (splay * 40 - 5), 0, 1, 0)
            .rotate(t * (splay * 30 + 10), 0, -0.2, 1);
        drawFeather(temp, 4 + 0.5 * Math.sqrt(1 - t * t));
    }
    freeMat4(temp);
}

function drawWing(m, open, bend) {
    const closed = 1 - open;
    const squash = 1 - closed * 0.7;
    const part = getMat4();
    setDrawColor(colors.feathers);

    // Shoulder
    part.set(m).translate(1, 0, 0).scale(1.5, 0.45, 0.7);
    drawFancyCube(part);

    // Elbow
    const elbowAngle = closed * 30 + bend * 70 * open;
    const elbow = getMat4();
    elbow.set(m).translate(2.5, 0, 0.6).rotate(elbowAngle, 0, 1, 0);
    part.set(elbow).translate(1, 0, -0.4).scale(1, 0.4, 0.4);
    drawFancyCube(part);

    // Feathers
    for (let i = 0; i < 6; i++) {
        const t = i / 5;

        const angle = 130
            + open * 60
            - open * t * 35
            - closed * t * 10
            - closed * (1 - t) * 15;

        part.set(m)
            .translate(t * 1.75 + 0.4, 0, 0)
            .rotate(angle, 0, 1, 0);
        drawFlightFeather(part, 6 + 0.75 * t);
    }
    for (let i = 0; i < 6; i++) {
        const t = i / 5;
        part.set(elbow)
            .translate(t * 1.5 + 0.4, 0, -0.5)
            .rotate(90 + open * 60 - open * t * 60, 0, 1, 0);
        drawFlightFeather(part, 6.45 - 1.5 * t * t);
    }

    freeMat4(part);
    freeMat4(elbow);
}

function drawFlightFeather(m, length) {
    const temp = getMat4();

    temp.set(m)
        .translate(0, 0, length / 2)
        .rotate(-20, 0, 0, 1)
        .scale(0.4, 0.15, length / 2);
    drawFancyCube(temp);
    temp.translate(0, 1, -0.5).scale(1.25, 1, 0.5);
    drawFancyCube(temp);

    freeMat4(temp);
}

function drawFeather(m, length) {
    const temp = getMat4();

    temp.set(m)
        .translate(0, 0, length / 2)
        .scale(0.4, 0.15, length / 2);
    drawFancyCube(temp);

    freeMat4(temp);
}

function drawBody(m) {
    const part = getMat4();
    setDrawColor(colors.feathers);

    part.set(m).scale(1.5, 1.5, 1.35);
    drawFancyCube(part);
    part.set(m).scale(1.2, 1.2, 2.2);
    drawFancyCube(part);
    part.set(m).translate(0, 0.25, -2.5).scale(0.75, 0.6, 0.5);
    drawFancyCube(part);

    freeMat4(part);
}

/// GENERAL GRAPHICS CODE ///

function rotateTowards(from, to, delta) {
    return from + Math.max(-delta, Math.min(angleDiff(to, from), delta));
}

function angleDiff(a, b) {
    return ((((a - b + 180) % 360) + 360) % 360) - 180;
}

function lerp(a, b, t) {
    return (b - a) * t + a;
}

function getMat4() {
    if (tempMat4s.length > 0) return tempMat4s.pop();
    else return new Matrix4();
}

function freeMat4(m) {
    tempMat4s.push(m.setIdentity());
}

function getVec3() {
    if (tempVec3s.length > 0) return tempVec3s.pop();
    else return new Vector3();
}

function freeVec3(v) {
    for (let i = 0; i < 3; i++) v.elements[i] = 0;
    tempVec3s.push(v);
}

function setDrawColor(r, g, b, a) {
    if (typeof r === "object") {
        a = r[3];
        b = r[2];
        g = r[1];
        r = r[0];
    }
    if (
        r != currentColor[0] ||
        g != currentColor[1] ||
        b != currentColor[2] ||
        a != currentColor[3]
    ) {
        gl.uniform4f(u_Color, r, g, b, a != null ? a : 1);
        currentColor[0] = r;
        currentColor[1] = g;
        currentColor[2] = b;
        currentColor[3] = a;
    }
}

function drawCube(m) {
    gl.uniformMatrix4fv(u_ModelToWorld, false, m.elements);
    gl.drawArrays(gl.TRIANGLES, 0, 6 * 6);
}

function drawFancyCube(m) {
    // Compute shadow matrix
    const temp = getMat4();
    const dir = lightDir.elements;
    temp.dropShadow(
        [0, 1, 0, -floorY - cameraDist * 0.001],
        [-dir[0], -dir[1], -dir[2], 0]
    );
    temp.multiply(m);

    // Draw shadow
    const r = currentColor[0];
    const g = currentColor[1];
    const b = currentColor[2];
    const a = currentColor[3];
    gl.uniform1f(u_Unlit, 1);
    setDrawColor(colors.shadow);
    drawCube(temp);
    setDrawColor(r, g, b, a);
    gl.uniform1f(u_Unlit, 0);

    // Draw main cube
    drawCube(m);

    freeMat4(temp);
}

function renderScene() {
    // Clear screen
    gl.clearColor(colors.sky[0], colors.sky[1], colors.sky[2], 1);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    // Move camera center
    if (anim.keepCentered) {
        cameraCenter.set(pose.bodyPos);
    } else {
        for (let i = 0; i < 3; i++) cameraCenter.elements[i] = 0;
    }

    // Clip camera out of floor
    const minFloorDist = 0.25;
    if (floorY + minFloorDist - cameraCenter.elements[1] > -cameraDist) {
        cameraElevation = Math.max(
            cameraElevation,
            Math.asin((floorY + minFloorDist - cameraCenter.elements[1]) / cameraDist) * 180 / Math.PI
        );
    }

    // View
    const worldToView = getMat4()
        .setTranslate(0, 0, -cameraDist)
        .rotate(cameraElevation, 1, 0, 0)
        .rotate(cameraAzimuth, 0, 1, 0)
        .translate(
            -cameraCenter.elements[0],
            -cameraCenter.elements[1],
            -cameraCenter.elements[2]
        );

    // Projection
    const worldToScreen = getMat4();
    worldToScreen.set(viewToScreen);
    worldToScreen.multiply(worldToView);
    gl.uniformMatrix4fv(u_WorldToScreen, false, worldToScreen.elements);
    freeMat4(worldToView);
    freeMat4(worldToScreen);

    // Floor
    const temp = getMat4();
    setDrawColor(colors.ground);
    temp.setTranslate(0, floorY, 0);
    temp.scale(100, 1, 100);

    gl.bindBuffer(gl.ARRAY_BUFFER, circleModel);
    gl.vertexAttribPointer(a_Position, 3, gl.FLOAT, false, 4 * 6, 0);
    gl.vertexAttribPointer(a_Normal, 3, gl.FLOAT, true, 4 * 6, 4 * 3);
    gl.uniformMatrix4fv(u_ModelToWorld, false, temp.elements);
    gl.drawArrays(gl.TRIANGLES, 0, 14 * 3);

    // Model
    temp.setTranslate(
        pose.bodyPos.elements[0],
        pose.bodyPos.elements[1],
        pose.bodyPos.elements[2]
    )
        .rotate(pose.bodyAzimuth, 0, 1, 0)
        .rotate(pose.bodyTilt, 0, 0, 1)
        .rotate(pose.bodyElevation, 1, 0, 0);
    drawCrow(temp);
    freeMat4(temp);
}

/// SETUP CODE ///

function createCubeData() {
    const data = new Float32Array(6 * 6 * 6);
    const normal = new Vector3();
    const tangent = new Vector3();
    const bitangent = new Vector3();
    const point = new Vector3();
    let dataInd = 0;

    function add(point) {
        data[dataInd++] = point.elements[0];
        data[dataInd++] = point.elements[1];
        data[dataInd++] = point.elements[2];
        data[dataInd++] = normal.elements[0];
        data[dataInd++] = normal.elements[1];
        data[dataInd++] = normal.elements[2];
    }

    for (let axis = 0; axis < 3; axis++) {
        for (let dir = -1; dir <= 1; dir += 2) {
            // Compute face normals and tangent
            normal.sub(normal);
            normal.elements[axis] = dir;
            tangent.sub(tangent);
            tangent.elements[(axis + 1) % 3] = dir;
            bitangent.set(normal).cross(tangent);

            add(point.set(normal).add(tangent).add(bitangent));
            add(point.set(normal).sub(tangent).add(bitangent));
            add(point.set(normal).sub(tangent).sub(bitangent));
            add(point.set(normal).add(tangent).add(bitangent));
            add(point.set(normal).sub(tangent).sub(bitangent));
            add(point.set(normal).add(tangent).sub(bitangent));
        }
    }

    return data;
}

function createCircleData() {
    const verts = 16;
    const data = new Float32Array((verts - 2) * 3 * 6);

    for (let vert = 0; vert < verts - 2; vert++) {
        const left = (vert + 1) / verts * Math.PI * 2;
        const right = (vert + 2) / verts * Math.PI * 2;

        // XZ
        data[vert * 18 + 0] = 1;
        data[vert * 18 + 2] = 0;
        data[vert * 18 + 6] = Math.cos(left);
        data[vert * 18 + 8] = Math.sin(left);
        data[vert * 18 + 12] = Math.cos(right);
        data[vert * 18 + 14] = Math.sin(right);

        // Normal Y
        data[vert * 18 + 4] = 1;
        data[vert * 18 + 10] = 1;
        data[vert * 18 + 16] = 1;
    }

    return data;
}

function setupGL() {
    // Load shaders
    initShaders(gl, VSHADER_SOURCE, FSHADER_SOURCE);

    // Get variable locations
    a_Position = gl.getAttribLocation(gl.program, "a_Position");
    a_Normal = gl.getAttribLocation(gl.program, "a_Normal");
    u_ModelToWorld = gl.getUniformLocation(gl.program, "u_ModelToWorld");
    u_WorldToScreen = gl.getUniformLocation(gl.program, "u_WorldToScreen");
    u_Color = gl.getUniformLocation(gl.program, "u_Color");
    u_Unlit = gl.getUniformLocation(gl.program, "u_Unlit");

    // Create cube mesh
    const cubeData = createCubeData();
    cubeModel = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, cubeModel);
    gl.bufferData(gl.ARRAY_BUFFER, cubeData, gl.STATIC_DRAW);

    // Create floor circle mesh
    const circleData = createCircleData();
    circleModel = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, circleModel);
    gl.bufferData(gl.ARRAY_BUFFER, circleData, gl.STATIC_DRAW);

    // Prepare for rendering
    gl.enable(gl.DEPTH_TEST);
    gl.enableVertexAttribArray(a_Position);
    gl.enableVertexAttribArray(a_Normal);
}

function resize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight - 100;
    gl.viewport(0, 0, canvas.width, canvas.height);
    viewToScreen.setPerspective(fov, canvas.width / canvas.height, 0.1, 1000);
    renderScene();
}

function turnCamera(degreesLeft, degreesUp) {
    cameraAzimuth += degreesLeft;
    cameraElevation = Math.max(-90, Math.min(cameraElevation + degreesUp, 90));
}

function mainLoop() {
    animateCrow();
    renderScene();
    frames++;
    requestAnimationFrame(mainLoop);
}

function updateCentered() {
    anim.keepCentered = document.getElementById("center").checked;
}

function updatePaused() {
    anim.paused = document.getElementById("pause").checked;
}

function viewNotes() {
    document.getElementById("notes").scrollIntoView(false);
}

function main() {
    angleSliderA = document.getElementById("angleA");
    angleSliderB = document.getElementById("angleB");
    fpsCounter = document.getElementById("fps");
    canvas = document.getElementById("webgl");
    gl = canvas.getContext("webgl");
    setupGL();

    // Rotate camera on mouse input
    canvas.addEventListener("mousemove", function (event) {
        mouseX = event.x;
        mouseY = event.y;
        if ((event.buttons & 1) != 0) {
            const scale = 180 / canvas.height;
            turnCamera(event.movementX * scale, event.movementY * scale);
        }
    });

    // Zoom camera on scroll
    canvas.addEventListener("wheel", function (event) {
        cameraDist = Math.max(
            1,
            cameraDist * (1 + Math.sign(event.deltaY) * 0.2)
        );
        cameraDist = Math.min(cameraDist, 600);
    });

    // Startle the bird on poke
    canvas.addEventListener("mousedown", function (event) {
        mouseX = event.x;
        mouseY = event.y;
        if (event.shiftKey) startStartle();
    });

    // Resize canvas to fit the screen
    window.addEventListener("resize", resize);
    resize();

    // Track FPS
    setInterval(function () {
        fpsCounter.innerText = frames;
        frames = 0;
    }, 1000);

    requestAnimationFrame(mainLoop);
}
