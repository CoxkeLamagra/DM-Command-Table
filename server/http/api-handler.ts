import { apiError, apiJson } from "./http.ts";
import { rejectCrossOrigin } from "./origin.ts";
import {
  permittedPublicRequest,
  publicOrigin,
} from "../security/public-origin.ts";

// API routes intentionally bypass the HTML proxy: that proxy clones/buffers
// request bodies before handlers, defeating streaming admission/deadlines.
export function apiHandler<Args extends unknown[]>(
  handler: (request: Request, ...args: Args) => Response | Promise<Response>,
) {
  return async (request: Request, ...args: Args): Promise<Response> => {
    try {
      const configured = publicOrigin();
      if (
        !permittedPublicRequest(
          request.headers,
          new URL(request.url).pathname,
          configured,
        )
      )
        return apiJson({ error: "Invalid request origin." }, 403);
      if (!["GET", "HEAD", "OPTIONS"].includes(request.method)) {
        const rejected = rejectCrossOrigin(request);
        if (rejected) return rejected;
      }
      const response = await handler(request, ...args);
      if (configured)
        response.headers.set("Strict-Transport-Security", "max-age=15552000");
      return response;
    } catch (error) {
      return apiError(error);
    }
  };
}
