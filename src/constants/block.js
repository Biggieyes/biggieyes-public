// src/constants/blocks.js

export const DEFAULT_BLOCKS = [
  "ORANGE",
  "BLACK",
  "WHITE",
  "BROWN",
  "BLUE",
  "GREEN",
  "VIOLET",
  "RED",
  "PINK",
  "RAINBOW",
];

export const ROWS_BY_BLOCK = {
  ORANGE: 10,
  BLACK: 9,
  WHITE: 8,
  BROWN: 7,
  BLUE: 6,
  GREEN: 5,
  VIOLET: 4,
  RED: 3,
  PINK: 2,
  RAINBOW: 1,
};

export const BASE_PRICES = {
  ORANGE: 100,
  BLACK: 200,
  WHITE: 300,
  BROWN: 400,
  BLUE: 500,
  GREEN: 600,
  VIOLET: 700,
  RED: 800,
  PINK: 900,
  RAINBOW: 1000,
};

export const BTN_STYLES = {
  ORANGE: {
    background: "linear-gradient(145deg,#ff8a00,#e67a00)",
    borderColor: "#ffb700",
    color: "#111",
    shadow: "0 5px 15px rgba(255,138,0,.4)",
  },
  BLACK: {
    background: "linear-gradient(145deg,#000,#1a1a1a)",
    borderColor: "#444",
    color: "#ffe800",
    shadow: "0 5px 15px rgba(0,0,0,.6)",
  },
  WHITE: {
    background: "linear-gradient(145deg,#f2f2f2,#d9d9d9)",
    borderColor: "#ddd",
    color: "#111",
    shadow: "0 5px 15px rgba(242,242,242,.4)",
  },
  BROWN: {
    background: "linear-gradient(145deg,#8b5a2b,#754c25)",
    borderColor: "#b07d4a",
    color: "#fff",
    shadow: "0 5px 15px rgba(139,90,43,.4)",
  },
  BLUE: {
    background: "linear-gradient(145deg,#1e90ff,#1a80e6)",
    borderColor: "#a7d5ff",
    color: "#111",
    shadow: "0 5px 15px rgba(30,144,255,.4)",
  },
  GREEN: {
    background: "linear-gradient(145deg,#00c777,#00b369)",
    borderColor: "#82f5c9",
    color: "#111",
    shadow: "0 5px 15px rgba(0,199,119,.4)",
  },
  VIOLET: {
    background: "linear-gradient(145deg,#7a5cff,#6b52e6)",
    borderColor: "#c5b8ff",
    color: "#111",
    shadow: "0 5px 15px rgba(122,92,255,.4)",
  },
  RED: {
    background: "linear-gradient(145deg,#ff3b3b,#e63535)",
    borderColor: "#ffc0c0",
    color: "#111",
    shadow: "0 5px 15px rgba(255,59,59,.4)",
  },
  PINK: {
    background: "linear-gradient(145deg,#ff69b4,#e65ea2)",
    borderColor: "#ffd0e4",
    color: "#111",
    shadow: "0 5px 15px rgba(255,105,180,.4)",
  },
  RAINBOW: {
    background:
      "linear-gradient(145deg,#ff4d4d,#ffae00,#ffe800,#00e6a8,#5ddcff,#a98bff)",
    borderColor: "#ffe800",
    color: "#111",
    shadow: "0 5px 15px rgba(255,237,0,.5)",
  },
};

export const FALLBACK_BTN_STYLE = {
  background: "linear-gradient(145deg,#111,#333)",
  borderColor: "#ffe800",
  color: "#ffe800",
  shadow: "0 5px 15px rgba(255,232,0,.3)",
};

// ✅ EXPORTUJEME BLOCK_IMAGES
import BLOCK_IMAGES from "./blockImages";
export { BLOCK_IMAGES };

