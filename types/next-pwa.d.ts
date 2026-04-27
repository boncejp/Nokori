declare module "next-pwa" {
  import type { NextConfig } from "next";

  type NextPwaOptions = {
    dest: string;
    disable?: boolean;
  };

  type NextPwaWrapper = (config: NextConfig) => NextConfig;

  export default function createNextPWA(options: NextPwaOptions): NextPwaWrapper;
}
