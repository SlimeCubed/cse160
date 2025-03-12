import { Game } from "./Game.js";

Game.load().then(function (game) {
    window.game = game;
    document.body.appendChild(game.renderer.domElement);

    function resize() {
        game.resize(window.innerWidth, window.innerHeight);
    }
    window.addEventListener("resize", resize);
    resize();

    game.renderer.setAnimationLoop(game.update.bind(game));
});
