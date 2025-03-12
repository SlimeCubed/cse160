import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { BloomPass } from "three/addons/postprocessing/BloomPass.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
import { SavePass } from "three/addons/postprocessing/SavePass.js";
import { TexturePass } from "three/addons/postprocessing/TexturePass.js";
import { ClearPass } from "three/addons/postprocessing/ClearPass.js";
import { Character } from "./Character.js";
import { Networker } from "./Networker.js";

class Game {
    constructor(houseModel, treeModel, characterGltf, collisionModel, poleTex, sky) {
        // Set up camera and renderer
        this.maxCamDist = 20;
        const camera = new THREE.PerspectiveCamera(
            50,
            window.innerWidth / window.innerHeight,
            0.1,
            1000
        );

        const initPitch = Math.PI * 0.3;
        const initYaw = -Math.PI * 0.1;
        camera.rotation.set(initPitch, initYaw, 0);
        camera.position.set(Math.cos(initPitch) * Math.sin(initYaw), Math.sin(initPitch), Math.cos(initPitch) * Math.cos(initYaw)).multiplyScalar(this.maxCamDist);

        const renderer = new THREE.WebGLRenderer({
            antialias: true
        });
        renderer.debug.checkShaderErrors = false;
        renderer.shadowMap.enabled = true;
        renderer.shadowMap.autoUpdate = false;

        // Set up controls
        const controls = new OrbitControls(camera, renderer.domElement);
        controls.minDistance = 5;

        // Set up scene
        const scene = new THREE.Scene();
        const world = new THREE.Group();
        const collision = new THREE.Group();
        scene.add(world);
        this.enableShadows(houseModel);
        this.enableBackfaceCulling(houseModel);
        this.enableShadows(treeModel);
        this.enableAlphaClip(treeModel);
        this.enableShadows(characterGltf.scene);

        sky.mapping = THREE.EquirectangularReflectionMapping;
        sky.colorSpace = THREE.SRGBColorSpace;
        scene.background = sky;
        scene.backgroundIntensity = 0.1;

        for (let flip = 0; flip < 2; flip++) {
            for (let x = -10; x <= 10; x++) {
                let inst = houseModel.clone();
                inst.position.set(x * 25, 0, 0);
                inst.rotation.set(0, Math.PI * flip, 0);
                world.add(inst);

                inst = collisionModel.clone();
                inst.position.set(x * 25, 0, 0);
                inst.rotation.set(0, Math.PI * flip, 0);
                collision.add(inst);
            }
        }
        collision.updateMatrixWorld();

        for (let flip = 0; flip < 2; flip++) {
            for (let x = -10; x <= 10; x++) {
                let inst = treeModel.clone();
                inst.position.set(
                    x * 25 + 7 * (flip * 2 - 1),
                    -0.1,
                    18.18 * (flip * 2 - 1)
                );
                inst.rotation.set(0, Math.random() * Math.PI * 2, 0);
                inst.scale.multiplyScalar(0.4 + Math.random() * 0.2);
                world.add(inst);

                inst = treeModel.clone();
                inst.position.set(x * 25, 0, 53 * (flip * 2 - 1));
                inst.rotation.set(0, Math.random() * Math.PI * 2, 0);
                inst.scale.multiplyScalar(0.6 + Math.random() * 0.2);
                world.add(inst);
            }
        }

        const pole = this.makePole(poleTex);
        for (let x = -10; x <= 10; x++) {
            const inst = pole.clone();
            inst.position.set(x * 25 + 11.47, -0.8, 7);
            inst.rotation.set(0, Math.PI / 2, 0);
            world.add(inst);
        }

        const ambientLight = new THREE.AmbientLight(0x8888ff, 0.1);
        scene.add(ambientLight);

        const shadowRange = 60;
        const moonLight = new THREE.DirectionalLight(0xffffff, 0.05);
        moonLight.shadow.mapSize.set(2048, 2048);
        moonLight.shadow.camera.left = -shadowRange;
        moonLight.shadow.camera.right = shadowRange;
        moonLight.shadow.camera.bottom = -shadowRange;
        moonLight.shadow.camera.top = shadowRange;
        moonLight.shadow.camera.updateProjectionMatrix();

        scene.add(moonLight);
        scene.add(moonLight.target);
        moonLight.castShadow = true;

        this.characterGltf = characterGltf;
        this.moonLight = moonLight;
        this.scene = scene;
        this.world = world;
        this.collision = collision;
        this.ambientLight = ambientLight;
        this.camera = camera;
        this.renderer = renderer;
        this.controls = controls;
        this.networker = new Networker(this);

        // Set up post processing effects
        renderer.autoClearDepth = false;
        this.screenSize = new THREE.Vector2();
        this.renderer.getDrawingBufferSize(this.screenSize);
        this.bloomRt = new THREE.RenderTarget(this.screenSize.x, this.screenSize.y, { colorSpace: THREE.SRGBColorSpace, format: THREE.RGBAFormat });
        this.effectComposer = new EffectComposer(renderer);
        
        // Render whole scene to texture
        const mainRenderPass = new RenderPass(this.scene, camera);
        mainRenderPass.clear = true;
        mainRenderPass.clearDepth = true;
        this.effectComposer.addPass(new ClearPass());
        this.effectComposer.addPass(mainRenderPass);
        this.effectComposer.addPass(new SavePass(this.bloomRt));

        // Render just networked players to bloom texture
        const renderBloomPass = new RenderPass(this.networker.netPlayerGroup, camera, null, 0, 0);
        renderBloomPass.clear = true;
        renderBloomPass.clearDepth = true;
        this.effectComposer.addPass(renderBloomPass);
        this.effectComposer.addPass(new BloomPass(2, 25, 5));

        // Combine render targets
        const texturePass = new TexturePass(this.bloomRt.texture, 1);
        texturePass.material.blending = THREE.AdditiveBlending;
        this.effectComposer.addPass(texturePass);
        this.effectComposer.addPass(new OutputPass());

        this.time = performance.now();
        this.freeCam = false;

        this.player = new Character(this, characterGltf, new THREE.Vector3(0, 0, 9));
        this.player.addToScene(scene);

        this.addClickListeners();
    }

