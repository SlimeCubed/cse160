/** @type {Array<Matrix4>} */ const tempMat4s = [];
/** @type {Array<Vector3>} */ const tempVec3s = [];
/** @type {Array<Vector4>} */ const tempVec4s = [];

function castAllChunks(pos, dir) {
    const p = pos.elements;
    const d = dir.elements;

    let best = null;
    let bestDist = Infinity;
    for (const chunk of chunks) {
        const hit = chunk.cast(p[0],p[1],p[2], d[0],d[1],d[2]);
        if (hit) {
            const dx = p[0] - hit.hitX;
            const dy = p[1] - hit.hitY;
            const dz = p[2] - hit.hitZ;
            const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
            if (dist < bestDist) {
                hit.chunk = chunk;
                best = hit;
                bestDist = dist;
            }   
        }
    }

    return best;
}

function closestPointAllChunks(pos, radius, floorLevel) {
    const p = pos.elements;

    let best = null;
    let bestDist = radius;

    // Check against water
    const floorDist = Math.abs(p[1] - floorLevel);
    if (floorLevel != undefined && floorDist < radius) {
        bestDist = floorDist;
        best = [pos[0], floorLevel, pos[2]];
    }

    // Check against chunks
    for (const chunk of chunks) {
        const res = chunk.getClosestPoint(p[0],p[1],p[2], bestDist);
        if (res) {
            const dx = p[0] - res[0];
            const dy = p[1] - res[1];
            const dz = p[2] - res[2];
            const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
            if (dist < bestDist) {
                best = res;
                bestDist = dist;
            }   
        }
    }

    return best === null ? null : new Vector3(best);
}

function snapToClosest(pos, radius, height, floorLevel) {
    const temp = new Vector3().set(pos);
    const ground = closestPointAllChunks(pos, radius, floorLevel);
    if (ground) {
        temp.set(pos)
            .sub(ground)
            .normalize()
            .mul(height)
            .add(ground);
        if (isNaN(temp.elements[0]))
            temp.set(pos);
    }

    return temp;
}

function snapToGround(pos, sx, sz, floorLevel) {
    for (const chunk of chunks) {
        floorLevel = chunk.castRectY(
            pos.elements[1], floorLevel,
            pos.elements[0] - sx / 2, pos.elements[0] + sx / 2,
            pos.elements[2] - sz / 2, pos.elements[2] + sz / 2);
    }

    return floorLevel;
}

function moveAndCollide(x, y, z, sx, sy, sz, dx, dy, dz) {
    const m = 0.01;
    const result = { x: x, y: y, z: z, normalX: 0, normalY: 0, normalZ: 0 };
    if (dy !== 0) {
        let newY = null;
        for (const chunk of chunks) {
            const hit = chunk.castRectY(
                y, y + dy + Math.sign(dy) * sy / 2,
                x - sx / 2 + m, x + sx / 2 - m,
                z - sz / 2 + m, z + sz / 2 - m)
                - Math.sign(dy) * sy / 2;
            if (newY === null || hit / dy < newY / dy) newY = hit;
        }

        if (Math.abs(y + dy - newY) > 0.001)
            result.normalY = -Math.sign(dy);

        y = newY === null ? y + dy : newY;
    }

    if (dx !== 0) {
        let newX = null;
        for (const chunk of chunks) {
            const hit = chunk.castRectX(
                x, x + dx + Math.sign(dx) * sx / 2,
                y - sy / 2 + m, y + sy / 2 - m,
                z - sz / 2 + m, z + sz / 2 - m)
                - Math.sign(dx) * sx / 2;
            if (newX === null || hit / dx < newX / dx) newX = hit;
        }

        if (Math.abs(x + dx - newX) > 0.001)
            result.normalX = -Math.sign(dx);

        x = newX === null ? x + dx : newX;
    }

    if (dz !== 0) {
        let newZ = null;
        for (const chunk of chunks) {
            const hit = chunk.castRectZ(
                z, z + dz + Math.sign(dz) * sz / 2,
                x - sx / 2 + m, x + sx / 2 - m,
                y - sy / 2 + m, y + sy / 2 - m)
                - Math.sign(dz) * sz / 2;
            if (newZ === null || hit / dz < newZ / dz) newZ = hit;
        }

        if (Math.abs(z + dz - newZ) > 0.001)
            result.normalZ = -Math.sign(dz);

        z = newZ === null ? z + dz : newZ;
    }

    result.x = x;
    result.y = y;
    result.z = z;
    return result;
}

