import * as ReactDOMNamespace from "../../node_modules/react-dom/client.js";

const ReactDOMClient = ReactDOMNamespace.default || ReactDOMNamespace;

export default ReactDOMClient;
export const { createRoot, hydrateRoot } = ReactDOMClient;

