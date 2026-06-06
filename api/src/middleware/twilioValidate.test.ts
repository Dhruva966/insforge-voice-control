import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Request, Response, NextFunction } from "express";

// Mock config
vi.mock("../config", () => ({
  config: {
    NODE_ENV: "production",
    TWILIO_AUTH_TOKEN: "test_auth_token",
    TWILIO_WEBHOOK_BASE: "https://test.ngrok.io",
  },
}));

// Mock twilio
const mockValidateRequest = vi.fn();
vi.mock("twilio", () => ({
  default: Object.assign(vi.fn(), {
    validateRequest: (...args: unknown[]) => mockValidateRequest(...args),
  }),
}));

import { twilioValidate } from "./twilioValidate";
import { config } from "../config";

describe("twilioValidate middleware", () => {
  let req: Partial<Request>;
  let res: Partial<Response>;
  let next: NextFunction;

  beforeEach(() => {
    req = {
      headers: { "x-twilio-signature": "valid-signature" },
      originalUrl: "/voice",
      body: { CallSid: "CA123", From: "+1234567890" },
    };
    res = {
      status: vi.fn().mockReturnThis(),
      send: vi.fn().mockReturnThis(),
    };
    next = vi.fn();
    mockValidateRequest.mockReset();
  });

  it("skips validation in development mode", () => {
    // Temporarily override NODE_ENV
    const originalEnv = config.NODE_ENV;
    (config as { NODE_ENV: string }).NODE_ENV = "development";

    twilioValidate(req as Request, res as Response, next);

    expect(next).toHaveBeenCalled();
    expect(mockValidateRequest).not.toHaveBeenCalled();

    (config as { NODE_ENV: string }).NODE_ENV = originalEnv;
  });

  it("calls next() when signature is valid", () => {
    mockValidateRequest.mockReturnValue(true);

    twilioValidate(req as Request, res as Response, next);

    expect(mockValidateRequest).toHaveBeenCalledWith(
      "test_auth_token",
      "valid-signature",
      "https://test.ngrok.io/voice",
      req.body
    );
    expect(next).toHaveBeenCalled();
  });

  it("returns 403 when signature is invalid", () => {
    mockValidateRequest.mockReturnValue(false);

    twilioValidate(req as Request, res as Response, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.send).toHaveBeenCalledWith("Forbidden");
    expect(next).not.toHaveBeenCalled();
  });

  it("uses the correct webhook URL + originalUrl for validation", () => {
    req.originalUrl = "/voice/status";
    mockValidateRequest.mockReturnValue(true);

    twilioValidate(req as Request, res as Response, next);

    expect(mockValidateRequest).toHaveBeenCalledWith(
      "test_auth_token",
      "valid-signature",
      "https://test.ngrok.io/voice/status",
      req.body
    );
  });
});
