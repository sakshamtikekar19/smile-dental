import * as THREE from 'three';

/**
 * 3D ORTHODONTIC ENGINE (V15 - Photorealistic Hardware Upgrade)
 * - Placement logic remains 100% untouched from V14.
 * - Upgrades to MeshPhysicalMaterial for a "wet/glossy" look.
 * - Enhances the 3D geometry of the bracket to catch realistic highlights.
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

        // 🔥 VISUAL UPGRADE 1: STUDIO LIGHTING
        // Added a Hemisphere light to bounce "floor" and "ceiling" light around the wet metal
        const hemiLight = new THREE.HemisphereLight(0xffffff, 0x444444, 1.5);
        this.scene.add(hemiLight);
        
        const dirLight = new THREE.DirectionalLight(0xffffff, 2.0);
        dirLight.position.set(10, 30, 50); // Angled for a sharp, realistic glint
        this.scene.add(dirLight);

        // 🔥 VISUAL UPGRADE 2: WET GRAPHITE MATERIAL
        // Upgraded to MeshPhysicalMaterial. 
        // Color is dark graphite (not pure black) so it can cast shadows.
        // Clearcoat adds a simulated layer of wet saliva/gloss.
        this.bracketMat = new THREE.MeshPhysicalMaterial({
            color: 0x2c2c2c,       // Dark Graphite
            metalness: 0.8,        // Highly metallic
            roughness: 0.3,        // Slightly brushed
            clearcoat: 1.0,        // 100% wet look
            clearcoatRoughness: 0.1 // Sharp reflections on the wet layer
        });
        
        this.wireMat = new THREE.MeshPhysicalMaterial({ 
            color: 0xdddddd, 
            metalness: 1.0, 
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
            const upperMesh = this.createRealisticTwinBracket(this.bracketMat);
            const lowerMesh = this.createRealisticTwinBracket(this.bracketMat);
            this.scene.add(upperMesh);
            this.scene.add(lowerMesh);
            this.upperBrackets.push(upperMesh);
            this.lowerBrackets.push(lowerMesh);
        }
    }

    // 🔥 VISUAL UPGRADE 3: ENHANCED SCULPT
    createRealisticTwinBracket(material) {
        const group = new THREE.Group();

        // 1. Base Pad (Thinner, slightly wider contour glued to tooth)
        const padGeo = new THREE.BoxGeometry(1.2, 0.9, 0.15);
        const pad = new THREE.Mesh(padGeo, material);
        group.add(pad);

        // 2. Central Core (Pushes the structure outward)
        const coreGeo = new THREE.BoxGeometry(0.8, 0.5, 0.3);
        const core = new THREE.Mesh(coreGeo, material);
        core.position.z = 0.2;
        group.add(core);

        // 3. The 4 Tie Wings (More distinct cubes that catch the light)
        const wingGeo = new THREE.BoxGeometry(0.35, 0.35, 0.25);
        const wingPositions = [
            [-0.35, 0.3, 0.4],  // Top Left
            [0.35, 0.3, 0.4],   // Top Right
            [-0.35, -0.3, 0.4], // Bottom Left
            [0.35, -0.3, 0.4]   // Bottom Right
        ];

        wingPositions.forEach(pos => {
            const wing = new THREE.Mesh(wingGeo, material);
            wing.position.set(pos[0], pos[1], pos[2]);
            group.add(wing);
        });

        // 4. Subtle Wire Slot Highlight (adds depth between the wings)
        const slotGeo = new THREE.BoxGeometry(1.0, 0.15, 0.1);
        const slotMat = new THREE.MeshPhysicalMaterial({ color: 0x111111, roughness: 0.8 }); // Darker inside the slot
        const slot = new THREE.Mesh(slotGeo, slotMat);
        slot.position.z = 0.35;
        group.add(slot);

        return group;
    }

    generateBiologicalTValues(numTeeth, isLower) {
        const upperWidths = [1.0, 0.75, 0.85, 0.80, 0.80, 1.1];
        const lowerWidths = [0.60, 0.65, 0.80, 0.80, 0.80, 1.1];
        const widths = isLower ? lowerWidths : upperWidths;

        const halfCount = Math.floor(numTeeth / 2);
        let totalHalfWidth = 0;
        for (let i = 0; i < halfCount; i++) {
            totalHalfWidth += widths[i];
        }

        const tValues = [];
        const minT = isLower ? 0.22 : 0.18;
        const maxT = isLower ? 0.78 : 0.82;
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
            
            ty -= (upperDropOffset - (distFromCenter * (upperDropOffset * 0.5))); 
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
        
        // Slightly adjusted Z-position so the wire sits perfectly inside the new 3D sculpted slot
        this.upperWireMesh.position.z = bracketScale * 0.4; 
        this.scene.add(this.upperWireMesh);

        const lowerWireGeo = new THREE.TubeGeometry(lowerWireCurve, 32, wireRadius, 8, false);
        this.lowerWireMesh = new THREE.Mesh(lowerWireGeo, this.wireMat);
        this.lowerWireMesh.position.z = bracketScale * 0.4;
        this.scene.add(this.lowerWireMesh);

        this.renderer.render(this.scene, this.camera);
        return this.renderer.domElement;
    }
}
