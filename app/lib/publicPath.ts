export const PUBLIC_BASE_PATH = (process.env.NEXT_PUBLIC_BASE_PATH ?? "").replace(/\/$/, "");

export const publicPath = (path: string) =>
  `${PUBLIC_BASE_PATH}${path.startsWith("/") ? path : `/${path}`}`;
