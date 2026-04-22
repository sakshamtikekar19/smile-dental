import * as THREE from 'three';

/**
 * 3D ORTHODONTIC ENGINE (V3 - Dual Arch Clinical Splines)
 * Generates two independent 3D splines (Upper & Lower) mapped perfectly
 * to the anatomy of the smile, with studs centered on the occlusal planes.
 */
export class Braces3DEngine {
    constructor(width, height) {
        this.width = width;
        this.height = height;

        // 1. Scene & Camera Setup
        this.scene = new THREE.Scene();
        this.camera = new THREE.OrthographicCamera(width / -2, width / 2, height / 2, height / -2, 0.1, 1000);
        this.camera.position.z = 100;

        this.renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
        this.renderer.setSize(width, height);
        this.renderer.setClearColor(0x000000, 0); 

        // 2. Clinical Lighting (Hemisphere + Directional for metallic glints)
        const hemiLight = new THREE.HemisphereLight(0xffffff, 0x444444, 1.2);
        this.scene.add(hemiLight);
        
        const dirLight = new THREE.DirectionalLight(0xffffff, 1.5);
        dirLight.position.set(0, 100, 50);
        this.scene.add(dirLight);

        // 3. Hardware Materials
        this.bracketMat = new THREE.MeshPhysicalMaterial({
            color: 0xdddddd,      
            metalness: 0.8,       
            roughness: 0.15,      
            clearcoat: 1.0,       
            clearcoatRoughness: 0.1
        });

        // Anatomical Bracket Shape (Slightly rectangular)
        this.bracketGeo = new THREE.BoxGeometry(8, 6, 3.5);
        
        this.wireMat = new THREE.MeshPhysicalMaterial({ 
            color: 0xa0a0a0, 
            metalness: 0.9, 
            roughness: 0.3 
        });

        // 4. Hardware Arrays
        this.upperBrackets = [];
        this.lowerBrackets = [];
        this.upperWireMesh = null;
        this.lowerWireMesh = null;
        
        // 10 brackets for the top, 10 for the bottom
        this.numBrackets = 10; 
        
        for (let i = 0; i < this.numBrackets; i++) {
            const upperMesh = new THREE.Mesh(this.bracketGeo, this.bracketMat);
            const lowerMesh = new THREE.Mesh(this.bracketGeo, this.bracketMat);
            this.scene.add(upperMesh);
            this.scene.add(lowerMesh);
            this.upperBrackets.push(upperMesh);
            this.lowerBrackets.push(lowerMesh);
        }
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

        // --- ALGORITHM: UPPER ARCH ---
        // Left corner to right corner along the upper inner lip
        const upperIndices = [78, 191, 80, 81, 82, 13, 312, 311, 310, 415, 308];
        const upperPoints = [];

        upperIndices.forEach((idx, i) => {
            const lm = landmarks[idx];
            const tx = (lm.x * width) - (width / 2);
            let ty = (height / 2) - (lm.y * height);

            // Drop the upper lip line down to hit the center of the top teeth.
            // Drops more in the center (14px) and less at the corners (4px).
            const distFromCenter = Math.abs((i / (upperIndices.length - 1)) - 0.5) * 2; 
            ty -= (14 - (distFromCenter * 10)); 

            upperPoints.push(new THREE.Vector3(tx, ty, 5 - (distFromCenter * 4))); // Push corners back in Z-space
        });

        // --- ALGORITHM: LOWER ARCH ---
        // Left corner to right corner along the lower inner lip
        const lowerIndices = [78, 95, 88, 178, 87, 14, 317, 402, 318, 324, 308];
        const lowerPoints = [];

        lowerIndices.forEach((idx, i) => {
            const lm = landmarks[idx];
            const tx = (lm.x * width) - (width / 2);
            let ty = (height / 2) - (lm.y * height);

            // Push the lower lip line up to hit the center of the bottom teeth.
            const distFromCenter = Math.abs((i / (lowerIndices.length - 1)) - 0.5) * 2; 
            ty += (12 - (distFromCenter * 8)); 

            lowerPoints.push(new THREE.Vector3(tx, ty, 5 - (distFromCenter * 4)));
        });

        // Generate the smooth mathematical splines
        const upperCurve = new THREE.CatmullRomCurve3(upperPoints);
        const lowerCurve = new THREE.CatmullRomCurve3(lowerPoints);

        // --- HARDWARE PLACEMENT ---
        // We shrink the placement span (0.10 to 0.90) so brackets don't crowd the extreme dark corners of the mouth
        const placeBrackets = (brackets, curve) => {
            for (let i = 0; i < this.numBrackets; i++) {
                const t = 0.10 + (i / (this.numBrackets - 1)) * 0.80; 
                const bracket = brackets[i];
                
                // Position centered on the curve
                bracket.position.copy(curve.getPoint(t));

                // Rotate perfectly flush against the curve angle
                const tangent = curve.getTangent(t);
                const axis = new THREE.Vector3(0, 1, 0);
                bracket.quaternion.setFromUnitVectors(axis, tangent);
                bracket.rotateZ(Math.PI / 2); 
                bracket.rotateX(Math.PI / 2);
            }
        };

        placeBrackets(this.upperBrackets, upperCurve);
        placeBrackets(this.lowerBrackets, lowerCurve);

        // --- DYNAMIC WIRES ---
        if (this.upperWireMesh) {
            this.scene.remove(this.upperWireMesh);
            this.upperWireMesh.geometry.dispose();
            this.scene.remove(this.lowerWireMesh);
            this.lowerWireMesh.geometry.dispose();
        }

        // Draw fresh wires that trace the exact anatomical smile curves
        const upperWireGeo = new THREE.TubeGeometry(upperCurve, 64, 0.6, 8, false);
        this.upperWireMesh = new THREE.Mesh(upperWireGeo, this.wireMat);
        this.scene.add(this.upperWireMesh);

        const lowerWireGeo = new THREE.TubeGeometry(lowerCurve, 64, 0.6, 8, false);
        this.lowerWireMesh = new THREE.Mesh(lowerWireGeo, this.wireMat);
        this.scene.add(this.lowerWireMesh);

        // Render to canvas
        this.renderer.render(this.scene, this.camera);
        return this.renderer.domElement;
    }
}
