import { useEffect } from 'react';
import {
	AxesHelper,
	Color,
	CubeCamera,
	Group,
	Mesh,
	MeshStandardMaterial,
	NearestFilter,
	PCFSoftShadowMap,
	PerspectiveCamera,
	PlaneGeometry,
	RepeatWrapping,
	Scene,
	SpotLight,
	TextureLoader,
	TorusGeometry,
	WebGLCubeRenderTarget,
} from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import Stats from 'three/examples/jsm/libs/stats.module';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { reflector, texture, uv } from 'three/src/nodes/TSL';
import { MeshStandardNodeMaterial, WebGPURenderer } from 'three/webgpu';
import { Pane } from 'tweakpane';

const ENVIRONMENT_LAYER = 1;

export default function App() {
	async function initialScene() {
		const el = document.querySelector('#container') as HTMLDivElement;

		/**
		 * Basic
		 */

		const renderer = new WebGPURenderer({
			alpha: true,
			antialias: true,
		});
		renderer.shadowMap.enabled = true;
		renderer.shadowMap.type = PCFSoftShadowMap;
		renderer.setSize(window.innerWidth, window.innerHeight);
		renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
		renderer.setClearColor(0x000000);
		el.append(renderer.domElement);

		const scene = new Scene();

		const camera = new PerspectiveCamera(
			75,
			window.innerWidth / window.innerHeight,
			0.1,
			1000
		);
		camera.position.set(4, 4, 4);
		camera.lookAt(scene.position);

		const controls = new OrbitControls(camera, renderer.domElement);
		controls.enableDamping = true;
		controls.dampingFactor = 0.05;
		controls.enablePan = false;

		const stats = new Stats();
		el.append(stats.dom);

		const cubeEnvironment = new WebGLCubeRenderTarget(512, {
			generateMipmaps: true,
			magFilter: NearestFilter,
			minFilter: NearestFilter,
		});
		const cubeCamera = new CubeCamera(0.1, 1000, cubeEnvironment);
		cubeCamera.position.set(0, 0, 0);
		cubeCamera.layers.set(ENVIRONMENT_LAYER);
		scene.add(cubeCamera);

		/**
		 * Loaders
		 */

		const textureLoader = new TextureLoader();
		textureLoader.setPath('/src/assets/textures/');

		const gltfLoader = new GLTFLoader();
		gltfLoader.setPath('/src/assets/modules/');

		/**
		 * Textures
		 */

		const floorNormalTexture = textureLoader.load('terrain-normal.jpg');
		floorNormalTexture.wrapS = floorNormalTexture.wrapT = RepeatWrapping;
		floorNormalTexture.repeat.set(5, 5);

		const floorRoughnessTexture = textureLoader.load('terrain-roughness.jpg');
		floorRoughnessTexture.wrapS = floorRoughnessTexture.wrapT = RepeatWrapping;
		floorRoughnessTexture.repeat.set(5, 5);

		/**
		 * Scene
		 */

		const floorReflector = reflector();
		const floorUVOffset = texture(floorRoughnessTexture, uv().mul(5))
			.add(texture(floorNormalTexture, uv().mul(5)))
			.sub(1.2)
			.mul(0.05);
		floorReflector.uvNode = floorReflector.uvNode!.add(floorUVOffset);

		const floorGeometry = new PlaneGeometry(30, 30, 32, 32);
		const floorMaterial = new MeshStandardNodeMaterial({
			transparent: true,
			colorNode: floorReflector,
			normalMap: floorNormalTexture,
			roughnessMap: floorRoughnessTexture,
			color: new Color(0.015, 0.015, 0.015),
			roughness: 0.7,
			dithering: true,
		});
		const floor = new Mesh(floorGeometry, floorMaterial);
		floor.receiveShadow = true;
		floor.rotation.x = -Math.PI / 2;
		floor.add(floorReflector.target);
		scene.add(floor);

		gltfLoader.load('chevrolet_corvette_c7/scene.gltf', (data) => {
			const car = data.scene;
			car.scale.setScalar(0.005);

			car.traverse((mesh) => {
				if (mesh instanceof Mesh) {
					mesh.castShadow = true;
					mesh.receiveShadow = true;
					if (mesh.material instanceof MeshStandardMaterial) {
						mesh.material.envMap = cubeEnvironment.texture;
						mesh.material.envMapIntensity = 20;
					}
				}
			});

			scene.add(car);
		});

		// Rings

		const ringsCount = 14;
		const ringsGap = 3.5;

		const rings = new Group();

		const ringsGeometry = new TorusGeometry(3.35, 0.05, 10, 100);
		const ringsMaterial = new MeshStandardMaterial({
			color: 'black',
		});

		for (let i = 0; i < ringsCount; i++) {
			const ring = new Mesh(ringsGeometry, ringsMaterial.clone());
			ring.layers.enable(ENVIRONMENT_LAYER);
			ring.castShadow = true;
			ring.receiveShadow = true;

			const z = (7 - i) * ringsGap;
			const dist = Math.abs(z);

			ring.position.z = z;
			ring.scale.setScalar(1 - dist * 0.04);

			if (i % 2 === 1) {
				ring.material.emissive = new Color(6, 0.15, 0.7).multiplyScalar(0.5);
			} else {
				ring.material.emissive = new Color(0.1, 0.7, 3).multiplyScalar(0.5);
			}

			rings.add(ring);
		}

		scene.add(rings);

		/**
		 * Light
		 */

		const spotLight1 = new SpotLight(new Color(1, 0.25, 0.7), 230);
		spotLight1.angle = 0.6;
		spotLight1.penumbra = 0.5;
		spotLight1.position.set(5, 5, 0);
		spotLight1.castShadow = true;
		scene.add(spotLight1);

		const spotLight2 = new SpotLight(new Color(0.14, 0.5, 1.0), 230);
		spotLight2.angle = 0.6;
		spotLight2.penumbra = 0.5;
		spotLight2.position.set(-5, 5, 0);
		spotLight2.castShadow = true;
		scene.add(spotLight2);

		/**
		 * Helpers
		 */

		const axesHelper = new AxesHelper();
		scene.add(axesHelper);

		/**
		 * Pane
		 */

		const pane = new Pane({ title: 'Debug Params' });
		pane.element.parentElement!.style.width = '300px';
		if (window.location.hash !== '#debug') {
			pane.element.style.visibility = 'hidden';
		}
		{
			const spotLight1Pane = pane.addFolder({ title: 'SpotLight 1' });
			spotLight1Pane.addBinding(spotLight1, 'intensity', {
				label: 'Intensity',
				step: 1.0,
				min: 0,
				max: 500,
			});
			spotLight1Pane.addBinding(spotLight1, 'angle', {
				label: 'Angle',
				min: 0,
				step: 0.001,
				max: Math.PI / 2,
			});
			spotLight1Pane.addBinding(spotLight1, 'color', {
				label: 'Color',
				color: { type: 'float' },
			});
		}
		{
			const spotLight2Pane = pane.addFolder({ title: 'SpotLight 2' });
			spotLight2Pane.addBinding(spotLight2, 'intensity', {
				label: 'Intensity',
				step: 1.0,
				min: 0,
				max: 500,
			});
			spotLight2Pane.addBinding(spotLight2, 'angle', {
				label: 'Angle',
				min: 0,
				step: 0.001,
				max: Math.PI / 2,
			});
			spotLight2Pane.addBinding(spotLight2, 'color', {
				label: 'Color',
				color: { type: 'float' },
			});
		}

		/**
		 * Events
		 */

		function render(time: number = 0) {
			requestAnimationFrame(render);

			controls.update(time);
			stats.update();

			cubeCamera.update(renderer as any, scene);

			renderer.render(scene, camera);
		}
		render();

		function resize() {
			renderer.setSize(window.innerWidth, window.innerHeight);

			camera.aspect = window.innerWidth / window.innerHeight;
			camera.updateProjectionMatrix();
		}
		window.addEventListener('resize', resize);
	}

	useEffect(() => {
		initialScene();
	}, []);

	return <div id='container'></div>;
}
