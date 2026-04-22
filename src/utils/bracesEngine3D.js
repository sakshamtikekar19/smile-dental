import * as THREE from 'three';

/**
 * 3D ORTHODONTIC ENGINE (V7 - Photorealistic Hardware & Micro-Scaling)
 * Restores Twin Bracket geometry, Environmental Reflections, and true biological scaling.
 */
export class Braces3DEngine {
    constructor(width, height) {
        this.width = width;
        this.height = height;

        this.scene = new THREE.Scene();
        this.camera = new THREE.OrthographicCamera(width / -2, width / 2, height / 2, height / -2, 0.1, 1000);
        this.camera.position.z = 100;

        this.renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
        this.renderer.setPixelRatio(window.devicePixelRatio || 1); 
        this.renderer.setSize(width, height);
        this.renderer.setClearColor(0x000000, 0); 

        // 🔥 V7 FIX 1: RESTORE REFLECTIONS
        // Metal needs a room to reflect, otherwise it looks like flat grey plastic.
        const pmremGenerator = new THREE.PMREMGenerator(this.renderer);
        pmremGenerator.compileEquirectangularShader();
        const envScene = new THREE.Scene();
        envScene.background = new THREE.Color(0xffffff); // Pure white studio reflection
        this.scene.environment = pmremGenerator.fromScene(envScene).texture;

        const ambientLight = new THREE.AmbientLight(0xffffff, 0.8); 
        this.scene.add(ambientLight);
        const dirLight = new THREE.DirectionalLight(0xffffff, 1.5);
        dirLight.position.set(10, 50, 50); 
        this.scene.add(dirLight);

        // 🔥 V7 FIX 2: TRUE METALLIC MATERIALS
        // Base color is dark, but metalness is 1.0 so it reflects the white environment map
        this.bracketMat = new THREE.MeshStandardMaterial({
            color: 0x888888,      
            metalness: 1.0,       
            roughness: 0.15, // High gloss   
        });
        
        this.wireMat = new THREE.MeshStandardMaterial({ 
            color: 0x555555, 
            metalness: 1.0, 
            roughness: 0.3 
        });

        this.upperBrackets = [];
        this.upperWireMesh = null;
        
        this.numBrackets = 6; 
        
        for (let i = 0; i < this.numBrackets; i++) {
            const upperMesh = this.createRealisticTwinBracket(this.bracketMat);
            this.scene.add(upperMesh);
            this.upperBrackets.push(upperMesh);
        }
    }

    createRealisticTwinBracket(material) {
        const group = new THREE.Group();

        // 🔥 V7 FIX 3: RESTORE CLINICAL SHAPE (Normalized to 1.0 scale)
        // The base pad
        const padGeo = new THREE.BoxGeometry(1.0, 0.8, 0.2);
        const pad = new THREE.Mesh(padGeo, material);
        group.add(pad);

        // The 4 tie wings (creates the distinct "H" shape of a bracket)
        const wingGeo = new THREE.BoxGeometry(0.3, 0.3, 0.3);
        const wingPositions = [
            [-0.35, 0.25, 0.25], // Top Left
            [0.35, 0.25, 0.25],  // Top Right
            [-0.35, -0.25, 0.25], // Bottom Left
            [0.35, -0.25, 0.25]  // Bottom Right
        ];

        wingPositions.forEach(pos => {
            const wing = new THREE.Mesh(wingGeo, material);
            wing.position.set(pos[0], pos[1], pos[2]);
            group.add(wing);
        });

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

        const leftCorner = landmarks[61];
        const rightCorner = landmarks[291];
        const mouthWidthPx = (rightCorner.x - leftCorner.x) * width;
        
        // 🔥 V7 FIX 4: MICRO-SCALING
        // Cut the size in half. Brackets are now only 3.5% of the mouth width.
        const bracketScale = mouthWidthPx * 0.035; 
        const wireRadius = mouthWidthPx * 0.0025;
        const dropOffset = mouthWidthPx * 0.09;

        const upperIndices = [78, 191, 80, 81, 82, 13, 312, 311, 310, 415, 308];
        const upperPoints = [];
        upperIndices.forEach((idx, i) => {
            const lm = landmarks[idx];
            const tx = (lm.x * width) - (width / 2);
            let ty = (height / 2) - (lm.y * height);
            
            const distFromCenter = Math.abs((i / (upperIndices.length - 1)) - 0.5) * 2; 
            ty -= (dropOffset - (distFromCenter * (dropOffset * 0.4))); 
            upperPoints.push(new THREE.Vector3(tx, ty, 5 - (distFromCenter * (mouthWidthPx * 0.05))));
        });

        const upperCurve = new THREE.CatmullRomCurve3(upperPoints);

        // Slightly tightened the T-values so they sit perfectly on the front 6 teeth
        const anatomicalTValues = [0.28, 0.38, 0.47, 0.53, 0.62, 0.72];
        
        anatomicalTValues.forEach((t, i) => {
            const bracket = this.upperBrackets[i];
            
            bracket.scale.set(bracketScale, bracketScale, bracketScale);
            bracket.position.copy(upperCurve.getPoint(t));
            
            const tangent = upperCurve.getTangent(t);
            bracket.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), tangent);
            bracket.rotateZ(Math.PI / 2); 
            bracket.rotateX(Math.PI / 2);
        });

        if (this.upperWireMesh) {
            this.scene.remove(this.upperWireMesh);
            this.upperWireMesh.geometry.dispose();
        }

        const upperWireGeo = new THREE.TubeGeometry(upperCurve, 64, wireRadius, 8, false);
        this.upperWireMesh = new THREE.Mesh(upperWireGeo, this.wireMat);
        
        // Push the wire just slightly forward so it rests between the 4 tie wings
        this.upperWireMesh.position.z = bracketScale * 0.1; 
        this.scene.add(this.upperWireMesh);

        this.renderer.render(this.scene, this.camera);
        return this.renderer.domElement;
    }
}
