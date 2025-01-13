let v1 = new Vector3();
let v2 = new Vector3();
let v3 = new Vector3();
let v4 = new Vector3();
let ctx;

function drawVector(v, color) {
  ctx.lineWidth = 2;
  ctx.strokeStyle = color;
  ctx.beginPath();
  ctx.moveTo(200, 200);
  ctx.lineTo(200 + v.elements[0] * 20, 200 - v.elements[1] * 20);
  ctx.stroke();
}

function handleDrawEvent() {
  v1.elements[0] = document.getElementById("v1x").value;
  v1.elements[1] = document.getElementById("v1y").value;
  v2.elements[0] = document.getElementById("v2x").value;
  v2.elements[1] = document.getElementById("v2y").value;

  const op = document.getElementById("op").value;
  const scalar = document.getElementById("scalar").value;

  ctx.fillStyle = "black";
  ctx.fillRect(0, 0, 400, 400);

  drawVector(v1, "red");
  drawVector(v2, "blue");

  switch (op) {
    case "add":
    case "sub":
      v3.set(v1)[op](v2);
      drawVector(v3, "green");
      break;

    case "mul":
    case "div":
      v3.set(v1)[op](scalar);
      drawVector(v3, "green");
      v4.set(v2)[op](scalar);
      drawVector(v4, "green");
      break;

    case "magnitude":
      console.log("Magnitude v1: " + v1.magnitude());
      console.log("Magnitude v2: " + v2.magnitude());
      break;
    
    case "normalize":
      v3.set(v1).normalize();
      drawVector(v3, "green");
      v4.set(v2).normalize();
      drawVector(v4, "green");
      break;

    case "angle":
      const angleCos = Vector3.dot(v1, v2) / v1.magnitude() / v2.magnitude();
      const angle = Math.acos(angleCos) * 180 / Math.PI;
      console.log("Angle: " + angle + "°");
      break;

    case "area":
      const area = Vector3.cross(v1, v2).magnitude() / 2;
      console.log("Area of the triangle: " + area);
      break;
  }
}

function main() {
  // Retrieve <canvas> element <- (1)
  var canvas = document.getElementById("example");

  if (!canvas) {
    console.log("Failed to retrieve the <canvas> element");
    return;
  }

  // Get the rendering context for 2DCG <- (2)
  ctx = canvas.getContext("2d");

  handleDrawEvent();
}
