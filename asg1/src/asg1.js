// Vertex shader program
const VSHADER_SOURCE = `
attribute vec4 a_Position;
uniform float u_PointSize;

void main() {
    gl_Position = a_Position;
    gl_PointSize = u_PointSize;
}
`;

// Fragment shader program
const FSHADER_SOURCE = `
uniform lowp vec4 u_Color;

void main() {
    gl_FragColor = u_Color;
}
`;

// Globals
let canvas = null;
let gl = null;
let a_Position = null;
let u_Color = null;
let u_PointSize = null;
let shapes = [];

const inputRed = document.getElementById("red");
const inputGreen = document.getElementById("green");
const inputBlue = document.getElementById("blue");
const inputSize = document.getElementById("size");
const inputVerts = document.getElementById("verts");
const inputBrush = document.getElementById("brush");

function setupWebGL() {
    canvas = document.getElementById("webgl");
    gl = canvas.getContext("webgl");

    if (!gl) {
        console.error("Failed to get the rendering context for WebGL");
        return;
    }
}

function connectVariablesToGLSL() {
    // Initialize shaders
    if (!initShaders(gl, VSHADER_SOURCE, FSHADER_SOURCE)) {
        console.error("Failed to initialize shaders");
        return;
    }

    // Find attribute locations
    a_Position = gl.getAttribLocation(gl.program, "a_Position");
    if (a_Position < 0) {
        console.error("Failed to get the storage location of a_Position");
        return;
    }

    // Find uniform locations
    u_Color = gl.getUniformLocation(gl.program, "u_Color");
    if (u_Color < 0) {
        console.error("Failed to get the storage location of u_Color");
        return;
    }

    u_PointSize = gl.getUniformLocation(gl.program, "u_PointSize");
    if (u_PointSize < 0) {
        console.error("Failed to get the storage location of u_PointSize");
        return;
    }
}

function renderAllShapes() {
    // Clear canvas
    gl.clear(gl.COLOR_BUFFER_BIT);
    
    // Draw all shapes
    for (const shape of shapes) {
        shape.render();
    }
}

function clearShapes() {
    for (const shape of shapes) {
        if (shape.cleanup)
            shape.cleanup();
    }
    shapes = [];

    renderAllShapes();
}

function addShape(event) {
    let x = event.clientX; // x coordinate of a mouse pointer
    let y = event.clientY; // y coordinate of a mouse pointer
    const rect = event.target.getBoundingClientRect();

    x = (x - rect.left - canvas.height / 2) / (canvas.height / 2);
    y = (canvas.width / 2 - (y - rect.top)) / (canvas.width / 2);

    // Add a new point to draw
    const r = inputRed.value / 255;
    const g = inputGreen.value / 255;
    const b = inputBlue.value / 255;
    const size = inputSize.value;
    const verts = inputVerts.value;
    const brush = inputBrush.value;
    switch (brush) {
        case "square": shapes.push(new Point(x, y, r, g, b, size)); break;
        case "triangle": shapes.push(new Triangle(x, y, r, g, b, size)); break;
        case "circle": shapes.push(new Circle(x, y, r, g, b, size, verts)); break;
        case "jelly":
            if (JellySquare.canPlace(x, y, size))
                shapes.push(new JellySquare(x, y, r, g, b, size, verts));
            break;
    }

    renderAllShapes();
}

function stepJellies() {
    if (JellySquare.jellies.length > 0) {
        renderAllShapes();
    }
    for (const jelly of JellySquare.jellies) {
        jelly.applyForces();
    }
    for (const jelly of JellySquare.jellies) {
        jelly.step();
    }
}

function main() {
    setupWebGL();
    connectVariablesToGLSL();

    // Set the color for clearing canvas
    gl.clearColor(0.0, 0.0, 0.0, 1.0);
    renderAllShapes();

    // Listen for clicks
    canvas.addEventListener("mousedown", addShape);
    canvas.addEventListener("mousemove", (event) => {
        if (event.buttons !== 0)
            addShape(event);
    });

    // Start physics simulation
    setInterval(stepJellies, 1000 / JellySquare.stepsPerSecond);
}
