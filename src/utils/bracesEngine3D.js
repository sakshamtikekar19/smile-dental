import * as THREE from 'three';

/**
 * 3D ORTHODONTIC ENGINE (V1 - The Hybrid Foundation)
 * Generates dynamic 3D hardware and aligns it to the FaceMesh anchor points.
 */
export class Braces3DEngine {
    constructor(width, height) {
        this.width = width;
        this.height = height;

        // 1. Setup the 3D Scene
        this.scene = new THREE.Scene();
        
        // Orthographic Camera is best for perfectly overlaying on a 2D video feed
        this.camera = new THREE.OrthographicCamera(width / -2, width / 2, height / 2, height / -2, 0.1, 1000);
        this.camera.position.z = 100;

        // 2. Setup the Renderer (Transparent background is mandatory!)
        this.renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
        this.renderer.setSize(width, height);
        this.renderer.setClearColor(0x000000, 0); // 100% Transparent

        // 3. Clinical Lighting Setup
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.6); // Soft base light
        this.scene.add(ambientLight);
        
        const directionalLight = new THREE.DirectionalLight(0xffffff, 1.2); // Harsh "Flash" for glints
        directionalLight.position.set(0, 50, 100);
        this.scene.add(directionalLight);

        // 4. Create the Hardware
        this.brackets = [];
        this.createHardware();
    }

    createHardware() {
        // High-end surgical steel material
        const bracketMaterial = new THREE.MeshStandardMaterial({
            color: 0xcccccc,
            metalness: 0.9,  // Highly metallic
            roughness: 0.2,  // Very shiny
        });

        // For V1, we use procedural 3D boxes. Later, you can swap this for a .gltf model!
        const bracketGeometry = new THREE.BoxGeometry(12, 10, 4);

        // Create 8 brackets for the upper teeth
        for (let i = 0; i < 8; i++) {
            const bracket = new THREE.Mesh(bracketGeometry, bracketMaterial);
            this.scene.add(bracket);
            this.brackets.push(bracket);
        }

        // The Archwire (A simple curved tube)
        const wireMaterial = new THREE.MeshStandardMaterial({ color: 0x999999, metalness: 1.0, roughness: 0.4 });
        const wireGeometry = new THREE.CylinderGeometry(1, 1, this.width, 16);
        this.wire = new THREE.Mesh(wireGeometry, wireMaterial);
        this.wire.rotation.z = Math.PI / 2; // Lay it horizontally
        this.scene.add(this.wire);
    }

    /**
     * The Anchor Math: Updates 3D positions based on FaceMesh
     */
    updateAndRender(landmarks, width, height) {
        if (!landmarks || landmarks.length === 0) return this.renderer.domElement;

        // Update renderer size if screen changed
        if (this.width !== width || this.height !== height) {
            this.width = width;
            this.height = height;
            this.renderer.setSize(width, height);
            this.camera.left = width / -2;
            this.camera.right = width / 2;
            this.camera.top = height / 2;
            this.camera.bottom = height / -2;
            this.camera.updateProjectionMatrix();
            
            // Resize wire geometry if needed
            this.wire.scale.y = width / this.width;
        }

        // FaceMesh Indices for Upper Lip Center (13) and Mouth Corners (61, 291)
        const leftCorner = landmarks[61];
        const rightCorner = landmarks[291];
        const upperLipCenter = landmarks[13];

        const cx = (leftCorner.x + rightCorner.x) / 2 * width;
        const cy = upperLipCenter.y * height + 10; // Drop 10px below the lip
        
        const mouthWidth = (rightCorner.x - leftCorner.x) * width;

        // Spread the brackets along a parabolic curve
        this.brackets.forEach((bracket, i) => {
            // Map index (0 to 7) to a normalized range (-1 to 1)
            const nx = (i / 7) * 2 - 1; 
            
            // X position: Spread evenly across the mouth width
            const xPos = cx + (nx * (mouthWidth * 0.45));
            
            // Y position: Create a subtle "U" shape (parabola)
            const curveDrop = Math.pow(nx, 2) * (mouthWidth * 0.1); 
            const yPos = cy + curveDrop;

            // Map 2D coordinates to Three.js Orthographic space (Origin is center, Y is flipped)
            bracket.position.x = xPos - (width / 2);
            bracket.position.y = (height / 2) - yPos;
            bracket.position.z = 5; // Pop it forward slightly

            // Subtle rotation so they point outward based on curvature
            bracket.rotation.y = nx * 0.4; 
        });

        // Position the main wire
        this.wire.position.x = cx - (width / 2);
        this.wire.position.y = (height / 2) - cy - 2; 
        this.wire.scale.y = mouthWidth / width; // Scale wire to fit mouth width

        // Render the frame!
        this.renderer.render(this.scene, this.camera);
        
        // Return the HTMLCanvasElement containing the 3D render
        return this.renderer.domElement; 
    }
}
