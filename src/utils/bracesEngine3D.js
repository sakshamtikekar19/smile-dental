import * as THREE from 'three';

/**
 * 3D ORTHODONTIC ENGINE (V6 - THE ANATOMICAL HARD FIX)
 * Forces brackets onto specific tooth centers using biological proportion arrays.
 * Uses dynamic scaling to ensure the archwire sits in the exact center of the teeth.
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

        // Bright, clean lighting
        const ambientLight = new THREE.AmbientLight(0xffffff, 1.2); 
        this.scene.add(ambientLight);
        const dirLight = new THREE.DirectionalLight(0xffffff, 1.0);
        dirLight.position.set(10, 20, 50); 
        this.scene.add(dirLight);

        // Darker surgical steel to prevent glowing
        this.bracketMat = new THREE.MeshStandardMaterial({
            color: 0x999999,      
            metalness: 0.8,       
            roughness: 0.3,       
        });
        
        this.wireMat = new THREE.MeshStandardMaterial({ 
            color: 0x666666, 
            metalness: 1.0, 
            roughness: 0.4 
        });

        this.upperBrackets = [];
        this.upperWireMesh = null;
        
        // 🔥 HARD FIX 1: Only 6 brackets. 
        // Trying to put braces on the molars causes clipping. 6 targets the visible "Social 6" teeth perfectly.
        this.numBrackets = 6; 
        
        for (let i = 0; i < this.numBrackets; i++) {
            const upperMesh = this.createMicroBracket(this.bracketMat);
            this.scene.add(upperMesh);
            this.upperBrackets.push(upperMesh);
        }
    }

    createMicroBracket(material) {
        const group = new THREE.Group();

        // 🔥 HARD FIX 2: Micro-Geometry. 
        // Width is 2.2. They will never touch each other now.
        const padGeo = new THREE.BoxGeometry(2.2, 2.5, 0.8);
        const pad = new THREE.Mesh(padGeo, material);
        group.add(pad);

        // Tiny raised wire slot
        const slotGeo = new THREE.BoxGeometry(2.2, 0.8, 1.0);
        const slot = new THREE.Mesh(slotGeo, material);
        slot.position.z = 0.5; 
        group.add(slot);

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

        // 🔥 HARD FIX 3: Dynamic Mouth Scaling
        // We measure how wide the mouth is on the screen to calculate exactly how far down the teeth are.
        const leftCorner = landmarks[61];
        const rightCorner = landmarks[291];
        const mouthWidthPx = (rightCorner.x - leftCorner.x) * width;
        
        // The center of the teeth is generally 9% of the mouth width below the upper lip.
        const dropOffset = mouthWidthPx * 0.09;

        // --- UPPER ARCH ---
        const upperIndices = [78, 191, 80, 81, 82, 13, 312, 311, 310, 415, 308];
        const upperPoints = [];
        upperIndices.forEach((idx, i) => {
            const lm = landmarks[idx];
            const tx = (lm.x * width) - (width / 2);
            let ty = (height / 2) - (lm.y * height);
            
            const distFromCenter = Math.abs((i / (upperIndices.length - 1)) - 0.5) * 2; 
            
            // Apply the dynamic drop, curving slightly up at the corners
            ty -= (dropOffset - (distFromCenter * (dropOffset * 0.4))); 
            
            upperPoints.push(new THREE.Vector3(tx, ty, 5 - (distFromCenter * 8)));
        });

        const upperCurve = new THREE.CatmullRomCurve3(upperPoints);

        // 🔥 HARD FIX 4: Biological Tooth Spacing (The T-Values)
        // Instead of dividing by math, we manually tell the engine where the teeth actually are.
        // Left Canine (0.22), Left Lateral (0.35), Left Central (0.46), Right Central (0.54), Right Lateral (0.65), Right Canine (0.78)
        const anatomicalTValues = [0.22, 0.35, 0.46, 0.54, 0.65, 0.78];

        for (let i = 0; i < this.numBrackets; i++) {
            const t = anatomicalTValues[i]; 
            const bracket = this.upperBrackets[i];
            
            bracket.position.copy(upperCurve.getPoint(t));
            const tangent = upperCurve.getTangent(t);
            const axis = new THREE.Vector3(0, 1, 0);
            bracket.quaternion.setFromUnitVectors(axis, tangent);
            bracket.rotateZ(Math.PI / 2); 
            bracket.rotateX(Math.PI / 2);
        }

        // --- DYNAMIC WIRE ---
        if (this.upperWireMesh) {
            this.scene.remove(this.upperWireMesh);
            this.upperWireMesh.geometry.dispose();
        }

        // Ultra thin wire (0.15)
        const upperWireGeo = new THREE.TubeGeometry(upperCurve, 64, 0.15, 8, false);
        this.upperWireMesh = new THREE.Mesh(upperWireGeo, this.wireMat);
        this.upperWireMesh.position.z = 0.8; 
        this.scene.add(this.upperWireMesh);

        this.renderer.render(this.scene, this.camera);
        return this.renderer.domElement;
    }
}
