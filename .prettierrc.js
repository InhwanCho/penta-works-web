/** @type {import("prettier").Config} */
module.exports = {
  semi: true,
  singleQuote: false,
  tabWidth: 2,
  printWidth: 80,
  jsxSingleQuote: false,
  arrowParens: "always",
  endOfLine: "lf",
  plugins: ["prettier-plugin-tailwindcss"],
  singleAttributePerLine: true,
  bracketSameLine: false,
};
