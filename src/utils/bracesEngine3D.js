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

        // --- 💡 THE REFLECTION FIX: ENVIRONMENT MAPPING ---
        // Metallic materials look black unless they have a room to reflect.
        // This generates a simple, bright studio environment map for the metal to reflect.
        const pmremGenerator = new THREE.PMREMGenerator(this.renderer);
        pmremGenerator.compileEquirectangularShader();
        const envScene = new THREE.Scene();
        envScene.background = new THREE.Color(0xffffff); // Bright white reflection
        this.scene.environment = pmremGenerator.fromScene(envScene).texture;

        const hemiLight = new THREE.HemisphereLight(0xffffff, 0x666666, 1.5);
        this.scene.add(hemiLight);
        
        const dirLight = new THREE.DirectionalLight(0xffffff, 2.0);
        dirLight.position.set(20, 50, 50); // Angled for sharp glints
        this.scene.add(dirLight);

        // --- 🛠️ HIGH-FIDELITY MATERIALS ---
        this.bracketMat = new THREE.MeshStandardMaterial({
            color: 0xeeeeee,      // Brighter surgical steel
            metalness: 1.0,       // 100% metal (requires environment map)
            roughness: 0.25,      // Slightly brushed so it isn't a perfect mirror
        });
        
        // Wire should be slightly darker and thinner
        this.wireMat = new THREE.MeshStandardMaterial({ 
            color: 0xcccccc, 
            metalness: 1.0, 
            roughness: 0.3 
        });

        this.upperBrackets = [];
        this.lowerBrackets = [];
        this.upperWireMesh = null;
        this.lowerWireMesh = null;
        
        this.numBrackets = 10; 
        
        for (let i = 0; i < this.numBrackets; i++) {
            // Use our new procedural bracket builder instead of a single box
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

        // 1. The Base Pad (Glues to the tooth)
        const padGeo = new THREE.BoxGeometry(6.5, 5, 1);
        const pad = new THREE.Mesh(padGeo, material);
        group.add(pad);

        // 2. The Four Tie Wings
        const wingGeo = new THREE.BoxGeometry(2, 1.8, 2);
        
        // Positioned to leave a horizontal "slot" in the middle for the wire
        const wingPositions = [
            [-1.8, 1.5, 1.5],  // Top Left
            [1.8, 1.5, 1.5],   // Top Right
            [-1.8, -1.5, 1.5], // Bottom Left
            [1.8, -1.5, 1.5]   // Bottom Right
        ];

        wingPositions.forEach(pos => {
            const wing = new THREE.Mesh(wingGeo, material);
            wing.position.set(pos[0], pos[1], pos[2]);
            group.add(wing);
        });

        // Scale the entire group down slightly to fit the mouth naturally
        group.scale.set(0.85, 0.85, 0.85);

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

        // Reduced wire radius from 0.6 to 0.25 to sit neatly inside the bracket slot
        const upperWireGeo = new THREE.TubeGeometry(upperCurve, 64, 0.25, 8, false);
        this.upperWireMesh = new THREE.Mesh(upperWireGeo, this.wireMat);
        
        // Push the wire forward slightly so it sits IN the slot, not behind the bracket
        this.upperWireMesh.position.z = 1.0; 
        this.scene.add(this.upperWireMesh);

        const lowerWireGeo = new THREE.TubeGeometry(lowerCurve, 64, 0.25, 8, false);
        this.lowerWireMesh = new THREE.Mesh(lowerWireGeo, this.wireMat);
        this.lowerWireMesh.position.z = 1.0;
        this.scene.add(this.lowerWireMesh);

        this.renderer.render(this.scene, this.camera);
        return this.renderer.domElement;
    }
}
