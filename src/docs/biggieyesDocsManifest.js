export const BIGGIEYES_DOC_SECTIONS = [
  {
    title: "Core Protocol",
    docs: [
      { file: "README.md", label: "README" },
      { file: "PROJECT_OVERVIEW.md", label: "Project Overview" },
      { file: "ARCHITECTURE.md", label: "Architecture" },
      { file: "TOKENOMICS.md", label: "Tokenomics" },
      { file: "NFT_SYSTEM.md", label: "NFT System" },
      { file: "SMART_CONTRACTS.md", label: "Smart Contracts" },
      { file: "SECURITY_MODEL.md", label: "Security Model" },
      {
        file: "TRUST_AND_TRANSPARENCY.md",
        label: "Trust And Transparency",
      },
    ],
  },
  {
    title: "Frontend And Developer Docs",
    docs: [
      { file: "FRONTEND_ARCHITECTURE.md", label: "Frontend Architecture" },
      { file: "FRONTEND_INTEGRATION.md", label: "Frontend Integration" },
      { file: "DEPLOYMENT_GUIDE.md", label: "Deployment Guide" },
      { file: "DEVELOPER_GUIDE.md", label: "Developer Guide" },
      { file: "CONTRIBUTING.md", label: "Contributing" },
      { file: "GLOSSARY.md", label: "Glossary" },
    ],
  },
  {
    title: "Strategy And Narrative",
    docs: [
      { file: "WHITEPAPER.md", label: "Whitepaper" },
      { file: "LITEPAPER.md", label: "Litepaper" },
      { file: "ROADMAP.md", label: "Roadmap" },
      { file: "INVESTOR_OVERVIEW.md", label: "Investor Overview" },
      { file: "PITCH_DECK.md", label: "Pitch Deck" },
    ],
  },
  {
    title: "Operational References",
    docs: [
      { file: "ARCHITECTURE_DIAGRAMS.md", label: "Architecture Diagrams" },
      { file: "USER_FLOWS.md", label: "User Flows" },
      { file: "VISUAL_DIAGRAM_PROMPTS.md", label: "Visual Diagram Prompts" },
    ],
  },
  {
    title: "Marketing Materials",
    docs: [
      { file: "WEBSITE_DESCRIPTION.md", label: "Website Description" },
      { file: "SOCIAL_MEDIA_SUMMARY.md", label: "Social Media Summary" },
      { file: "ELEVATOR_PITCH.md", label: "Elevator Pitch" },
    ],
  },
];

export const BIGGIEYES_DOCS = BIGGIEYES_DOC_SECTIONS.flatMap(
  (section) => section.docs,
);

export const BIGGIEYES_DEFAULT_DOC = "README.md";

export const BIGGIEYES_DOC_FILES = new Set(
  BIGGIEYES_DOCS.map((doc) => doc.file),
);

