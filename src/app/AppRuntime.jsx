import * as React from "react";
import App from "./App.jsx";
import { Web3Provider } from "./providers/Web3Provider.jsx";
import { ContractsProvider } from "./providers/ContractsProvider.jsx";
import { REWARDSProvider } from "./providers/REWARDSProvider.jsx";
import { VRFProvider } from "./providers/VrfProvider.jsx";

export default function AppRuntime() {
  return (
    <Web3Provider>
      <ContractsProvider>
        <VRFProvider>
          <REWARDSProvider>
            <App />
          </REWARDSProvider>
        </VRFProvider>
      </ContractsProvider>
    </Web3Provider>
  );
}
