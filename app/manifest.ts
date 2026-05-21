import type { MetadataRoute } from "next";

import { NOKORI_APP_ICON_PATH } from "@/lib/constants/brand";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "Nokori",
    short_name: "Nokori",
    description:
      "貯金目標に沿って「今日いくら使っていいか」を一目で把握する、貯金伴走型の家計アプリ。",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#f7f8fa",
    theme_color: "#001f3f",
    orientation: "portrait-primary",
    icons: [
      {
        src: NOKORI_APP_ICON_PATH,
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: NOKORI_APP_ICON_PATH,
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: NOKORI_APP_ICON_PATH,
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
