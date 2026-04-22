import * as THREE from 'three';

/**
 * 3D ORTHODONTIC ENGINE (V2 - Anatomical Spline & Clinical Materials)
 * Uses FaceMesh upper lip topography to route a perfect 3D spline curve
 * across the center of the dental arch.
 */
export class Braces3DEngine {
    constructor(width, height) {
        this.width = width;
        this.height = height;

        // 1. Scene & Camera
        this.scene = new THREE.Scene();
        this.camera = new THREE.OrthographicCamera(width / -2, width / 2, height / 2, height / -2, 0.1, 1000);
        this.camera.position.z = 100;

        // 2. Renderer Setup
        this.renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
        this.renderer.setSize(width, height);
        this.renderer.setClearColor(0x000000, 0); // Transparent

        // 3. CLINICAL LIGHTING (Fixes the "Black Box" issue)
        // HemisphereLight mimics light bouncing around inside a room
        const hemiLight = new THREE.HemisphereLight(0xffffff, 0x444444, 1.2);
        this.scene.add(hemiLight);
        
        // Directional light adds the harsh "metallic glint"
        const dirLight = new THREE.DirectionalLight(0xffffff, 1.5);
        dirLight.position.set(0, 100, 50);
        this.scene.add(dirLight);

        // 4. PREPARE HARDWARE ASSETS
        // MeshPhysicalMaterial gives the most realistic metallic look for dental hardware
        this.bracketMat = new THREE.MeshPhysicalMaterial({
            color: 0xdddddd,      // Bright silver
            metalness: 0.8,       // Metallic look
            roughness: 0.15,      // Shiny but slightly frosted
            clearcoat: 1.0,       // Simulates saliva/wetness
            clearcoatRoughness: 0.1
        });

        // Make the brackets slightly more anatomical (wider than they are tall)
        this.bracketGeo = new THREE.BoxGeometry(10, 8, 4);
        
        this.wireMat = new THREE.MeshPhysicalMaterial({ 
            color: 0xa0a0a0, 
            metalness: 0.9, 
            roughness: 0.3 
        });

        this.brackets = [];
        this.wireMesh = null; // Wire will be dynamically drawn every frame
        
        // We will place 10 brackets to span a full visible smile
        this.numBrackets = 10;
        for (let i = 0; i < this.numBrackets; i++) {
            const mesh = new THREE.Mesh(this.bracketGeo, this.bracketMat);
            this.scene.add(mesh);
            this.brackets.push(mesh);
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

        // 1. EXTRACT UPPER LIP INNER LINE (Left to Right)
        const upperLipIndices = [78, 191, 80, 81, 82, 13, 312, 311, 310, 415, 308];
        const curvePoints = [];

        upperLipIndices.forEach((idx, i) => {
            const lm = landmarks[idx];
            
            // Convert normalized FaceMesh coords to Three.js Orthographic coords
            const tx = (lm.x * width) - (width / 2);
            let ty = (height / 2) - (lm.y * height);

            // 🔥 THE DROP OFFSET: 
            // The lip line sits above the teeth. We drop the points down to hit the tooth centers.
            // We drop the center points more (12px) and the corner points less (4px) to match natural anatomy.
            const distanceFromCenter = Math.abs((i / (upperLipIndices.length - 1)) - 0.5) * 2; // 0 at center, 1 at edges
            const dropAmount = 14 - (distanceFromCenter * 8); 
            
            ty -= dropAmount;

            curvePoints.push(new THREE.Vector3(tx, ty, 5));
        });

        // 2. CREATE THE 3D SPLINE
        // This generates a perfectly smooth mathematical curve through those 11 anatomical points
        const archCurve = new THREE.CatmullRomCurve3(curvePoints);

        // 3. PLACE THE BRACKETS
        // Distribute the brackets evenly along the length of the spline
        for (let i = 0; i < this.numBrackets; i++) {
            // Determine percentage along the curve (e.g., 0.0 is left corner, 1.0 is right corner)
            // We shrink the span slightly (0.05 to 0.95) so brackets don't clip into the far corners of the mouth
            const t = 0.05 + (i / (this.numBrackets - 1)) * 0.90; 

            const bracket = this.brackets[i];
            
            // Get exact 3D position
            const point = archCurve.getPoint(t);
            bracket.position.copy(point);

            // Get the direction the curve is pointing at this spot
            const tangent = archCurve.getTangent(t);
            
            // Rotate the bracket so it aligns perfectly with the angle of the teeth
            const axis = new THREE.Vector3(0, 1, 0);
            bracket.quaternion.setFromUnitVectors(axis, tangent);
            // Flip it 90 degrees so the face points outward
            bracket.rotateZ(Math.PI / 2); 
            bracket.rotateX(Math.PI / 2);
        }

        // 4. DRAW THE DYNAMIC WIRE
        // Remove the old wire and draw a new one that perfectly traces the current spline
        if (this.wireMesh) {
            this.scene.remove(this.wireMesh);
            this.wireMesh.geometry.dispose();
        }

        // Creates a 3D tube that wraps around our CatmullRomCurve3
        const wireGeo = new THREE.TubeGeometry(archCurve, 64, 0.8, 8, false);
        this.wireMesh = new THREE.Mesh(wireGeo, this.wireMat);
        this.scene.add(this.wireMesh);

        // Render
        this.renderer.render(this.scene, this.camera);
        return this.renderer.domElement;
    }
}