function intersectAABBs(xMinA, yMinA, zMinA, xMaxA, yMaxA, zMaxA, xMinB, yMinB, zMinB, xMaxB, yMaxB, zMaxB) {
    return xMaxA >= xMinB && xMaxB >= xMinA
        && yMaxA >= yMinB && yMaxB >= yMinA
        && zMaxA >= zMinB && zMaxB >= zMinA;
}

/**
 * Given a ray origin and direction, returns the distance to a plane on the Z-axis;
 * @param {number} x 
 * @param {number} y 
 * @param {number} z 
 * @param {number} dx 
 * @param {number} dy 
 * @param {number} dz 
 * @param {number} planeZ 
 */
function rayCastZPlane(x, y, z, dx, dy, dz, planeZ) {
    const zDist = planeZ - z;
    if (zDist === 0)
        return 0;

    const t = zDist / dz;
    if (isFinite(t) && t > 0)
        return t;
    else
    return Infinity;
}

function rayCastZRect(x, y, z, dx, dy, dz, planeZ, xMin, yMin, xMax, yMax) {
    const t = rayCastZPlane(x, y, z, dx, dy, dz, planeZ);
    if (!isFinite(t)) return t;

    const newX = x + dx * t;
    const newY = y + dy * t;

    if (newX >= xMin && newX <= xMax && newY >= yMin && newY <= yMax)
        return t;
    else
        return Infinity;
}

/**
 * @param {number} x 
 * @param {number} y 
 * @param {number} z 
 * @param {number} dx 
 * @param {number} dy 
 * @param {number} dz 
 * @param {number} xMin 
 * @param {number} yMin 
 * @param {number} zMin 
 * @param {number} xMax 
 * @param {number} yMax 
 * @param {number} zMax 
 */
function rayCastAABB(x, y, z, dx, dy, dz, xMin, yMin, zMin, xMax, yMax, zMax) {
    if (x >= xMin && y >= yMin && z >= zMin && x <= xMax && y <= yMax && z <= zMax) {
        return 0;
    }

    return Math.min(
        // Z rects
        rayCastZRect(x, y, z, dx, dy, dz, zMin, xMin, yMin, xMax, yMax),
        rayCastZRect(x, y, z, dx, dy, dz, zMax, xMin, yMin, xMax, yMax),

        // Y rects
        rayCastZRect(x, z, y, dx, dz, dy, yMin, xMin, zMin, xMax, zMax),
        rayCastZRect(x, z, y, dx, dz, dy, yMax, xMin, zMin, xMax, zMax),

        // X rects
        rayCastZRect(z, y, x, dz, dy, dx, xMin, zMin, yMin, zMax, yMax),
        rayCastZRect(z, y, x, dz, dy, dx, xMax, zMin, yMin, zMax, yMax)
    );
}

/**
 * Returns true if the left vector is closer to target than the right.
 * @param {number} targetX 
 * @param {number} targetY 
 * @param {number} targetZ 
 * @param {number} lhsX 
 * @param {number} lhsY 
 * @param {number} lhsZ 
 * @param {number} rhsX 
 * @param {number} rhsY 
 * @param {number} rhsZ 
 */
function isCloser(targetX, targetY, targetZ, lhsX, lhsY, lhsZ, rhsX, rhsY, rhsZ) {
    return isSmaller(
        lhsX - targetX,
        lhsY - targetY,
        lhsZ - targetZ,
        rhsX - targetX,
        rhsY - targetY,
        rhsZ - targetZ);
}

/**
 * Returns true if the left vector is closer to (0, 0, 0) than the right.
 * @param {number} lhsX 
 * @param {number} lhsY 
 * @param {number} lhsZ 
 * @param {number} rhsX 
 * @param {number} rhsY 
 * @param {number} rhsZ 
 */
