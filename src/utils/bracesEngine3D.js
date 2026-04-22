import * as THREE from 'three';

/**
 * 3D ORTHODONTIC ENGINE (V6 - FULL PROPORTIONAL FIX)
 * Includes: Native Mobile HD, Dynamic Bracket Scaling, and Anatomical T-Values.
 */
export class Braces3DEngine {
    constructor(width, height) {
        this.width = width;
        this.height = height;

        this.scene = new THREE.Scene();
        this.camera = new THREE.OrthographicCamera(width / -2, width / 2, height / 2, height / -2, 0.1, 1000);
        this.camera.position.z = 100;

        this.renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
        // Force High-Definition rendering on mobile devices
        this.renderer.setPixelRatio(window.devicePixelRatio || 1); 
        this.renderer.setSize(width, height);
        this.renderer.setClearColor(0x000000, 0); 

        // Lighting
        const ambientLight = new THREE.AmbientLight(0xffffff, 1.2); 
        this.scene.add(ambientLight);
        const dirLight = new THREE.DirectionalLight(0xffffff, 1.0);
        dirLight.position.set(10, 20, 50); 
        this.scene.add(dirLight);

        // Materials (Calibrated so they don't glow pure white)
        this.bracketMat = new THREE.MeshStandardMaterial({
            color: 0xcccccc,      
            metalness: 0.4,       
            roughness: 0.3,       
        });
        
        this.wireMat = new THREE.MeshStandardMaterial({ 
            color: 0x666666, 
            metalness: 0.8, 
            roughness: 0.4 
        });

        this.upperBrackets = [];
        this.upperWireMesh = null;
        
        // Target only the 6 visible front teeth (Social 6)
        this.numBrackets = 6; 
        
        for (let i = 0; i < this.numBrackets; i++) {
            const upperMesh = this.createProportionalBracket(this.bracketMat);
            this.scene.add(upperMesh);
            this.upperBrackets.push(upperMesh);
        }
    }

    createProportionalBracket(material) {
        const group = new THREE.Group();

        // Base geometry is exactly 1x1x1 unit. 
        // We scale this dynamically in the render loop.
        const padGeo = new THREE.BoxGeometry(1.0, 1.0, 0.3);
        const pad = new THREE.Mesh(padGeo, material);
        group.add(pad);

        const slotGeo = new THREE.BoxGeometry(1.0, 0.3, 0.4);
        const slot = new THREE.Mesh(slotGeo, material);
        slot.position.z = 0.25; 
        group.add(slot);

        return group;
    }

    updateAndRender(landmarks, width, height) {
        if (!landmarks || landmarks.length === 0) return this.renderer.domElement;

        // Handle screen resizing
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

        // --- 1. DYNAMIC SCALING MATH ---
        // Measure exact mouth width on screen
        const leftCorner = landmarks[61];
        const rightCorner = landmarks[291];
        const mouthWidthPx = (rightCorner.x - leftCorner.x) * width;
        
        // Brackets will always be exactly 7% of mouth width
        const bracketScale = mouthWidthPx * 0.07; 
        const wireRadius = mouthWidthPx * 0.007;
        const dropOffset = mouthWidthPx * 0.09;

        // --- 2. BUILD THE ARCH CURVE ---
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

        // --- 3. ANATOMICAL PLACEMENT ---
        // Exact biological center points for the 6 front teeth
        const anatomicalTValues = [0.22, 0.35, 0.46, 0.54, 0.65, 0.78];
        
        anatomicalTValues.forEach((t, i) => {
            const bracket = this.upperBrackets[i];
            
            // Apply the dynamic scale
            bracket.scale.set(bracketScale, bracketScale, bracketScale);
            
            // Position and rotate
            bracket.position.copy(upperCurve.getPoint(t));
            const tangent = upperCurve.getTangent(t);
            bracket.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), tangent);
            bracket.rotateZ(Math.PI / 2); 
            bracket.rotateX(Math.PI / 2);
        });

        // --- 4. DYNAMIC WIRE ---
        if (this.upperWireMesh) {
            this.scene.remove(this.upperWireMesh);
            this.upperWireMesh.geometry.dispose();
        }

        const upperWireGeo = new THREE.TubeGeometry(upperCurve, 64, wireRadius, 8, false);
        this.upperWireMesh = new THREE.Mesh(upperWireGeo, this.wireMat);
        
        // Push wire forward so it sits inside the bracket slot
        this.upperWireMesh.position.z = bracketScale * 0.15; 
        this.scene.add(this.upperWireMesh);

        // --- 5. RENDER ---
        this.renderer.render(this.scene, this.camera);
        return this.renderer.domElement;
    }
}
