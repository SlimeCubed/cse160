import * as THREE from "three";
import { Character } from "./Character.js";

class Networker {
    /**
     * @param {Game} game 
     */
    constructor (game) {
        this.game = game;
        this.wsServerUrl = "wss://webrtc-multiplayer-demo.glitch.me/";
        this.ws = null;
        this.netPlayers = new Map();
        this.netPlayerGroup = new THREE.Group();
        this.game.scene.add(this.netPlayerGroup);
        this.connect();
    }

    walkTo(pos) {
        this.send({ type: "walk", x: pos.x, y: pos.y, z: pos.z });
    }

    teleportTo(pos) {
        this.send({ type: "teleport", x: pos.x, y: pos.y, z: pos.z });
    }

    wave() {
        this.send({ type: "wave" });
    }

    send(msg) {
        this.ws.send(JSON.stringify(msg));
    }
    
    onOpen(ws) {
        this.ws = ws;
        this.teleportTo(this.game.player.model.position);
    }

    onMessage(msg) {
        /** @type {Character | undefined} */
        let player = this.netPlayers.get(msg.id);
        switch (msg.type) {
            case "teleport":
            case "walk":
                const pos = new THREE.Vector3(msg.x, msg.y, msg.z);
                if (!player) {
                    player = new Character(this.game, this.game.characterGltf, pos, true);
                    player.addToScene(this.netPlayerGroup);
                    this.netPlayers.set(msg.id, player);
                } else if (msg.type === "walk") {
                    player.moveToPoint(pos);
                } else if (msg.type === "teleport") {
                    player.teleportToPoint(pos);
                }
                break;

            case "wave":
                if (player)
                    player.wave();
                break;

            case "leave":
                if (player)
                    player.removeFromScene();
                break;
        }
    }
    
    connect() {
        const ws = new WebSocket(this.wsServerUrl);
    
        ws.addEventListener("open", (event) => console.log("[open] " + JSON.stringify(event)));
        ws.addEventListener("close", (event) => console.log("[close] " + event.code + " " + event.reason));
        ws.addEventListener("error", (event) => console.error("[error]", event));
        ws.addEventListener("message", (event) => this.onMessage(JSON.parse(event.data)));
    
        ws.addEventListener("open", () => this.onOpen(ws));
    }

    update(dt) {
        for (const player of this.netPlayers.values())
            player.update(dt);
    }
}

export { Networker };
