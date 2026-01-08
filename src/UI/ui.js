import info from "/images/icons/info.png";
import rewards from "/images/icons/rewards.png";
import collection from "/images/icons/collection.png";
import mint from "/images/icons/mint.png";
import token from "/images/icons/token.png";
import users from "/images/icons/users.png";
import expansion from "/images/icons/expansion.png";

/**
 * Top nav icons — kept 1:1 with original App.jsx.
 * Order and alt names are important; they map to panel switching logic.
 */
export const ICONS = [
  { src: info, alt: "INFO", modalText: "Information and Overview" },
  { src: rewards, alt: "REWARDS", modalText: "Rewards and Staking" },
  { src: collection, alt: "COLLECTION", modalText: "NFT Collection" },
  { src: mint, alt: "VRF MINT", modalText: "Mint NFTs and VRF" },
  {
    src: token,
    alt: "BIGGI ECOSYSTEM",
    modalText: "Ecosystem Data and Liquidity",
  },
  { src: users, alt: "USERS", modalText: "Users and Holders" },
  { src: expansion, alt: "COMMUNITY CENTER", modalText: "Community Center" },
];
