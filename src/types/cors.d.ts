declare module "cors" {
  import type { RequestHandler } from "express";

  type CorsOrigin = boolean | string | RegExp | readonly (string | RegExp)[];

  interface CorsOptions {
    origin?: CorsOrigin;
  }

  function cors(options?: CorsOptions): RequestHandler;

  export default cors;
}
