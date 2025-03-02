class Camera {
    constructor() {
        this.pitch = 0;
        this.yaw = 0;
        this.roll = 0;
        this.fov = 70;
        this.aspect = 1;

        this.up = new Vector4();
        this.right = new Vector4();
        this.forward = new Vector4();

        this.viewMatrix = new Matrix4();
        this.projectionMatrix = new Matrix4();
        this.position = new Vector3();
    }

    updateViewMatrix() {
        const p = this.position.elements;
        this.viewMatrix
            .setRotate(-this.roll, 0, 0, 1)
            .rotate(-this.pitch, 1, 0, 0)
            .rotate(-this.yaw, 0, 1, 0)
            .translate(-p[0], -p[1], -p[2]);

        const temp = getMat4().set(this.viewMatrix).transpose();
        
        this.up.elements[0] = 0;
        this.up.elements[1] = 1;
        this.up.elements[2] = 0;
        this.up = temp.multiplyVector4(this.up);

        this.right.elements[0] = 1;
        this.right.elements[1] = 0;
        this.right.elements[2] = 0;
        this.right = temp.multiplyVector4(this.right);

        this.forward.elements[0] = 0;
        this.forward.elements[1] = 0;
        this.forward.elements[2] = -1;
        this.forward = temp.multiplyVector4(this.forward);

        freeMat4(temp);
    }

    updateProjectionMatrix(aspect) {
        this.aspect = aspect;
        this.projectionMatrix.setPerspective(this.fov, aspect, 0.1, 10000);
    }
}