    addClickListeners() {
        let lastX = 0;
        let lastY = 0;

        this.renderer.domElement.addEventListener("mousedown", (event) => {
            lastX = event.clientX;
            lastY = event.clientY;
        });

        this.renderer.domElement.addEventListener("mouseup", (event) => {
            const dx = event.clientX - lastX;
            const dy = event.clientY - lastY;
            if (Math.sqrt(dx * dx + dy * dy) < 5) {
                this.player.moveToMouse(
                    (event.clientX / this.renderer.domElement.width) * 2 - 1,
                    (event.clientY / this.renderer.domElement.height) * -2 + 1
                );
                if (this.player.target) {
                    this.networker.walkTo(this.player.target);
                }
            }
        });

        // Go freecam when h is pressed
        document.addEventListener("keydown", (event) => {
            if (event.key === "v") {
                this.freeCam = !this.freeCam;
            }
            if (event.code === "Space") {
                this.player.wave();
                this.networker.wave();
            }
        });
    }

    resize(width, height) {
        this.effectComposer.setSize(width, height);
        this.renderer.setSize(width, height);
        this.camera.aspect = width / height;
        this.camera.updateProjectionMatrix();
    }

    update() {
        const time = performance.now() / 1000;
        const dt = time - this.time;
        this.time = time;

        this.renderer.getDrawingBufferSize(this.screenSize);
        if (this.bloomRt.width !== this.screenSize.x || this.bloomRt.height !== this.screenSize.y) {
            this.bloomRt.setSize(this.screenSize.x, this.screenSize.y);
        }

        this.networker.update(dt);
        this.player.update(dt);
        if (!this.freeCam) {
            this.controls.minPolarAngle = Math.PI * 0.05;
            this.controls.maxDistance = this.maxCamDist;
            
            const move = this.player.model.position.clone().sub(this.controls.target);
            move.y += 1.5;
            this.controls.target.add(move);
            this.camera.position.add(move);
            //this.controls.maxPolarAngle = Math.PI * 0.3 + Math.PI * 0.15 * (1 - this.camera.position.distanceTo(this.controls.target) / this.maxCamDist);
            this.controls.maxPolarAngle = Math.PI * 0.45;
        } else {
            this.controls.maxPolarAngle = Math.PI;
            this.controls.minPolarAngle = 0;
            this.controls.maxDistance = Infinity;
        }

        this.controls.update();
        this.moonLight.target.position.copy(this.player.model.position);
        this.moonLight.position.copy(this.player.model.position);
        this.moonLight.position.x += 1 * 10;
        this.moonLight.position.y += 3 * 10;
        this.moonLight.position.z += -1 * 10;
        
        //this.renderer.render(this.scene, this.camera);
        this.renderer.shadowMap.needsUpdate = true;
        this.effectComposer.render(dt);
    }

