import sharp from "sharp";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const source = join(root, "public", "icon.svg");
const targets = [
  ["icon-192.png", 192, false],
  ["icon-512.png", 512, false],
  ["icon-maskable-512.png", 512, true],
  ["apple-touch-icon.png", 180, true]
];

await Promise.all(targets.map(([name, size, opaque]) =>
  (opaque ? sharp(source).flatten({ background: "#080b14" }) : sharp(source))
    .resize(size, size).png({ compressionLevel: 9 }).toFile(join(root, "public", name))
));
