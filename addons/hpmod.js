const healthBarAddon = () => {
    const console = { ...window.console };

    function isObject3D(obj) {
        return "id" in obj && "name" in obj;
    }

    function isScene(obj, name) {
        return obj.name === name && "WwnMNmWw" in obj && "WwWmnN" in obj;
    }

    function isMesh(obj) {
        return "WwwNWMm" in obj;
    }

    function isPlayerMesh(mesh) {
        return mesh.name === "Head";
    }

    function isHealthMaterial(material) {
        const canvas = material.map?.image;
        const skyboxHeight = 1024;
        return canvas instanceof HTMLCanvasElement && canvas.height !== skyboxHeight;
    }

    const window_WeakMap = window.WeakMap;
    window.WeakMap = class extends window_WeakMap {
        #once = false;
        #cache = new Set();

        set(obj) {
            const callback = () => super.set.apply(this, arguments);

            try {
                if (this.#once || !(isObject3D(obj) && isScene(obj, ""))) {
                    return callback();
                }
                this.#once = true;

                const scene = obj;
                console.log("scene", scene);

                let playerMesh = undefined;

                const traverse = (obj) => {
                    if (this.#cache.has(obj.id)) {
                        return;
                    }
                    this.#cache.add(obj.id);

                    if (!isMesh(obj)) {
                        return;
                    }

                    if (isPlayerMesh(obj)) {
                        playerMesh = obj;
                        return;
                    }

                    const healthMat = obj.WwwNWMm;
                    if (playerMesh === undefined || !isHealthMaterial(healthMat)) {
                        return;
                    }

                    const context = healthMat.map.image.getContext("2d");
                    if (context === null) {
                        console.error("context === null");
                        return;
                    }

                    let uniforms = undefined;
                    const radiance = { r: 0, g: 1, b: 0 };
                    let callCount = 0;

                    const context_fillRect = context.fillRect;
                    context.fillRect = function (_x, _y, width, _height) {
                        callCount++;
                        const maxHealth = context.canvas.width;
                        const health = Math.max(0, Math.min(1, width / maxHealth));

                        // DEBUG: log every call so we can see if/when width changes
                        console.log("fillRect call #" + callCount, { width, maxHealth, health });

                        radiance.r = 1 - health;
                        radiance.g = health;

                        if (uniforms !== undefined) {
                            uniforms.radiance = { value: radiance };
                        }

                        return context_fillRect.apply(this, arguments);
                    };

                    function replace(source, target, patch) {
                        const prefix = "\n// @pseudoical\n";
                        const suffix = "\n// ===========\n";
                        const watermark = prefix + patch.trim() + suffix;
                        return source.replace(target, watermark);
                    }

                    const playerMat = playerMesh.WwwNWMm;
                    playerMat.wmwWNMn = function (shader) {
                        uniforms = shader.WwWnmM;
                        uniforms.radiance = { value: radiance };

                        const fragmentShader = shader.wMnmWN;
                        const target = "void main() {";
                        shader.wMnmWN = replace(fragmentShader, target, `
uniform vec3 radiance;
void main() {
    gl_FragColor = vec4(radiance, 1.0);
    return;
`);
                    };

                    playerMat.WwnWwN = () => playerMat.id.toString();
                    playerMat.wwWMW = true;
                }

                scene.WwWmnN(traverse);

                const scene_add = scene.WwnMNmWw;
                scene.WwnMNmWw = function (obj) {
                    const result = scene_add.apply(this, arguments);
                    const callback = () => result;

                    try {
                        if (!isMesh(obj)) {
                            return callback();
                        }

                        const material = obj.WwwNWMm;
                        if (isHealthMaterial(material)) {
                            scene.WwWmnN(traverse);
                        }
                    } catch { }

                    return callback();
                };
            } catch { }

            return callback();
        }
    };

    console.log("%cHealth Bar Mod by %c@pseudoical", "color: yellow;", "color: lime;");
};

// Export for use in main file
module.exports = { healthBarAddon };