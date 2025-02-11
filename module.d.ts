declare module '*.glsl' {
	const content: string;
	export default content;
}

declare module 'three/webgpu' {
	export * from 'three/build/three.webgpu';
}
