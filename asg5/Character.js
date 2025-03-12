import * as THREE from "three";
import * as SkeletonUtils from "three/addons/utils/SkeletonUtils.js";

class Character {
    /** @type {} */
    constructor(game, gltf, pos, online = false) {
        this.game = game;
        this.online = online;

        /** @type {THREE.Group} */
        this.model = SkeletonUtils.clone(gltf.scene);
        this.anims = new THREE.AnimationMixer(this.model);
        this.clips = {
            idle: this.anims.clipAction(THREE.AnimationClip.findByName(gltf.animations, online ? "Idle" : "IdleHold")),
            walk: this.anims.clipAction(THREE.AnimationClip.findByName(gltf.animations, online ? "Walk" : "WalkHold")),
            wave: this.anims.clipAction(THREE.AnimationClip.findByName(gltf.animations, online ? "Wave" : "WaveHold")),
        };

        this.clips.idle.play();
        this.clips.walk.play();
        this.clips.idle.weight = 1;
        this.clips.walk.weight = 1;
        this.clips.walk.timeScale = 1.85;
        this.clips.wave.setLoop(THREE.LoopOnce, 0);
        this.clips.wave.timeScale = 1.2;
        this.raycaster = new THREE.Raycaster();
        this.raycaster.far = 100;
        this.mouseRaycaster = new THREE.Raycaster();

        this.model.position.copy(pos);
        this.target = pos.clone();
        this.lastGoodPos = new THREE.Vector3();
        this.lastGoodPos.copy(this.model.position);
        this.speed = 3;
        this.targetAngle = 0;
        this.shownHint = false;
        this.showingHint = false;

        this.particles = new THREE.Group();
        this.particleTimer = 0;

        if (online) {
            function changeMat(node, mat) {
                if (node.material) {
                    node.material = mat;
                    node.castShadow = false;
                }
                for (const child of node.children)
                    changeMat(child, mat);
            }
            
            const mat = new THREE.MeshBasicMaterial({
                color: 0xDDDDFF
            });
            changeMat(this.model, mat);

            this.particleModel = new THREE.Mesh(new THREE.TetrahedronGeometry(0.1), mat);
        }

        if (online) {
            const blueLight = new THREE.PointLight(0x0000FF, 4);
            blueLight.position.set(0, 1, 0);
            this.model.add(blueLight);

            const whiteLight = new THREE.PointLight(0xFFFFFF, 4, 10, 3);
            whiteLight.position.set(0, 1, 0);
            this.model.add(whiteLight);

            this.model.layers.enable(2);
        } else {
            const lantern = this.createLantern();
            lantern.position.set(-0.1, 0.27, 0.1);
            lantern.rotation.set(Math.PI * 0.5, 0, Math.PI * 0.25);
            // Ouch
            this.model.children[0].children[1].children[0].children[2].children[0].children[0].add(lantern);
        }
    }

    createLantern() {
        const lantern = new THREE.Group();
        const cylinderGeo = new THREE.CylinderGeometry();
        const glowMat = new THREE.MeshBasicMaterial();
        const metalMat = new THREE.MeshStandardMaterial({ color: 0x4A3123, metalness: 0.7 });

        // Geometry
        for (let side = -1; side <= 2; side += 2) {
            const cap = new THREE.Mesh(cylinderGeo, metalMat);
            cap.position.set(0, 0.1 * side, 0);
            cap.scale.set(0.1, 0.05, 0.1);
            lantern.add(cap);

            const capShadow = new THREE.Mesh(cylinderGeo, metalMat);
            capShadow.position.set(0, 0.1 * side, 0);
            capShadow.scale.set(0.025, 0.05, 0.025);
            capShadow.castShadow = true;
            lantern.add(capShadow);
        }

        const fill = new THREE.Mesh(cylinderGeo, glowMat);
        fill.scale.set(0.08, 0.2, 0.08);
        lantern.add(fill);
        

        // Glow
        const light = new THREE.PointLight(0xFFEEDD, 2, 20);
        light.shadow.bias = -0.001;
        light.shadow.mapSize.set(128, 128);
        light.shadow.camera.near = 0.05;
        light.shadow.camera.updateProjectionMatrix();
        light.castShadow = true;
        lantern.add(light);

        return lantern;
    }

    addToScene(scene) {
        scene.add(this.model, this.particles);
    }

    removeFromScene() {
        this.model.removeFromParent();
        this.particles.removeFromParent();
    }

