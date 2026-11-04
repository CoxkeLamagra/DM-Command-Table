import { PublicApiError, RequestTooLargeError } from "./errors.ts";

// Bound parser metadata before the platform's formData() builds fields/files.
// The upload contract allows one image and one optional token-reuse flag.
export function checkMultipartEnvelope(
  bytes: Uint8Array,
  contentType: string,
): void {
  if (contentType.length > 1024)
    throw new PublicApiError("Invalid multipart boundary.");
  const parameters = contentType.split(";");
  if (parameters.shift()?.trim().toLowerCase() !== "multipart/form-data")
    throw new PublicApiError("Invalid multipart content type.");
  const seen = new Set<string>();
  let boundary = "";
  for (const parameter of parameters) {
    const match =
      /^\s*([a-z0-9_-]+)\s*=\s*(?:"([^"\r\n]*)"|([^\s"]+))\s*$/i.exec(
        parameter,
      );
    const name = match?.[1].toLowerCase();
    if (!name || seen.has(name) || !["boundary", "charset"].includes(name))
      throw new PublicApiError("Invalid multipart parameters.");
    seen.add(name);
    if (name === "boundary") boundary = match![2] ?? match![3];
  }
  if (
    !/^[0-9A-Za-z'()+_,.\/:=? -]{1,70}$/.test(boundary) ||
    boundary.endsWith(" ")
  )
    throw new PublicApiError("Invalid multipart boundary.");
  const body = Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const marker = Buffer.from("--" + boundary),
    next = Buffer.from("\r\n--" + boundary);
  if (!body.subarray(0, marker.length).equals(marker))
    throw new PublicApiError("Invalid multipart body.");
  let offset = marker.length,
    parts = 0;
  while (true) {
    if (body.subarray(offset, offset + 2).toString() === "--") {
      const tail = body.subarray(offset + 2);
      if (tail.length && !tail.equals(Buffer.from("\r\n")))
        throw new PublicApiError("Invalid multipart ending.");
      return;
    }
    if (body.subarray(offset, offset + 2).toString() !== "\r\n")
      throw new PublicApiError("Invalid multipart body.");
    if (++parts > 2) throw new RequestTooLargeError();
    const headerEnd = body.indexOf("\r\n\r\n", offset + 2);
    if (headerEnd < 0 || headerEnd - offset > 8192)
      throw new PublicApiError("Invalid multipart headers.");
    let delimiter = body.indexOf(next, headerEnd + 4);
    while (delimiter >= 0) {
      const end = delimiter + next.length;
      const suffix = body.subarray(end, end + 2).toString();
      if (suffix === "--" || suffix === "\r\n") {
        offset = end;
        break;
      }
      delimiter = body.indexOf(next, delimiter + next.length);
    }
    if (delimiter < 0) throw new PublicApiError("Invalid multipart body.");
  }
}
