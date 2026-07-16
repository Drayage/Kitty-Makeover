export {};

declare global {
  namespace Cloudflare {
    interface Env {
      DB?: D1Database;
    }
  }
}

declare module "cloudflare:workers" {
  export const env: {
    DB?: D1Database;
  };
}
