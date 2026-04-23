import * as THREE from 'three';

/**
 * 3D ORTHODONTIC ENGINE (V11 - The True Arch Fix)
 * - Fixes the mathematical "Curve Flattening" inversion bug on the lower arch.
 * - Widens the T-Values so brackets sit on the teeth, not bunched in the center.
 * - Warms up the material colors to prevent WebGL blue-tinting.
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

        const ambientLight = new THREE.AmbientLight(0xffffff, 1.8); 
        this.scene.add(ambientLight);
        const dirLight = new THREE.DirectionalLight(0xffffff, 1.2);
        dirLight.position.set(0, 20, 50); 
        this.scene.add(dirLight);

        // 🔥 FIX 1: WARMER MATERIALS (Kills the Blue Tint)
        this.bracketMat = new THREE.MeshStandardMaterial({
            color: 0xe8e8e8, // Slightly warmer/brighter silver
            metalness: 0.4, 
            roughness: 0.2,   
        });
        
        this.wireMat = new THREE.MeshStandardMaterial({ 
            color: 0x999999, // True neutral grey
            metalness: 0.5, 
            roughness: 0.3 
        });

        this.upperBrackets = [];
        this.lowerBrackets = [];
        this.upperWireMesh = null;
        this.lowerWireMesh = null;
        
        this.numBrackets = 6; 
        
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
            [-0.35, 0.25, 0.25], [0.35, 0.25, 0.25],  
            [-0.35, -0.25, 0.25], [0.35, -0.25, 0.25]  
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
        
        const bracketScale = mouthWidthPx * 0.035; 
        const wireRadius = mouthWidthPx * 0.0035; // Slightly thicker
        
        // Pushed the upper drop down slightly more so it hits the center of the top teeth
        const upperDropOffset = mouthWidthPx * 0.08; 
        
        // Small push up from the bottom lip
        const lowerDropOffset = mouthWidthPx * 0.03;

        const upperIndices = [78, 191, 80, 81, 82, 13, 312, 311, 310, 415, 308];
        const upperPoints = [];
        upperIndices.forEach((idx, i) => {
            const lm = landmarks[idx];
            const tx = (lm.x * width) - (width / 2);
            let ty = (height / 2) - (lm.y * height);
            const distFromCenter = Math.abs((i / (upperIndices.length - 1)) - 0.5) * 2; 
            
            // Center drops full offset. Corners drop 20% of offset. (Creates a steep U arch)
            ty -= (upperDropOffset - (distFromCenter * (upperDropOffset * 0.8))); 
            upperPoints.push(new THREE.Vector3(tx, ty, 5 - (distFromCenter * (mouthWidthPx * 0.05))));
        });

        const lowerIndices = [78, 95, 88, 178, 87, 14, 317, 402, 318, 324, 308];
        const lowerPoints = [];
        lowerIndices.forEach((idx, i) => {
            const lm = landmarks[idx];
            const tx = (lm.x * width) - (width / 2);
            let ty = (height / 2) - (lm.y * height);
            const distFromCenter = Math.abs((i / (lowerIndices.length - 1)) - 0.5) * 2; 
            
            // 🔥 FIX 2: UNIFORM OFFSET
            // We push the entire lower curve up uniformly. This completely prevents the 
            // "Curve Flattening" bug and preserves the natural U-shape of your lower lip.
            ty += lowerDropOffset; 
            
            lowerPoints.push(new THREE.Vector3(tx, ty, 5 - (distFromCenter * (mouthWidthPx * 0.05))));
        });

        const upperCurve = new THREE.CatmullRomCurve3(upperPoints);
        const lowerCurve = new THREE.CatmullRomCurve3(lowerPoints);

        // 🔥 FIX 3: WIDER T-VALUES
        // Spreads the brackets out properly over the 6 front teeth so they stop bunching.
        const upperTValues = [0.26, 0.36, 0.46, 0.54, 0.64, 0.74];
        const lowerTValues = [0.30, 0.38, 0.46, 0.54, 0.62, 0.70]; 

        const upperBracketPositions = [];
        const lowerBracketPositions = [];

        upperTValues.forEach((t, i) => {
            const bracket = this.upperBrackets[i];
            bracket.scale.set(bracketScale, bracketScale, bracketScale);
            
            const pos = upperCurve.getPoint(t);
            bracket.position.copy(pos);
            upperBracketPositions.push(pos.clone());
            
            bracket.rotation.set(0, 0, 0);
            bracket.lookAt(pos.x, pos.y, pos.z + 100); 
            const nx = (t - 0.5) * 2; 
            bracket.rotateY(nx * 0.4);
        });

        lowerTValues.forEach((t, i) => {
            const bracket = this.lowerBrackets[i];
            bracket.scale.set(bracketScale, bracketScale, bracketScale);
            
            const pos = lowerCurve.getPoint(t);
            bracket.position.copy(pos);
            lowerBracketPositions.push(pos.clone());
            
            bracket.rotation.set(0, 0, 0);
            bracket.lookAt(pos.x, pos.y, pos.z + 100);
            const nx = (t - 0.5) * 2; 
            bracket.rotateY(nx * 0.4);
        });

        if (this.upperWireMesh) {
            this.scene.remove(this.upperWireMesh);
            this.upperWireMesh.geometry.dispose();
            this.scene.remove(this.lowerWireMesh);
            this.lowerWireMesh.geometry.dispose();
        }

        // Truncated curves so the wire never pokes out past the last bracket
        const upperWireCurve = new THREE.CatmullRomCurve3(upperBracketPositions);
        const lowerWireCurve = new THREE.CatmullRomCurve3(lowerBracketPositions);

        const upperWireGeo = new THREE.TubeGeometry(upperWireCurve, 32, wireRadius, 8, false);
        this.upperWireMesh = new THREE.Mesh(upperWireGeo, this.wireMat);
        this.upperWireMesh.position.z = bracketScale * 0.15; 
        this.scene.add(this.upperWireMesh);

        const lowerWireGeo = new THREE.TubeGeometry(lowerWireCurve, 32, wireRadius, 8, false);
        this.lowerWireMesh = new THREE.Mesh(lowerWireGeo, this.wireMat);
        this.lowerWireMesh.position.z = bracketScale * 0.15;
        this.scene.add(this.lowerWireMesh);

        this.renderer.render(this.scene, this.camera);
        return this.renderer.domElement;
    }
}