function isSmaller(lhsX, lhsY, lhsZ, rhsX, rhsY, rhsZ) {
    return lhsX * lhsX + lhsY * lhsY + lhsZ * lhsZ < rhsX * rhsX + rhsY * rhsY + rhsZ * rhsZ;
}

function computeNormals(data, stride, positionOffset, normalOffset) {
    const a = getVec3();
    const b = getVec3();
    const c = getVec3();
    
    const origLength = data.length;
    for (let start = 0; start < origLength; start += stride * 3) {
        // Get vertices
        for (let i = 0; i < 3; i++) {
            const o = start + positionOffset + i;
            a.elements[i] = data[o];
            b.elements[i] = data[o + stride];
            c.elements[i] = data[o + stride * 2];
        }

        // Compute normal
        b.sub(a);
        c.sub(a);
        b.cross(c);
        
        // Set normals
        for (let i = 0; i < 3; i++) {
            const o = start + i + normalOffset;
            data[o] = b.elements[i];
            data[o + stride] = b.elements[i];
            data[o + stride * 2] = b.elements[i];
        }
    }

    freeVec3(a);
    freeVec3(b);
    freeVec3(c);
}

function makeCylinderElements(rings, points) {
    const elements = new Uint16Array((rings - 1) * points * 6);
    let i = 0;
    for (let ring = 0; ring < rings - 1; ring++) {
        const firstVert = ring * points;
        for (let point = 0; point < 4; point++) {
            elements[i++] = firstVert + point;
            elements[i++] = firstVert + (point + 1) % points;
            elements[i++] = firstVert + (point + 1) % points + points;

            elements[i++] = firstVert + point;
            elements[i++] = firstVert + (point + 1) % points + points;
            elements[i++] = firstVert + point + points;
        }
    }

    return elements;
}

function getWorldMinMax() {
    const min = [0, 0, 0];
    const max = [0, 0, 0];
    for (const chunk of chunks) {
        const newMin = chunk.getMin();
        const newMax = chunk.getMax();

        for (let i = 0; i < 3; i++) {
            min[i] = Math.min(min[i], newMin[i]);
            max[i] = Math.max(max[i], newMax[i]);
        }
    }

    return [min, max];
}

/**
 * Calculates the point in a unit voxel that is closest to another point.
 * @param {number} voxelX 
 * @param {number} voxelY 
 * @param {number} voxelZ 
 * @param {number} x 
 * @param {number} y 
 * @param {number} z 
 */
function closestPoint(voxelX, voxelY, voxelZ, x, y, z) {
    x = Math.min(Math.max(voxelX, x), voxelX + 1);
    y = Math.min(Math.max(voxelY, y), voxelY + 1);
    z = Math.min(Math.max(voxelZ, z), voxelZ + 1);

    return [x, y, z];
}

/**
 * Rotates one angle towards another in degrees.
 * @param {number} from 
 * @param {number} to 
 * @param {number} delta 
 */
function rotateTowards(from, to, delta) {
    return from + Math.max(-delta, Math.min(angleDiff(to, from), delta));
}

/**
 * Gets the smallest signed difference between two angles in degrees.
 * @param {number} a 
 * @param {number} b 
 */
function angleDiff(a, b) {
    return ((((a - b + 180) % 360) + 360) % 360) - 180;
}

/**
 * Linearly interpolate between two numbers.
 * @param {number} a 
 * @param {number} b 
 * @param {number} t 
 */
function lerp(a, b, t) {
    return (b - a) * t + a;
}

function chooseRandom(list) {
    return list[randomInt(0, list.length)];
}

function randomInt(minInclusive, maxExclusive) {
    const size = maxExclusive - minInclusive;
    return Math.min(Math.floor(Math.random() * size), size - 1) + minInclusive;
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

function getVec4() {
    if (tempVec4s.length > 0) return tempVec4s.pop();
    else return new Vector4();
}

function freeVec4(v) {
    for (let i = 0; i < 4; i++) v.elements[i] = 0;
    tempVec4s.push(v);
}
