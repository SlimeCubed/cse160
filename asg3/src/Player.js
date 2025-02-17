class Player {
    constructor() {
        // Constants
        this.size = [0.75, 2.5, 0.75];
        this.maxCoyoteTime = 0.1;
        this.walkingSpeed = 5;
        this.flyingSpeed = 8;
        this.sneakingSpeed = 2;
        this.swimmingSpeed = 2;
        this.jumpVelocity = 6;
        this.exitWaterVelocity = 5;
        this.crouchRate = 8;
        this.dryOffRate = 1;
        this.wetRate = 5;
        this.chargeRate = 1;
        this.healthRegen = 0.1;
        this.maxInvulnTime = 0.6;
        this.drownGracePeriod = 4;
        this.drownDamage = 0.2;
        
        // Variables
        this.position = new Vector3();
        this.velocity = new Vector3();
        this.flying = true;
        this.grounded = false;
        this.canJump = 0;
        this.crouch = 0;
        this.wet = 0;
        this.inWater = false;
        this.againstWall = false;
        this.health = 1;
        this.invuln = 0;
        this.drown = 0;

        this.bow = new Bow();
        this.hurtOverlay = new HurtOverlay();
        this.hurtOverlay.r = 1;
        this.hurtOverlay.g = 0;
        this.hurtOverlay.b = 0;
    }
    
    update(dt) {
        if (!creative && this.flying) {
            this.velocity.sub(this.velocity);
            this.flying = false;
        }

        this.bow.update(dt);

        this.invuln = Math.max(0, this.invuln - dt);
        this.health = Math.min(1, this.health + this.healthRegen * dt);

        this.hurtOverlay.a = Math.pow(1 - this.health, 2) * 0.5 * (0.5 + this.invuln / this.maxInvulnTime * 0.5);

        // Crouch when down button pressed
        if (input.down)
            this.crouch = Math.min(this.crouch + dt * this.crouchRate, 1);
        else
            this.crouch = Math.max(this.crouch - dt * this.crouchRate, 0);

        // Swim
        this.wet = Math.max(this.wet - dt * this.dryOffRate, 0);
        this.inWater = this.position.elements[1] - this.size[1] / 2 < -0.5;
        if (!this.flying && this.inWater) {
            this.wet = Math.min(this.wet + dt * this.wetRate, 1);

            const delta = this.position.elements[1] + 0.5;
            this.velocity.elements[1] *= Math.pow(0.5, dt * 4);
            if (this.inWater && this.againstWall) {
                this.velocity.elements[1] = this.exitWaterVelocity;
            } else if (delta < 1) {
                this.velocity.elements[1] -= delta * 30 * dt - gravity * dt;
            }

            if (this.position.elements[1] + this.velocity.elements[1] * dt + 0.75 < -0.5)
                this.velocity.elements[1] = 3;
        }

        if (this.inWater && director.difficulty.level > 0) {
            this.drown += dt;
            if (this.drown > this.drownGracePeriod)
                this.hit(this.drownDamage);
        } else {
            this.drown = Math.max(this.drown - dt * 5, 0);
        }

        // Accelerate based on input
        const fwd = input.forward - input.back;
        const right = input.right - input.left;
        const yawRad = camera.yaw * Math.PI / 180;
        let moveX = Math.cos(yawRad) * right - Math.sin(yawRad) * fwd;
        let moveY = input.up - input.down;
        let moveZ = -Math.cos(yawRad) * fwd - Math.sin(yawRad) * right;

        // Normalize XZ motion
        let mag = Math.sqrt(moveX * moveX + moveZ * moveZ);
        if (mag > 1) {
            moveX /= mag;
            moveZ /= mag;
        }

        if (this.flying) {
            this.velocity.elements[0] = moveX;
            this.velocity.elements[1] = moveY;
            this.velocity.elements[2] = moveZ;
            this.velocity.mul(this.flyingSpeed);
        } else {
            const fac = Math.pow(0.5, dt * 60);
            let speed = this.walkingSpeed * (1 - this.crouch) + this.sneakingSpeed * this.crouch;
            speed *= (1 - this.wet) + this.wet * this.swimmingSpeed / this.walkingSpeed;
            this.velocity.elements[0] = this.velocity.elements[0] * fac + moveX * speed * (1 - fac);
            this.velocity.elements[2] = this.velocity.elements[2] * fac + moveZ * speed * (1 - fac);
        }

        this.canJump = Math.max(this.canJump - dt, 0);

        // Move based on velocity
        this.applyPhysics(dt);
    }

    applyPhysics(dt) {
        this.grounded = false;
        this.againstWall = false;
        if (player.flying) {
            this.moveNoclip(this.velocity.elements[0] * dt, this.velocity.elements[1] * dt, this.velocity.elements[2] * dt);
        } else {
            this.velocity.elements[1] -= dt * gravity;
            this.moveAndCollide(this.velocity.elements[0] * dt, this.velocity.elements[1] * dt, this.velocity.elements[2] * dt);
        }
    }

    moveNoclip(dx, dy, dz) {
        this.position.elements[0] += dx;
        this.position.elements[1] += dy;
        this.position.elements[2] += dz;
    }

    moveAndCollide(dx, dy, dz) {
        const moveResult = moveAndCollide(
            this.position.elements[0],
            this.position.elements[1],
            this.position.elements[2],
            this.size[0],
            this.size[1],
            this.size[2],
            dx, dy, dz
        );

        this.position.elements[0] = moveResult.x;
        this.position.elements[1] = moveResult.y;
        this.position.elements[2] = moveResult.z;
        
        if (moveResult.normalX !== 0) {
            this.againstWall = true;
            this.velocity.elements[0] = 0;
        }

        if (moveResult.normalY !== 0) {
            if (moveResult.normalY > 0) {
                this.grounded = true;
                this.canJump = this.maxCoyoteTime;
            }
            this.velocity.elements[1] = 0;
        }

        if (moveResult.normalZ !== 0) {
            this.againstWall = true;
            this.velocity.elements[2] = 0;
        }
    }

    jump() {
        this.velocity.elements[1] = this.jumpVelocity;
        this.grounded = false;
    }

    die() {
        this.health = 0;

        for (const enemy of enemies) {
            enemy.exploded();
        }
        director.reset();
    }

    hit(damage, ignoreInvuln) {
        if (this.invuln && !ignoreInvuln) return;

        this.health = Math.max(this.health - damage, 0);
        this.invuln = this.maxInvulnTime;

        applyScreenShake(damage * 0.25 + 0.25);

        if (this.health === 0)
            this.die();
    }

    render() {
        if (!creative)
            this.bow.render();
    }
}