    enableBackfaceCulling(node) {
        if (node.material) node.material.side = THREE.FrontSide;

        for (const child of node.children) this.enableBackfaceCulling(child);
    }

    enableShadows(node) {
        if (node.castShadow === false) {
            node.castShadow = true;
            node.receiveShadow = true;
        }

        for (const child of node.children) this.enableShadows(child);
    }

    enableAlphaClip(node) {
        if (node.material) {
            node.material.alphaTest = 0.5;
        }

        for (const child of node.children) this.enableAlphaClip(child);
    }

    makeWire(length, radius, material, sag) {
        const geo = new THREE.CylinderGeometry(
            radius,
            radius,
            length,
            32,
            32,
            true
        );
        const pos = geo.getAttribute("position");
        for (let i = 0; i < pos.array.length; i += 3) {
            const t = (pos.array[i + 1] / length) * 2;
            pos.array[i + 1] += length / 2;
            pos.array[i + 2] += (1 - t * t) * sag;
        }
        pos.needsUpdate = true;
        return new THREE.Mesh(geo, material);
    }

    /**
     *
     * @param {THREE.Texture} tex
     * @returns
     */
    makePole(tex) {
        const cylinderGeo = new THREE.CylinderGeometry();
        const boxGeo = new THREE.BoxGeometry();
        const woodMat = new THREE.MeshStandardMaterial({ map: tex });
        const rubberMat = new THREE.MeshStandardMaterial({ color: 0x111111 });
        const metalMat = new THREE.MeshStandardMaterial({ color: 0xaaaaaa });
        tex.repeat.set(1, 4);
        tex.wrapT = THREE.RepeatWrapping;

        const group = new THREE.Group();

        const mainPole = new THREE.Mesh(cylinderGeo, woodMat);
        group.add(mainPole);
        mainPole.position.set(0, 5, 0);
        mainPole.scale.set(0.2, 10, 0.2);
        mainPole.castShadow = true;
        mainPole.receiveShadow = true;

        const bar = new THREE.Mesh(boxGeo, woodMat);
        group.add(bar);
        bar.position.set(0, 9.9, 0.2);
        bar.scale.set(4, 0.2, 0.1);
        bar.castShadow = true;
        bar.receiveShadow = true;

        const base = new THREE.Mesh(boxGeo, metalMat);
        group.add(base);
        base.position.set(0, 0, 0);
        base.scale.set(0.6, 0.5, 0.6);
        base.castShadow = true;
        base.receiveShadow = true;

        for (let x = -2; x <= 2; x++) {
            if (x === 0) continue;

            const spanWire = this.makeWire(25, 0.04, rubberMat, 1);
            group.add(spanWire);
            spanWire.position.set(x * 0.8, 10, 0.2);
            spanWire.rotation.set(Math.PI / 2, 0, 0);
            spanWire.castShadow = true;
        }

        return group;
    }

    static async load() {
        const gltfLoader = new GLTFLoader();
        const texLoader = new THREE.TextureLoader();
        
        const house = gltfLoader
        .loadAsync("models/house.glb")
        .then((x) => x.scene);
        const tree = gltfLoader
        .loadAsync("models/tree.glb")
        .then((x) => x.scene);
        const character = gltfLoader.loadAsync("models/character.glb");
        const collision = gltfLoader
        .loadAsync("models/collision.glb")
        .then((x) => x.scene);
        const pole = texLoader.loadAsync("models/pole.png");
        const sky = texLoader.loadAsync("models/sky.jpg");

        return new Game(
            await house,
            await tree,
            await character,
            await collision,
            await pole,
            await sky
        );
    }
}

export { Game };
