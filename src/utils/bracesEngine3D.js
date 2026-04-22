import * as THREE from 'three';

/**
 * 3D ORTHODONTIC ENGINE (V9 - Dual Arch Restoration)
 * Restores the lower dental arch (second wavy curve) while maintaining 
 * the Bulletproof Silver materials and proportional HD scaling.
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

        // Bulletproof Lighting
        const ambientLight = new THREE.AmbientLight(0xffffff, 1.8); 
        this.scene.add(ambientLight);
        
        const dirLight = new THREE.DirectionalLight(0xffffff, 1.2);
        dirLight.position.set(0, 20, 50); 
        this.scene.add(dirLight);

        // Bulletproof Silver Material
        this.bracketMat = new THREE.MeshStandardMaterial({
            color: 0xdddddd,      
            metalness: 0.3,       
            roughness: 0.2,   
        });
        
        this.wireMat = new THREE.MeshStandardMaterial({ 
            color: 0xaaaaaa, 
            metalness: 0.4, 
            roughness: 0.3 
        });

        // Arrays for BOTH arches
        this.upperBrackets = [];
        this.lowerBrackets = [];
        this.upperWireMesh = null;
        this.lowerWireMesh = null;
        
        this.numBrackets = 6; // 6 brackets per arch (The "Social 6" visible teeth)
        
        for (let i = 0; i < this.numBrackets; i++) {
            const upperMesh = this.createRealisticTwinBracket(this.bracketMat);
            const lowerMesh = this.createRealisticTwinBracket(this.bracketMat);
            this.scene.add(upperMesh);
            this.scene.add(lowerMesh);
            this.upperBrackets.push(upperMesh);
            this.lowerBrackets.push(lowerMesh);
        }
    }

    createRealisticTwinBracket(material) {
        const group = new THREE.Group();

        const padGeo = new THREE.BoxGeometry(1.0, 0.8, 0.2);
        const pad = new THREE.Mesh(padGeo, material);
        group.add(pad);

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

        // --- DYNAMIC SCALING MATH ---
        const leftCorner = landmarks[61];
        const rightCorner = landmarks[291];
        const mouthWidthPx = (rightCorner.x - leftCorner.x) * width;
        
        const bracketScale = mouthWidthPx * 0.04; 
        const wireRadius = mouthWidthPx * 0.004;
        
        // Upper drops down off the gum, Lower pushes up off the bottom gum
        const upperDropOffset = mouthWidthPx * 0.12;
        const lowerDropOffset = mouthWidthPx * 0.10;

        // --- UPPER ARCH CURVE ---
        const upperIndices = [78, 191, 80, 81, 82, 13, 312, 311, 310, 415, 308];
        const upperPoints = [];
        upperIndices.forEach((idx, i) => {
            const lm = landmarks[idx];
            const tx = (lm.x * width) - (width / 2);
            let ty = (height / 2) - (lm.y * height);
            const distFromCenter = Math.abs((i / (upperIndices.length - 1)) - 0.5) * 2; 
            
            ty -= (upperDropOffset - (distFromCenter * (upperDropOffset * 0.4))); 
            upperPoints.push(new THREE.Vector3(tx, ty, 5 - (distFromCenter * (mouthWidthPx * 0.05))));
        });

        // --- LOWER ARCH CURVE ---
        const lowerIndices = [78, 95, 88, 178, 87, 14, 317, 402, 318, 324, 308];
        const lowerPoints = [];
        lowerIndices.forEach((idx, i) => {
            const lm = landmarks[idx];
            const tx = (lm.x * width) - (width / 2);
            let ty = (height / 2) - (lm.y * height);
            const distFromCenter = Math.abs((i / (lowerIndices.length - 1)) - 0.5) * 2; 
            
            // Note the += here: we push the lower curve UP from the bottom lip
            ty += (lowerDropOffset - (distFromCenter * (lowerDropOffset * 0.4))); 
            lowerPoints.push(new THREE.Vector3(tx, ty, 5 - (distFromCenter * (mouthWidthPx * 0.05))));
        });

        const upperCurve = new THREE.CatmullRomCurve3(upperPoints);
        const lowerCurve = new THREE.CatmullRomCurve3(lowerPoints);

        // --- ANATOMICAL PLACEMENT ---
        // Upper teeth are wider, Lower teeth are narrower. 
        // We use slightly different T-values so they sit biologically correct.
        const upperTValues = [0.28, 0.38, 0.47, 0.53, 0.62, 0.72];
        const lowerTValues = [0.32, 0.40, 0.47, 0.53, 0.60, 0.68]; // Tighter together
        
        // Place Upper Brackets
        upperTValues.forEach((t, i) => {
            const bracket = this.upperBrackets[i];
            bracket.scale.set(bracketScale, bracketScale, bracketScale);
            bracket.position.copy(upperCurve.getPoint(t));
            const tangent = upperCurve.getTangent(t);
            bracket.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), tangent);
            bracket.rotateZ(Math.PI / 2); 
            bracket.rotateX(Math.PI / 2);
        });

        // Place Lower Brackets
        lowerTValues.forEach((t, i) => {
            const bracket = this.lowerBrackets[i];
            bracket.scale.set(bracketScale, bracketScale, bracketScale);
            bracket.position.copy(lowerCurve.getPoint(t));
            const tangent = lowerCurve.getTangent(t);
            bracket.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), tangent);
            bracket.rotateZ(Math.PI / 2); 
            bracket.rotateX(Math.PI / 2);
        });

        // --- DYNAMIC WIRES (BOTH CURVES) ---
        if (this.upperWireMesh) {
            this.scene.remove(this.upperWireMesh);
            this.upperWireMesh.geometry.dispose();
            this.scene.remove(this.lowerWireMesh);
            this.lowerWireMesh.geometry.dispose();
        }

        // Upper Wire
        const upperWireGeo = new THREE.TubeGeometry(upperCurve, 64, wireRadius, 8, false);
        this.upperWireMesh = new THREE.Mesh(upperWireGeo, this.wireMat);
        this.upperWireMesh.position.z = bracketScale * 0.1; 
        this.scene.add(this.upperWireMesh);

        // Lower Wire
        const lowerWireGeo = new THREE.TubeGeometry(lowerCurve, 64, wireRadius, 8, false);
        this.lowerWireMesh = new THREE.Mesh(lowerWireGeo, this.wireMat);
        this.lowerWireMesh.position.z = bracketScale * 0.1; 
        this.scene.add(this.lowerWireMesh);

        this.renderer.render(this.scene, this.camera);
        return this.renderer.domElement;
    }
}
