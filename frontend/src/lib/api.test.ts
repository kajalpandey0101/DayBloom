import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiError, api } from "./api";

afterEach(() => {
  vi.unstubAllGlobals();
  document.cookie = "csrftoken=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/";
});

describe("api", () => {
  it("reports HTML login responses as API routing errors instead of JSON parse errors", async () => {
    document.cookie = "csrftoken=cookie-token; path=/";
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ csrfToken: "fetched-json-token" }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      )
      .mockResolvedValueOnce(
        new Response("<!DOCTYPE html>", {
          status: 200,
          headers: { "Content-Type": "text/html" },
        }),
      );
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      api("/auth/login/", {
        method: "POST",
        body: JSON.stringify({ username: "user", password: "password" }),
      }),
    ).rejects.toMatchObject({
      name: "ApiError",
      message: "The server returned a non-JSON response (HTTP 200). Check the API URL and ensure the Django backend is running.",
      status: 200,
    });
    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining("/auth/csrf/"),
      { credentials: "include" },
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining("/auth/login/"),
      expect.objectContaining({ method: "POST", credentials: "include" }),
    );
    const loginRequest = fetchMock.mock.calls[1][1] as RequestInit;
    expect(new Headers(loginRequest.headers).get("X-CSRFToken")).toBe("fetched-json-token");
  });

  it("preserves JSON API error messages", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ detail: "Invalid credentials." }), {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }),
      ),
    );

    await expect(api("/auth/login/")).rejects.toEqual(
      expect.objectContaining(new ApiError("Invalid credentials.", 400)),
    );
  });
});
