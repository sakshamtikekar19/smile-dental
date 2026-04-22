import * as THREE from 'three';

/**
 * 3D ORTHODONTIC ENGINE (V5 - HD Mobile & Clean Alignment)
 * Fixes mobile camera degradation using devicePixelRatio.
 * Adjusts bracket count and geometry for clean, uncrowded placement.
 */
export class Braces3DEngine {
    constructor(width, height) {
        this.width = width;
        this.height = height;

        this.scene = new THREE.Scene();
        this.camera = new THREE.OrthographicCamera(width / -2, width / 2, height / 2, height / -2, 0.1, 1000);
        this.camera.position.z = 100;

        this.renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
        
        // 🔥 FIX 1: THE CAMERA QUALITY SAVER
        // This tells Three.js to render in High Definition on mobile phones.
        this.renderer.setPixelRatio(window.devicePixelRatio || 1); 
        this.renderer.setSize(width, height);
        this.renderer.setClearColor(0x000000, 0); 

        // Clean, bright lighting (Removed the heavy Environment map to stop weird discolorations)
        const ambientLight = new THREE.AmbientLight(0xffffff, 1.2); 
        this.scene.add(ambientLight);
        
        const dirLight = new THREE.DirectionalLight(0xffffff, 1.0);
        dirLight.position.set(10, 20, 50); 
        this.scene.add(dirLight);

        // Solid Clinical Silver
        this.bracketMat = new THREE.MeshStandardMaterial({
            color: 0xdddddd,      
            metalness: 0.6,       
            roughness: 0.3,       
        });
        
        this.wireMat = new THREE.MeshStandardMaterial({ 
            color: 0xaaaaaa, 
            metalness: 0.8, 
            roughness: 0.4 
        });

        this.upperBrackets = [];
        this.lowerBrackets = [];
        this.upperWireMesh = null;
        this.lowerWireMesh = null;
        
        // 🔥 FIX 2: 8 Brackets instead of 10. 
        // This maps perfectly to the 4 incisors and 2 canines visible in a natural smile.
        this.numBrackets = 8; 
        
        for (let i = 0; i < this.numBrackets; i++) {
            const upperMesh = this.createCleanBracket(this.bracketMat);
            const lowerMesh = this.createCleanBracket(this.bracketMat);
            this.scene.add(upperMesh);
            this.scene.add(lowerMesh);
            this.upperBrackets.push(upperMesh);
            this.lowerBrackets.push(lowerMesh);
        }
    }

    createCleanBracket(material) {
        const group = new THREE.Group();

        // 🔥 FIX 3: Clean, legible geometry.
        // Instead of microscopic wings that blur into noise, we use a solid pad 
        // and a distinct raised horizontal slot for the wire to sit in.
        const padGeo = new THREE.BoxGeometry(3.2, 3.2, 1.0);
        const pad = new THREE.Mesh(padGeo, material);
        group.add(pad);

        // Raised wire slot
        const slotGeo = new THREE.BoxGeometry(3.2, 1.0, 1.0);
        const slot = new THREE.Mesh(slotGeo, material);
        slot.position.z = 0.8; // Push it forward
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

        // --- UPPER ARCH ---
        const upperIndices = [78, 191, 80, 81, 82, 13, 312, 311, 310, 415, 308];
        const upperPoints = [];
        upperIndices.forEach((idx, i) => {
            const lm = landmarks[idx];
            const tx = (lm.x * width) - (width / 2);
            let ty = (height / 2) - (lm.y * height);
            const distFromCenter = Math.abs((i / (upperIndices.length - 1)) - 0.5) * 2; 
            
            // Drop down to hit tooth centers
            ty -= (14 - (distFromCenter * 8)); 
            upperPoints.push(new THREE.Vector3(tx, ty, 5 - (distFromCenter * 6)));
        });

        // --- LOWER ARCH ---
        const lowerIndices = [78, 95, 88, 178, 87, 14, 317, 402, 318, 324, 308];
        const lowerPoints = [];
        lowerIndices.forEach((idx, i) => {
            const lm = landmarks[idx];
            const tx = (lm.x * width) - (width / 2);
            let ty = (height / 2) - (lm.y * height);
            const distFromCenter = Math.abs((i / (lowerIndices.length - 1)) - 0.5) * 2; 
            
            // Push up to hit tooth centers
            ty += (12 - (distFromCenter * 6)); 
            lowerPoints.push(new THREE.Vector3(tx, ty, 5 - (distFromCenter * 6)));
        });

        const upperCurve = new THREE.CatmullRomCurve3(upperPoints);
        const lowerCurve = new THREE.CatmullRomCurve3(lowerPoints);

        // Center the 8 brackets tightly on the visible front teeth
        const placeBrackets = (brackets, curve) => {
            for (let i = 0; i < this.numBrackets; i++) {
                // Tighter spread: 0.20 to 0.80 avoids the extreme dark corners
                const t = 0.20 + (i / (this.numBrackets - 1)) * 0.60; 
                const bracket = brackets[i];
                
                bracket.position.copy(curve.getPoint(t));
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

        const upperWireGeo = new THREE.TubeGeometry(upperCurve, 64, 0.25, 8, false);
        this.upperWireMesh = new THREE.Mesh(upperWireGeo, this.wireMat);
        this.upperWireMesh.position.z = 1.0; 
        this.scene.add(this.upperWireMesh);

        const lowerWireGeo = new THREE.TubeGeometry(lowerCurve, 64, 0.25, 8, false);
        this.lowerWireMesh = new THREE.Mesh(lowerWireGeo, this.wireMat);
        this.lowerWireMesh.position.z = 1.0;
        this.scene.add(this.lowerWireMesh);

        this.renderer.render(this.scene, this.camera);
        return this.renderer.domElement;
    }
}
