import * as THREE from 'three';

/**
 * 3D ORTHODONTIC ENGINE (V16 - Photorealistic Ligatures & Bite-Line Anchor)
 * - Upgrades the 3D sculpt to include colored rubber ligatures (O-rings).
 * - Restores bright surgical steel materials.
 * - Drastically increases the lower drop offset to pull hardware off the gums.
 * - Tightens the biological spacing to prevent corner-drifting.
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

        // Bright Clinical Studio Lighting
        const ambientLight = new THREE.AmbientLight(0xffffff, 2.0); 
        this.scene.add(ambientLight);
        const dirLight = new THREE.DirectionalLight(0xffffff, 1.5);
        dirLight.position.set(10, 30, 50); 
        this.scene.add(dirLight);

        // 🔥 REALISM UPGRADE 1: SURGICAL STEEL & COLORED BANDS
        this.metalMat = new THREE.MeshPhysicalMaterial({
            color: 0xeeeeee,       // Bright Silver
            metalness: 0.85,       // Highly reflective
            roughness: 0.15,       // Smooth surgical steel
            clearcoat: 1.0,        // Wet gloss
            clearcoatRoughness: 0.1 
        });

        this.bandMat = new THREE.MeshPhysicalMaterial({
            color: 0x1f78b4,       // Clinical Blue Rubber Band (from reference)
            metalness: 0.1,        // Rubber isn't metallic
            roughness: 0.4,        
            clearcoat: 0.8,        // Wet saliva gloss
        });
        
        this.wireMat = new THREE.MeshPhysicalMaterial({ 
            color: 0xcccccc, 
            metalness: 0.9, 
            roughness: 0.2,
            clearcoat: 0.5
        });

        this.upperBrackets = [];
        this.lowerBrackets = [];
        this.upperWireMesh = null;
        this.lowerWireMesh = null;
        
        this.currentToothCount = 10; 
        this.buildHardware(this.currentToothCount);
    }

    setDensity(percentage) {
        let newCount = 6; 
        if (percentage >= 50) newCount = 8;
        if (percentage >= 80) newCount = 10;
        if (percentage >= 98) newCount = 12; 

        if (newCount !== this.currentToothCount) {
            this.buildHardware(newCount);
        }
    }

    buildHardware(toothCount) {
        this.currentToothCount = toothCount;

        this.upperBrackets.forEach(b => { this.scene.remove(b); b.geometry.dispose(); });
        this.lowerBrackets.forEach(b => { this.scene.remove(b); b.geometry.dispose(); });
        this.upperBrackets = [];
        this.lowerBrackets = [];

        for (let i = 0; i < this.currentToothCount; i++) {
            const upperMesh = this.createRealisticTwinBracket();
            const lowerMesh = this.createRealisticTwinBracket();
            this.scene.add(upperMesh);
            this.scene.add(lowerMesh);
            this.upperBrackets.push(upperMesh);
            this.lowerBrackets.push(lowerMesh);
        }
    }

    // 🔥 REALISM UPGRADE 2: THE RUBBER BAND SCULPT
    createRealisticTwinBracket() {
        const group = new THREE.Group();

        // 1. Steel Base Pad
        const padGeo = new THREE.BoxGeometry(1.0, 0.8, 0.15);
        const pad = new THREE.Mesh(padGeo, this.metalMat);
        group.add(pad);

        // 2. Steel Core
        const coreGeo = new THREE.BoxGeometry(0.6, 0.4, 0.3);
        const core = new THREE.Mesh(coreGeo, this.metalMat);
        core.position.z = 0.2;
        group.add(core);

        // 3. The Blue Rubber Ligature (Torus/Donut shape stretched into an oval)
        const bandGeo = new THREE.TorusGeometry(0.4, 0.12, 8, 16);
        const band = new THREE.Mesh(bandGeo, this.bandMat);
        band.position.z = 0.25;
        band.scale.set(1.1, 0.8, 0.6); // Flatten it slightly
        group.add(band);

        // 4. Subtle Steel Wings poking out
        const wingGeo = new THREE.BoxGeometry(0.2, 0.2, 0.15);
        const wingPositions = [
            [-0.3, 0.25, 0.35], [0.3, 0.25, 0.35],  
            [-0.3, -0.25, 0.35], [0.3, -0.25, 0.35]  
        ];
        wingPositions.forEach(pos => {
            const wing = new THREE.Mesh(wingGeo, this.metalMat);
            wing.position.set(pos[0], pos[1], pos[2]);
            group.add(wing);
        });

        return group;
    }

    generateBiologicalTValues(numTeeth, isLower) {
        // 🔥 ALIGNMENT UPGRADE 1: TIGHTER RATIOS
        // Shrunk the laterals and canines slightly so brackets don't drift to the extreme edges
        const upperWidths = [1.0, 0.65, 0.75, 0.75, 0.75, 1.0];
        const lowerWidths = [0.55, 0.60, 0.70, 0.75, 0.75, 1.0];
        const widths = isLower ? lowerWidths : upperWidths;

        const halfCount = Math.floor(numTeeth / 2);
        let totalHalfWidth = 0;
        for (let i = 0; i < halfCount; i++) {
            totalHalfWidth += widths[i];
        }

        const tValues = [];
        const minT = isLower ? 0.25 : 0.22; // Brought inwards
        const maxT = isLower ? 0.75 : 0.78; // Brought inwards
        const centerT = 0.5;
        const halfRange = (maxT - minT) / 2;

        let currentWidth = totalHalfWidth;
        for (let i = halfCount - 1; i >= 0; i--) {
            const toothCenter = currentWidth - (widths[i] / 2);
            const normalized = toothCenter / totalHalfWidth; 
            tValues.push(centerT - (normalized * halfRange));
            currentWidth -= widths[i];
        }

        currentWidth = 0;
        for (let i = 0; i < halfCount; i++) {
            const toothCenter = currentWidth + (widths[i] / 2);
            const normalized = toothCenter / totalHalfWidth; 
            tValues.push(centerT + (normalized * halfRange));
            currentWidth += widths[i];
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
        
        // Scaled brackets down slightly to accommodate the new rubber bands
        const bracketScale = mouthWidthPx * 0.032; 
        const wireRadius = mouthWidthPx * 0.003; 
        
        // 🔥 ALIGNMENT UPGRADE 2: MASSIVE GUM CLEARANCE
        // Pushed the upper drop up slightly to center on top teeth (from 0.08 to 0.065)
        const upperDropOffset = mouthWidthPx * 0.065; 
        
        // DRASTICALLY increased the lower push-up (from 0.03 to 0.08). 
        // This will rip the brackets off the bottom gum and plant them on the lower teeth!
        const lowerDropOffset = mouthWidthPx * 0.08;

        const upperIndices = [78, 191, 80, 81, 82, 13, 312, 311, 310, 415, 308];
        const upperPoints = [];
        upperIndices.forEach((idx, i) => {
            const lm = landmarks[idx];
            const tx = (lm.x * width) - (width / 2);
            let ty = (height / 2) - (lm.y * height);
            const distFromCenter = Math.abs((i / (upperIndices.length - 1)) - 0.5) * 2; 
            
            ty -= (upperDropOffset - (distFromCenter * (upperDropOffset * 0.6))); 
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

        const upperTValues = this.generateBiologicalTValues(this.currentToothCount, false);
        const lowerTValues = this.generateBiologicalTValues(this.currentToothCount, true);

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
        
        // Push the wire so it weaves perfectly *through* the blue rubber bands
        this.upperWireMesh.position.z = bracketScale * 0.25; 
        this.scene.add(this.upperWireMesh);

        const lowerWireGeo = new THREE.TubeGeometry(lowerWireCurve, 32, wireRadius, 8, false);
        this.lowerWireMesh = new THREE.Mesh(lowerWireGeo, this.wireMat);
        this.lowerWireMesh.position.z = bracketScale * 0.25;
        this.scene.add(this.lowerWireMesh);

        this.renderer.render(this.scene, this.camera);
        return this.renderer.domElement;
    }
}
