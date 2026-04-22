import * as THREE from 'three';

/**
 * 3D ORTHODONTIC ENGINE (V4 - High-Fidelity Clinical Hardware)
 * Upgrades geometry from basic boxes to procedural 'Twin Brackets' and 
 * implements Environment Mapping for true metallic reflections.
 */
export class Braces3DEngine {
    constructor(width, height) {
        this.width = width;
        this.height = height;

        this.scene = new THREE.Scene();
        this.camera = new THREE.OrthographicCamera(width / -2, width / 2, height / 2, height / -2, 0.1, 1000);
        this.camera.position.z = 100;

        this.renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
        this.renderer.setSize(width, height);
        this.renderer.setClearColor(0x000000, 0); 

        // 1. LIGHTING CALIBRATION
        const pmremGenerator = new THREE.PMREMGenerator(this.renderer);
        pmremGenerator.compileEquirectangularShader();
        const envScene = new THREE.Scene();
        envScene.background = new THREE.Color(0xdddddd); // Slightly dimmed environment
        this.scene.environment = pmremGenerator.fromScene(envScene).texture;

        // Dialed down the intensity so it doesn't glow like a lightbulb
        const hemiLight = new THREE.HemisphereLight(0xffffff, 0x444444, 0.8); 
        this.scene.add(hemiLight);
        
        const dirLight = new THREE.DirectionalLight(0xffffff, 1.2);
        dirLight.position.set(20, 50, 50); 
        this.scene.add(dirLight);

        // 2. MATERIAL CALIBRATION
        // Real surgical steel is actually quite dark; it only looks bright where light hits it.
        this.bracketMat = new THREE.MeshStandardMaterial({
            color: 0x7a7a7a,      // Darker base steel
            metalness: 1.0,       // 100% reflective
            roughness: 0.35,      // Slightly more frosted so it isn't a blinding mirror
        });
        
        this.wireMat = new THREE.MeshStandardMaterial({ 
            color: 0x555555,      // Wire should be visibly darker than the brackets
            metalness: 1.0, 
            roughness: 0.4 
        });

        this.upperBrackets = [];
        this.lowerBrackets = [];
        this.upperWireMesh = null;
        this.lowerWireMesh = null;
        
        this.numBrackets = 10; 
        
        for (let i = 0; i < this.numBrackets; i++) {
            const upperMesh = this.createClinicalBracket(this.bracketMat);
            const lowerMesh = this.createClinicalBracket(this.bracketMat);
            this.scene.add(upperMesh);
            this.scene.add(lowerMesh);
            this.upperBrackets.push(upperMesh);
            this.lowerBrackets.push(lowerMesh);
        }
    }

    /**
     * PROCEDURAL TWIN-BRACKET GENERATOR
     * Recreates the complex anatomy of a real orthodontic bracket.
     */
    createClinicalBracket(material) {
        const group = new THREE.Group();

        // 3. GEOMETRY CALIBRATION (Curing the "Zipper" effect)
        // Shrunk the width of the pad from 6.5 down to 3.5. 
        // This guarantees empty space between brackets so the wire is visible.
        const padGeo = new THREE.BoxGeometry(3.5, 4, 0.5);
        const pad = new THREE.Mesh(padGeo, material);
        group.add(pad);

        // Tiny tie wings
        const wingGeo = new THREE.BoxGeometry(1.2, 1.2, 1);
        
        const wingPositions = [
            [-1.0, 1.2, 0.8],  
            [1.0, 1.2, 0.8],   
            [-1.0, -1.2, 0.8], 
            [1.0, -1.2, 0.8]   
        ];

        wingPositions.forEach(pos => {
            const wing = new THREE.Mesh(wingGeo, material);
            wing.position.set(pos[0], pos[1], pos[2]);
            group.add(wing);
        });

        // Scale down the entire assembly slightly
        group.scale.set(0.9, 0.9, 0.9);

        return group;
    }

    updateAndRender(landmarks, width, height) {
        if (!landmarks || landmarks.length === 0) return this.renderer.domElement;

        if (this.width !== width || this.height !== height) {
            this.width = width;
            this.height = height;
            this.renderer.setSize(width, height);
            this.camera.left = width / -2;
            this.camera.right = width / 2;
            this.camera.top = height / 2;
            this.camera.bottom = height / -2;
            this.camera.updateProjectionMatrix();
        }

        // --- UPPER ARCH ---
        const upperIndices = [78, 191, 80, 81, 82, 13, 312, 311, 310, 415, 308];
        const upperPoints = [];
        upperIndices.forEach((idx, i) => {
            const lm = landmarks[idx];
            const tx = (lm.x * width) - (width / 2);
            let ty = (height / 2) - (lm.y * height);
            const distFromCenter = Math.abs((i / (upperIndices.length - 1)) - 0.5) * 2; 
            ty -= (14 - (distFromCenter * 10)); 
            upperPoints.push(new THREE.Vector3(tx, ty, 5 - (distFromCenter * 4)));
        });

        // --- LOWER ARCH ---
        const lowerIndices = [78, 95, 88, 178, 87, 14, 317, 402, 318, 324, 308];
        const lowerPoints = [];
        lowerIndices.forEach((idx, i) => {
            const lm = landmarks[idx];
            const tx = (lm.x * width) - (width / 2);
            let ty = (height / 2) - (lm.y * height);
            const distFromCenter = Math.abs((i / (lowerIndices.length - 1)) - 0.5) * 2; 
            ty += (12 - (distFromCenter * 8)); 
            lowerPoints.push(new THREE.Vector3(tx, ty, 5 - (distFromCenter * 4)));
        });

        const upperCurve = new THREE.CatmullRomCurve3(upperPoints);
        const lowerCurve = new THREE.CatmullRomCurve3(lowerPoints);

        const placeBrackets = (brackets, curve) => {
            for (let i = 0; i < this.numBrackets; i++) {
                const t = 0.12 + (i / (this.numBrackets - 1)) * 0.76; 
                const bracket = brackets[i];
                
                bracket.position.copy(curve.getPoint(t));
                const tangent = curve.getTangent(t);
                const axis = new THREE.Vector3(0, 1, 0);
                bracket.quaternion.setFromUnitVectors(axis, tangent);
                bracket.rotateZ(Math.PI / 2); 
                bracket.rotateX(Math.PI / 2);
            }
        };

        placeBrackets(this.upperBrackets, upperCurve);
        placeBrackets(this.lowerBrackets, lowerCurve);

        // --- ULTRA-THIN WIRES ---
        if (this.upperWireMesh) {
            this.scene.remove(this.upperWireMesh);
            this.upperWireMesh.geometry.dispose();
            this.scene.remove(this.lowerWireMesh);
            this.lowerWireMesh.geometry.dispose();
        }

        // Reduced wire radius from 0.6 to 0.15 to sit neatly inside the bracket slot
        const upperWireGeo = new THREE.TubeGeometry(upperCurve, 64, 0.15, 8, false);
        this.upperWireMesh = new THREE.Mesh(upperWireGeo, this.wireMat);
        
        // Push the wire forward slightly so it sits IN the slot, not behind the bracket
        this.upperWireMesh.position.z = 1.0; 
        this.scene.add(this.upperWireMesh);

        const lowerWireGeo = new THREE.TubeGeometry(lowerCurve, 64, 0.15, 8, false);
        this.lowerWireMesh = new THREE.Mesh(lowerWireGeo, this.wireMat);
        this.lowerWireMesh.position.z = 1.0;
        this.scene.add(this.lowerWireMesh);

        this.renderer.render(this.scene, this.camera);
        return this.renderer.domElement;
    }
}