    update(dt) {
        this.anims.update(dt);

        // Move
        if (this.target !== null) {
            this.target.y = this.model.position.y;
            const moveDist = dt * this.speed;
            if (this.target.distanceTo(this.model.position) < moveDist) {
                this.model.position.copy(this.target);
                this.stopWalking();
            } else {
                this.model.position.add(this.target.clone()
                    .sub(this.model.position)
                    .normalize()
                    .multiplyScalar(moveDist));
            }

            const maxTurn = Math.PI * 1.3 * dt;
            let angle = this.model.rotation.y % (Math.PI * 2);
            let delta = this.targetAngle - angle;
            delta = ((delta + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) - Math.PI;
            angle += Math.max(-maxTurn, Math.min(delta, maxTurn));
            this.model.rotation.set(0, angle, 0);
        }

        // Spawn particles
        if (this.online) {
            this.particleTimer = Math.min(this.particleTimer + dt, 1);
            while (this.particleTimer > 0.1) {
                this.particleTimer -= 0.1;

                const particle = this.particleModel.clone();
                particle.userData.startPos = this.model.position.clone();
                particle.userData.startPos.y += 0.25 + Math.random();
                particle.userData.vel = new THREE.Vector3().randomDirection().multiplyScalar(Math.random() * 1);
                particle.userData.accel = new THREE.Vector3(0, 1, 0);
                particle.userData.age = 0;
                particle.userData.lifetime = 2;
                particle.userData.axis = new THREE.Vector3().randomDirection();
                this.particles.add(particle);
            }
        }

        // Move particles
        for (let i = this.particles.children.length - 1; i >= 0; i--) {
            const child = this.particles.children[i];
            child.userData.age += dt;
            const age = child.userData.age;
            const t = age / child.userData.lifetime;
            if (t > 1) {
                child.removeFromParent();
            } else {
                child.position.copy(child.userData.accel)
                    .multiplyScalar(age * 0.5)
                    .add(child.userData.vel)
                    .multiplyScalar(age)
                    .add(child.userData.startPos);
                child.setRotationFromAxisAngle(child.userData.axis, age * Math.PI * 4);

                const scl = Math.pow(t, 1 / 8) * (1 - t);
                child.scale.set(scl, scl, scl);
            }
        }

        // Show wave hint
        if (!this.online && !this.shownHint) {
            for (const player of this.game.networker.netPlayers.values()) {
                if (this.model.position.distanceTo(player.model.position) < 6) {
                    this.showHint();
                    break;
                }
            }
        }

        this.snapToGround();
    }

    showHint() {
        this.shownHint = true;
        this.showingHint = true;
        document.getElementById("hint").classList.remove("hint-hidden");
    }

    hideHint() {
        this.showingHint = false;
        document.getElementById("hint").classList.add("hint-hidden");
    }

    snapToGround() {
        this.raycaster.ray.origin.copy(this.model.position);
        this.raycaster.ray.origin.y += 1;
        this.raycaster.ray.direction.set(0, -1, 0);
        const intersections = this.raycaster.intersectObject(
            this.game.collision
        );
        if (intersections.length > 0) {
            this.model.position.copy(intersections[0].point);
            this.lastGoodPos.copy(this.model.position);
        } else {
            this.model.position.copy(this.lastGoodPos);
            if (this.target !== null)
                this.stopWalking();
        }
    }

    stopWalking() {
        this.target = null;
        this.clips.idle.enabled = true;
        this.clips.walk.enabled = true;
        this.clips.idle.crossFadeFrom(this.clips.walk, 0.2);
    }

    moveToPoint(point) {
        this.clips.wave.stop();
        if (this.target === null) {
            this.clips.idle.enabled = true;
            this.clips.walk.enabled = true;
            this.clips.walk.time = 0.5;
            this.clips.walk.crossFadeFrom(this.clips.idle, 0.3);
        }
        this.target = point.clone();
        this.targetAngle = Math.atan2(this.target.x - this.model.position.x, this.target.z - this.model.position.z);
    }

    wave() {
        if (this.target)
            this.stopWalking();

        this.clips.wave.weight = 1000;
        this.clips.wave.reset();
        this.clips.wave.play();

        if (!this.online && this.showingHint)
            this.hideHint();
    }

    teleportToPoint(point) {
        this.target = null;
        this.model.position.copy(point);
    }

    moveToMouse(x, y) {
        this.mouseRaycaster.setFromCamera(new THREE.Vector2(x, y), this.game.camera);
        const intersections = this.mouseRaycaster.intersectObject(this.game.collision);
        if (intersections.length > 0) {
            this.moveToPoint(intersections[0].point);
        }
    }
}

export { Character };
