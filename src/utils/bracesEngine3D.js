import * as THREE from 'three';

/**
 * 3D ORTHODONTIC ENGINE (V13 - Procedural Arch & Custom Colors)
 * - Dynamically calculates bracket placement for ANY number of teeth.
 * - Features high-quality Black Studs and Bright Silver Wire.
 * - Includes a rebuild function to change tooth count on the fly.
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

        const ambientLight = new THREE.AmbientLight(0xffffff, 2.0); 
        this.scene.add(ambientLight);
        const dirLight = new THREE.DirectionalLight(0xffffff, 1.5);
        dirLight.position.set(0, 20, 50); 
        this.scene.add(dirLight);

        // 🔥 CUSTOM COLORS: Black Studs & Silver Wire
        this.bracketMat = new THREE.MeshStandardMaterial({
            color: 0x1a1a1a, // Sleek Charcoal/Black
            metalness: 0.7, 
            roughness: 0.2,   
        });
        
        this.wireMat = new THREE.MeshStandardMaterial({ 
            color: 0xdcdcdc, // Bright Premium Silver
            metalness: 0.9, 
            roughness: 0.2 
        });

        this.upperBrackets = [];
        this.lowerBrackets = [];
        this.upperWireMesh = null;
        this.lowerWireMesh = null;
        
        // Default to a wide 10-tooth smile
        this.upperToothCount = 10; 
        this.lowerToothCount = 10;
        
        this.buildHardware(this.upperToothCount, this.lowerToothCount);
    }

    /**
     * Rebuilds the hardware. Hook this up to a UI slider so users 
     * can select how many teeth they want brackets on!
     */
    buildHardware(upperCount, lowerCount) {
        this.upperToothCount = upperCount;
        this.lowerToothCount = lowerCount;

        // Clean up old meshes to prevent memory leaks
        this.upperBrackets.forEach(b => { this.scene.remove(b); b.geometry.dispose(); });
        this.lowerBrackets.forEach(b => { this.scene.remove(b); b.geometry.dispose(); });
        this.upperBrackets = [];
        this.lowerBrackets = [];

        // Build new brackets
        for (let i = 0; i < this.upperToothCount; i++) {
            const mesh = this.createRealisticTwinBracket(this.bracketMat);
            this.scene.add(mesh);
            this.upperBrackets.push(mesh);
        }
        for (let i = 0; i < this.lowerToothCount; i++) {
            const mesh = this.createRealisticTwinBracket(this.bracketMat);
            this.scene.add(mesh);
            this.lowerBrackets.push(mesh);
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

    /**
     * 🔥 PROCEDURAL T-VALUE GENERATOR
     * Mathematically spaces any number of brackets perfectly along the curve,
     * ensuring the exact center (T=0.5) is always the gap between the front teeth.
     */
    generateAnatomicalTValues(numTeeth, isLower) {
        const tValues = [];
        
        // The visible arch usually spans from T=0.15 to T=0.85. 
        // We shrink the span slightly for the lower jaw since the teeth are smaller.
        const minT = isLower ? 0.18 : 0.15;
        const maxT = isLower ? 0.82 : 0.85;
        const range = maxT - minT;

        for (let i = 0; i < numTeeth; i++) {
            // Evenly distribute the brackets across the calculated range
            const t = minT + (i / (numTeeth - 1)) * range;
            tValues.push(t);
        }
        return tValues;
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
        const wireRadius = mouthWidthPx * 0.0035; 
        
        const upperDropOffset = mouthWidthPx * 0.08; 
        const lowerDropOffset = mouthWidthPx * 0.03;

        const upperIndices = [78, 191, 80, 81, 82, 13, 312, 311, 310, 415, 308];
        const upperPoints = [];
        upperIndices.forEach((idx, i) => {
            const lm = landmarks[idx];
            const tx = (lm.x * width) - (width / 2);
            let ty = (height / 2) - (lm.y * height);
            const distFromCenter = Math.abs((i / (upperIndices.length - 1)) - 0.5) * 2; 
            
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
            
            ty += lowerDropOffset; 
            lowerPoints.push(new THREE.Vector3(tx, ty, 5 - (distFromCenter * (mouthWidthPx * 0.05))));
        });

        const upperCurve = new THREE.CatmullRomCurve3(upperPoints);
        const lowerCurve = new THREE.CatmullRomCurve3(lowerPoints);

        // Fetch dynamic T-Values based on how many teeth we currently have
        const upperTValues = this.generateAnatomicalTValues(this.upperToothCount, false);
        const lowerTValues = this.generateAnatomicalTValues(this.lowerToothCount, true);

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
