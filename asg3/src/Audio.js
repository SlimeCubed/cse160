class AudioManager {
    sounds = {
        /** @type {AudioBuffer | null} */ arrow_fire: null,
        /** @type {AudioBuffer | null} */ arrow_hit: null,
        /** @type {AudioBuffer | null} */ shatter_0: null,
        /** @type {AudioBuffer | null} */ shatter_1: null,
        /** @type {AudioBuffer | null} */ shatter_2: null,
        /** @type {AudioBuffer | null} */ flier_cry_0: null,
        /** @type {AudioBuffer | null} */ flier_cry_1: null,
        /** @type {AudioBuffer | null} */ flier_cry_2: null,
        /** @type {AudioBuffer | null} */ flier_cry_3: null,
        /** @type {AudioBuffer | null} */ flier_shoot_0: null,
        /** @type {AudioBuffer | null} */ flier_shoot_1: null,
        /** @type {AudioBuffer | null} */ flier_shoot_2: null,
        /** @type {AudioBuffer | null} */ flier_hum: null,
        /** @type {AudioBuffer | null} */ skitter: null,
        /** @type {AudioBuffer | null} */ boom_0: null,
        /** @type {AudioBuffer | null} */ boom_1: null,
        /** @type {AudioBuffer | null} */ boom_2: null,
    }

    constructor() {
    }

    start() {
        if (this._ctx) return;

        this._ctx = new AudioContext({
            latencyHint: "interactive"
        });
        this._loadSounds();
    }

    update() {
        if (!this._ctx) return;

        const listener = this._ctx.listener;
        listener.setPosition(
            camera.position.elements[0],
            camera.position.elements[1],
            camera.position.elements[2]
        );
        listener.setOrientation(
            camera.forward.elements[0],
            camera.forward.elements[1],
            camera.forward.elements[2],
            camera.up.elements[0],
            camera.up.elements[1],
            camera.up.elements[2]
        )
    }

    playPositioned(sound, gain, position, refDistance) {
        if (!sound || !this._ctx) return;

        const source = new AudioBufferSourceNode(this._ctx, {
            buffer: sound,
            loop: false
        });

        const panner = new PannerNode(this._ctx, {
            positionX: position.elements[0],
            positionY: position.elements[1],
            positionZ: position.elements[2],
            refDistance: refDistance
        });

        let gainer = null;
        if (gain !== 1) {
            gainer = new GainNode(this._ctx, {
                gain: gain
            });
        }

        source.connect(gainer || panner);
        if (gainer) gainer.connect(panner);
        panner.connect(this._ctx.destination);

        source.addEventListener("ended", () => {
            source.disconnect();
            panner.disconnect();
            if (gainer) gainer.disconnect();
        });

        source.start();

        return {
            source: source,
            pan: panner,
            gain: gainer
        };
    }

    playLoop(sound, gain, position, refDistance) {
        if (!sound || !this._ctx) return;

        const source = new AudioBufferSourceNode(this._ctx, {
            buffer: sound,
            loop: true
        });

        const panner = new PannerNode(this._ctx, {
            positionX: position.elements[0],
            positionY: position.elements[1],
            positionZ: position.elements[2],
            refDistance: refDistance
        });


        const gainer = new GainNode(this._ctx, {
            gain: gain
        });

        source.connect(gainer);
        gainer.connect(panner);
        panner.connect(this._ctx.destination);

        source.addEventListener("ended", () => {
            source.disconnect();
            panner.disconnect();
            if (gainer) gainer.disconnect();
        });

        source.start();
        return {
            source: source,
            pan: panner,
            gain: gainer,
            disconnect() {
                panner.disconnect(),
                gainer.disconnect(),
                source.disconnect()
            }
        };
    }

    playPanned(sound, gain, pan) {
        if (!sound || !this._ctx) return;

        const source = new AudioBufferSourceNode(this._ctx, {
            buffer: sound,
            loop: false
        });

        const panner = new StereoPannerNode(this._ctx, {
            pan: pan
        });

        let gainer = null;
        if (gain !== 1) {
            gainer = new GainNode(this._ctx, {
                gain: gain
            });
        }

        source.connect(gainer || panner);
        if (gainer) gainer.connect(panner);
        panner.connect(this._ctx.destination);

        source.addEventListener("ended", () => {
            source.disconnect();
            panner.disconnect();
            if (gainer) gainer.disconnect();
        });

        source.start();
    }

    get time() {
        return this._ctx.currentTime;
    }

    async _loadSound(url) {
        const file = await fetch(url);
        const buffer = await file.arrayBuffer();
        return await this._ctx.decodeAudioData(buffer);
    }

    async _loadSounds() {
        for (const key of Object.getOwnPropertyNames(this.sounds)) {
            this._loadSound("../audio/" + key + ".wav")
                .then(buffer => this.sounds[key] = buffer);
        }
    }
}
