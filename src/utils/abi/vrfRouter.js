// src/utils/abi/vrfRouter.js
export const ABI_VRF = [
  {
    "anonymous": false,
    "inputs": [{ "indexed": true, "internalType": "address", "name": "coordinator", "type": "address" }],
    "name": "CoordinatorSet",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [{ "indexed": true, "internalType": "address", "name": "main", "type": "address" }],
    "name": "MainSet",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      { "indexed": true, "internalType": "address", "name": "previousOwner", "type": "address" },
      { "indexed": true, "internalType": "address", "name": "newOwner", "type": "address" }
    ],
    "name": "OwnershipTransferred",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      { "indexed": false, "internalType": "uint256", "name": "requestId", "type": "uint256" },
      { "indexed": false, "internalType": "uint256", "name": "randomWord", "type": "uint256" }
    ],
    "name": "RandomFulfilled",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      { "indexed": true, "internalType": "address", "name": "minter", "type": "address" },
      { "indexed": false, "internalType": "uint256", "name": "ticketId", "type": "uint256" },
      { "indexed": false, "internalType": "uint256", "name": "requestId", "type": "uint256" }
    ],
    "name": "RandomRequested",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      { "indexed": false, "internalType": "bytes32", "name": "keyHash", "type": "bytes32" },
      { "indexed": false, "internalType": "uint256", "name": "subId", "type": "uint256" },
      { "indexed": false, "internalType": "uint32", "name": "gasLimit", "type": "uint32" },
      { "indexed": false, "internalType": "uint16", "name": "conf", "type": "uint16" },
      { "indexed": false, "internalType": "uint32", "name": "numWords", "type": "uint32" }
    ],
    "name": "VrfParamsUpdated",
    "type": "event"
  },

  { "inputs": [], "name": "callbackGasLimit", "outputs": [{ "internalType": "uint32", "name": "", "type": "uint32" }], "stateMutability": "view", "type": "function" },
  { "inputs": [], "name": "coordinator", "outputs": [{ "internalType": "contract VRFCoordinatorV2PlusInterface", "name": "", "type": "address" }], "stateMutability": "view", "type": "function" },
  { "inputs": [], "name": "keyHash", "outputs": [{ "internalType": "bytes32", "name": "", "type": "bytes32" }], "stateMutability": "view", "type": "function" },
  { "inputs": [], "name": "main", "outputs": [{ "internalType": "address", "name": "", "type": "address" }], "stateMutability": "view", "type": "function" },
  { "inputs": [], "name": "numWords", "outputs": [{ "internalType": "uint32", "name": "", "type": "uint32" }], "stateMutability": "view", "type": "function" },
  { "inputs": [], "name": "owner", "outputs": [{ "internalType": "address", "name": "", "type": "address" }], "stateMutability": "view", "type": "function" },

  {
    "inputs": [
      { "internalType": "uint256", "name": "requestId", "type": "uint256" },
      { "internalType": "uint256[]", "name": "randomWords", "type": "uint256[]" }
    ],
    "name": "rawFulfillRandomWords",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },

  { "inputs": [], "name": "renounceOwnership", "outputs": [], "stateMutability": "nonpayable", "type": "function" },

  { "inputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }], "name": "reqMinter", "outputs": [{ "internalType": "address", "name": "", "type": "address" }], "stateMutability": "view", "type": "function" },
  { "inputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }], "name": "reqTicket", "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }], "stateMutability": "view", "type": "function" },

  { "inputs": [], "name": "requestConfirmations", "outputs": [{ "internalType": "uint16", "name": "", "type": "uint16" }], "stateMutability": "view", "type": "function" },

  {
    "inputs": [
      { "internalType": "address", "name": "minter", "type": "address" },
      { "internalType": "uint256", "name": "ticketId", "type": "uint256" }
    ],
    "name": "requestRandomFor",
    "outputs": [{ "internalType": "uint256", "name": "requestId", "type": "uint256" }],
    "stateMutability": "nonpayable",
    "type": "function"
  },

  { "inputs": [{ "internalType": "address", "name": "main_", "type": "address" }], "name": "setMain", "outputs": [], "stateMutability": "nonpayable", "type": "function" },

  {
    "inputs": [
      { "internalType": "bytes32", "name": "keyHash_", "type": "bytes32" },
      { "internalType": "uint256", "name": "subId_", "type": "uint256" },
      { "internalType": "uint32", "name": "gas_", "type": "uint32" },
      { "internalType": "uint16", "name": "conf_", "type": "uint16" },
      { "internalType": "uint32", "name": "numWords_", "type": "uint32" }
    ],
    "name": "setVrfParams",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },

  { "inputs": [], "name": "subId", "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }], "stateMutability": "view", "type": "function" },

  { "inputs": [{ "internalType": "address", "name": "newOwner", "type": "address" }], "name": "transferOwnership", "outputs": [], "stateMutability": "nonpayable", "type": "function" }
];
