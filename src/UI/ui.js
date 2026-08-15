import REWARDS from "/images/icons/rewards.optimized.png";
import COLLECTION from "/images/icons/collection.optimized.png";
import mint from "/images/icons/mint.optimized.png";
import token from "/images/icons/token.optimized.png";
import users from "/images/icons/users.optimized.png";
import expansion from "/images/icons/expansion.optimized.png";

/**
 * Top nav icons — kept 1:1 with original App.jsx.
 * Order and alt names are important; they map to panel switching logic.
 */
export const ICONS = [
  { src: REWARDS, alt: "REWARDS", modalText: "REWARDS and Staking" },
  { src: COLLECTION, alt: "COLLECTION", modalText: "NFT COLLECTION" },
  { src: mint, alt: "VRF MINT", modalText: "Mint NFTs and VRF" },
  {
    src: token,
    alt: "BIGGI ECOSYSTEM",
    modalText: "ECOSYSTEM Data and Liquidity",
  },
  { src: users, alt: "USERS", modalText: "Users and Holders" },
  { src: expansion, alt: "COMMUNITY CENTER", modalText: "Community Center" },
];





