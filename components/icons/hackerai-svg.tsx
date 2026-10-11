import type { FC } from "react";

interface HackerAISVGProps {
  theme: "dark" | "light";
  scale?: number;
}

// Pixel-art DiggerAI drill mark, traced at 4px from a 1024px source (94x183 cells).
export const HackerAISVG: FC<HackerAISVGProps> = ({ theme, scale = 1 }) => {
  const fillColor = theme === "dark" ? "#fff" : "#000";

  return (
    <svg
      width={100 * scale}
      height={194 * scale}
      viewBox="0 0 94 183"
      fill="none"
      shapeRendering="crispEdges"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        fill={fillColor}
        fillRule="evenodd"
        d="M6 0h82v6h6v17h-6v5h-5v4h-1v1h-70v-1h-1v-4h-5v-5h-6v-17h6zM12 6v16h5v-5h60v5h5v-16h-5v5h-1v1h-58v-1h-1v-5zM14 37h66v10h-5v10h-5v6h-5v2h-36v-2h-5v-6h-5v-10h-5zM29 43v16h5v-16zM44 43v16h5v-2h1v-14zM60 43v16h5v-16zM30 69h23v3h-3v1h-1v3h-5v4h-4v4h-1v1h-4v3h-5zM59 69h5v17h-3v4h-1v1h-2v3h-1v1h-4v3h-1v1h-3v2h-1v1h-4v3h-4v4h-5v4h-3v5h-6v-1h-1v-3h1v-1h4v-16h5v-4h4v-1h1v-1h-1v-2h5v-4h1v-1h4v-4h5v-4h5zM58 98h5v15h-19v-2h4v-1h1v-3h4v-4h4v-4h1zM66 113h5v5h-5v-1h-1v-3h1zM38 117h22v4h-4v2h-1v1h-4v3h-4v2h-1v1h-4v2h-9v-11h4v-3h1zM56 127h6v9h-4v4h-1v1h-2v4h-3v7h-1v1h-2v5h-2v3h-2v-1h-1v-6h-3v-4h-4v-10h-3v-3h3v2h6v-3h9v-5h4zM23 131h5v1h1v4h-6zM58 154h5v6h-5zM30 160h5v5h-5zM43 170h6v4h-1v1h-5zM53 177h5v6h-5z"
      />
    </svg>
  );
};
