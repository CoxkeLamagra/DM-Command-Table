export function legacyApiRetired(): Response {
  return Response.json(
    { error: "This legacy API has been retired. Use the v6 API." },
    {
      status: 410,
      headers: {
        "cache-control": "private, no-store, max-age=0",
        pragma: "no-cache",
      },
    },
  );
}
