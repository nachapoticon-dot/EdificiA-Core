import nextConfig from "eslint-config-next";

const config = [
  ...nextConfig,
  {
    ignores: ["design_handoff_edificia/**"],
  },
];

export default config;
