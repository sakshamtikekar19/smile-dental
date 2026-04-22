import * as THREE from 'three';

/**
 * 3D ORTHODONTIC ENGINE (V8 - Bulletproof Silver & Alignment)
 * Removes fragile environment maps in favor of baked-in silver materials.
 * Adjusts the Y-axis drop to push brackets off the gums and onto the enamel.
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

        // 🔥 V8 FIX 1: BULLETPROOF LIGHTING
        // Massive ambient light ensures the brackets are bright silver no matter what.
        const ambientLight = new THREE.AmbientLight(0xffffff, 1.8); 
        this.scene.add(ambientLight);
        
        const dirLight = new THREE.DirectionalLight(0xffffff, 1.2);
        dirLight.position.set(0, 20, 50); 
        this.scene.add(dirLight);

        // 🔥 V8 FIX 2: BAKED-IN SILVER MATERIAL
        // Lower metalness (0.3) prevents the "black void" reflection bug.
        // Bright base color (0xdddddd) forces it to look like surgical steel.
        this.bracketMat = new THREE.MeshStandardMaterial({
            color: 0xdddddd,      
            metalness: 0.3,       
            roughness: 0.2,   
        });
        
        // Wire should be slightly darker than the brackets, but not black.
        this.wireMat = new THREE.MeshStandardMaterial({ 
            color: 0xaaaaaa, 
            metalness: 0.4, 
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

        // The base pad
        const padGeo = new THREE.BoxGeometry(1.0, 0.8, 0.2);
        const pad = new THREE.Mesh(padGeo, material);
        group.add(pad);

        // The 4 tie wings
        const wingGeo = new THREE.BoxGeometry(0.3, 0.3, 0.3);
        const wingPositions = [
            [-0.35, 0.25, 0.25], 
            [0.35, 0.25, 0.25],  
            [-0.35, -0.25, 0.25], 
            [0.35, -0.25, 0.25]  
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
        
        // Slightly bumped bracket scale from 0.035 to 0.04 for better legibility
        const bracketScale = mouthWidthPx * 0.04; 
        
        // 🔥 V8 FIX 3: THICKER WIRE
        // Increased from 0.0025 to 0.004 so it reads as a metal wire, not a thread.
        const wireRadius = mouthWidthPx * 0.004;
        
        // 🔥 V8 FIX 4: PUSHING DOWN OFF THE GUMS
        // Increased drop from 9% of mouth width to 12%.
        const dropOffset = mouthWidthPx * 0.12;

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
        
        // Push the wire just slightly forward
        this.upperWireMesh.position.z = bracketScale * 0.1; 
        this.scene.add(this.upperWireMesh);

        this.renderer.render(this.scene, this.camera);
        return this.renderer.domElement;
    }
}
