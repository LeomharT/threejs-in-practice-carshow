import { useEffect } from 'react';
import {
	AxesHelper,
	BoxGeometry,
	Color,
	CubeCamera,
	Group,
	LinearFilter,
	Mesh,
	MeshBasicMaterial,
	MeshStandardMaterial,
	PCFSoftShadowMap,
	PerspectiveCamera,
	PlaneGeometry,
	RepeatWrapping,
	Scene,
	SpotLight,
	SRGBColorSpace,
	TextureLoader,
	TorusGeometry,
	Vector3,
	WebGLCubeRenderTarget,
} from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import Stats from 'three/examples/jsm/libs/stats.module';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { reflector, texture, uv } from 'three/src/nodes/TSL';
import { MeshStandardNodeMaterial, WebGPURenderer } from 'three/webgpu';
import { Pane } from 'tweakpane';

const PUBLIC_PATH = import.meta.env.PROD
	? import.meta.env.VITE_ASSETS_PATH_PRO
	: import.meta.env.VITE_ASSETS_PATH_DEV;
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
		await renderer.init();
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

		const cubeEnvironment = new WebGLCubeRenderTarget(256, {
			generateMipmaps: true,
			minFilter: LinearFilter,
			magFilter: LinearFilter,
		});
		const cubeCamera = new CubeCamera(0.5, 500, cubeEnvironment);
		cubeCamera.layers.set(ENVIRONMENT_LAYER);
		scene.add(cubeCamera);

		/**
		 * Loaders
		 */

		const textureLoader = new TextureLoader();
		textureLoader.setPath(PUBLIC_PATH + 'assets/textures/');

		const gltfLoader = new GLTFLoader();
		gltfLoader.setPath(PUBLIC_PATH + 'assets/modules/');

		/**
		 * Textures
		 */

		const floorNormalTexture = textureLoader.load('terrain-normal.jpg');
		floorNormalTexture.wrapS = floorNormalTexture.wrapT = RepeatWrapping;
		floorNormalTexture.repeat.set(5, 5);

		const floorRoughnessTexture = textureLoader.load('terrain-roughness.jpg');
		floorRoughnessTexture.wrapS = floorRoughnessTexture.wrapT = RepeatWrapping;
		floorRoughnessTexture.repeat.set(5, 5);

		const girdColorTexture = textureLoader.load('grid-texture.png');
		girdColorTexture.wrapS = girdColorTexture.wrapT = RepeatWrapping;
		girdColorTexture.repeat.set(15, 15);
		girdColorTexture.anisotropy = 16;
		girdColorTexture.colorSpace = SRGBColorSpace;

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

		const gridGeometry = new PlaneGeometry(30, 30, 32, 32);
		const gridMaterial = new MeshBasicMaterial({
			transparent: true,
			map: girdColorTexture,
			opacity: 0.05,
		});
		const grid = new Mesh(gridGeometry, gridMaterial);
		grid.rotation.x = -Math.PI / 2;
		grid.position.y = 0.002;
		scene.add(grid);

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

			// scene.add(car);
		});

		// Rings

		const ringsCount = 14;
		const ringsGap = 3.5;

		const rings = new Group();
		rings.layers.enable(ENVIRONMENT_LAYER);

		const ringsGeometry = new TorusGeometry(3.35, 0.05, 10, 100);
		const ringsMaterial = new MeshStandardMaterial({
			color: 'black',
		});

		for (let i = 0; i < ringsCount; i++) {
			const ring = new Mesh(ringsGeometry, ringsMaterial.clone());
			ring.layers.enable(ENVIRONMENT_LAYER);
			ring.castShadow = true;
			ring.receiveShadow = true;

			rings.add(ring);
		}

		scene.add(rings);

		// Boxes

		const boxesCount = 100;

		const boxes = new Group();
		const boxGeometry = new BoxGeometry(1, 1, 1);
		const boxMaterial = new MeshStandardMaterial({ envMapIntensity: 0.15 });
		const boxColorRed = new Color(0.4, 0.1, 0.1);
		const boxColorBlue = new Color(0.05, 0.15, 0.4);

		function initialBoxPosition() {
			const v = new Vector3(
				Math.random() * 2 - 1,
				Math.random() * 2.5 + 0.1,
				(Math.random() * 2 - 1) * 15
			);

			if (v.x < 0) v.x -= 1.75;
			if (v.x > 0) v.x += 1.75;

			return v;
		}

		for (let i = 0; i < boxesCount; i++) {
			const box = new Mesh(boxGeometry, boxMaterial.clone());

			box.position.copy(initialBoxPosition());
			box.scale.setScalar(Math.pow(Math.random(), 2.0) * 0.5 + 0.05);
			box.userData.speed = Math.random();

			if (i % 2 === 1) {
				box.material.color = boxColorRed;
			} else {
				box.material.color = boxColorBlue;
			}

			boxes.add(box);
		}

		scene.add(boxes);

		/**
		 * Light
		 */

		const spotLight1 = new SpotLight(new Color(1, 0.25, 0.7), 230);
		spotLight1.angle = 0.6;
		spotLight1.penumbra = 0.5;
		spotLight1.position.set(5, 5, 0);
		spotLight1.castShadow = true;
		spotLight1.shadow.normalBias = 0.01;
		scene.add(spotLight1);

		const spotLight2 = new SpotLight(new Color(0.14, 0.5, 1.0), 230);
		spotLight2.angle = 0.6;
		spotLight2.penumbra = 0.5;
		spotLight2.position.set(-5, 5, 0);
		spotLight2.castShadow = true;
		spotLight2.shadow.normalBias = 0.01;
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

		function updateRings(time: number) {
			time *= 0.0004;

			for (let i = 0; i < ringsCount; i++) {
				const ring = rings.children[i] as Mesh<
					TorusGeometry,
					MeshStandardMaterial
				>;

				// mul(2) is important
				const z = (7 - i) * ringsGap - (time % 3.5) * 2;

				// [-7, 7]
				const distance = Math.abs(z);

				ring.position.z = z;
				ring.scale.setScalar(1 - distance * 0.04);

				let colorScale = 1.0;

				if (distance > 2) {
					colorScale = 1 - (Math.min(distance, 12) - 2) / 10;
				}
				colorScale *= 0.5;

				if (i % 2 === 1) {
					ring.material.emissive = new Color(6, 0.15, 0.7).multiplyScalar(
						colorScale
					);
				} else {
					ring.material.emissive = new Color(0.1, 0.7, 3).multiplyScalar(
						colorScale
					);
				}
			}
		}

		function updateBoxes(time: number) {
			time *= 0.001;

			for (let i = 0; i < boxesCount; i++) {
				const box = boxes.children[i];

				box.rotation.x = time * box.userData.speed;
				box.rotation.y = time * box.userData.speed;
			}
		}

		function render(time: number = 0) {
			requestAnimationFrame(render);

			controls.update(time);
			stats.update();
			updateRings(time);
			updateBoxes(time);

			girdColorTexture.offset.y = -time * 0.001 * 0.68;
			floorRoughnessTexture.offset.y = -time * 0.001 * 0.128;
			floorNormalTexture.offset.y = -time * 0.001 * 0.128;

			cubeCamera.update(renderer, scene);

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
