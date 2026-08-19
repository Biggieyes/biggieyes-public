import { createRequire } from "module";
const require = createRequire(import.meta.url);
const ReactDOMClient = require("react-dom/client");

export default ReactDOMClient;
export const { createRoot, hydrateRoot } = ReactDOMClient;

