// Minimal process polyfill for the browser. Avoids importing process/browser
// to sidestep default export issues in ESM/CJS interop during build.
const noop = () => {};
const process = {
	env: {},
	argv: [],
	version: "",
	versions: {},
	browser: true,
	cwd: () => "/",
	chdir: noop,
	nextTick: (cb, ...args) => queueMicrotask(() => cb(...args)),
};

export { process };
export default process;
