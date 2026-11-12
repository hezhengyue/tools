import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      // 本站所有 <img> 都来自用户本地的 Blob URL / Data URI（图片压缩、虚化、
      // Base64 预览、站点 logo），next/image 的静态优化链路不适用；
      // 因此关闭该提示，而不是到处加 eslint-disable。
      "@next/next/no-img-element": "off",
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
