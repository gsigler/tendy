import crypto from "node:crypto";
import type { Response } from "express";
import bcrypt from "bcryptjs";
import { eq, and, lt } from "drizzle-orm";
import type {
  OAuthServerProvider,
  AuthorizationParams,
} from "@modelcontextprotocol/sdk/server/auth/provider.js";
import type { OAuthRegisteredClientsStore } from "@modelcontextprotocol/sdk/server/auth/clients.js";
import type { AuthInfo } from "@modelcontextprotocol/sdk/server/auth/types.js";
import type {
  OAuthClientInformationFull,
  OAuthTokens,
  OAuthTokenRevocationRequest,
} from "@modelcontextprotocol/sdk/shared/auth.js";
import { db } from "../db/index.js";
import {
  oauthClients,
  oauthCodes,
  oauthTokens,
  users,
} from "../db/schema.js";
import { authenticateBearer } from "../middleware/auth.js";

// ── Helpers ─────────────────────────────────────────────────────────────

function randomToken(bytes = 32): string {
  return crypto.randomBytes(bytes).toString("hex");
}

const ACCESS_TOKEN_TTL = 60 * 60; // 1 hour in seconds
const REFRESH_TOKEN_TTL = 30 * 24 * 60 * 60; // 30 days in seconds
const AUTH_CODE_TTL = 10 * 60; // 10 minutes in seconds

// ── Clients Store ─────────────────────────────────────────────────────

class TendyClientsStore implements OAuthRegisteredClientsStore {
  async getClient(
    clientId: string,
  ): Promise<OAuthClientInformationFull | undefined> {
    const [row] = await db
      .select()
      .from(oauthClients)
      .where(eq(oauthClients.clientId, clientId))
      .limit(1);

    if (!row) return undefined;

    return {
      client_id: row.clientId,
      client_secret: row.clientSecret ?? undefined,
      client_id_issued_at: row.clientIdIssuedAt,
      client_secret_expires_at: row.clientSecretExpiresAt ?? undefined,
      redirect_uris: row.redirectUris as string[],
      client_name: row.clientName ?? undefined,
      token_endpoint_auth_method:
        row.tokenEndpointAuthMethod ?? undefined,
      grant_types: (row.grantTypes as string[] | null) ?? undefined,
      response_types: (row.responseTypes as string[] | null) ?? undefined,
      scope: row.scope ?? undefined,
    };
  }

  async registerClient(
    client: Omit<OAuthClientInformationFull, "client_id" | "client_id_issued_at">,
  ): Promise<OAuthClientInformationFull> {
    const clientId = `tendy_cl_${randomToken(16)}`;
    const clientSecret = client.client_secret ?? undefined;
    const now = Math.floor(Date.now() / 1000);

    await db.insert(oauthClients).values({
      clientId,
      clientSecret: clientSecret ?? null,
      clientIdIssuedAt: now,
      clientSecretExpiresAt:
        (client.client_secret_expires_at as number | undefined) ?? null,
      redirectUris: client.redirect_uris.map((u) => u.toString()),
      clientName: client.client_name ?? null,
      tokenEndpointAuthMethod:
        client.token_endpoint_auth_method ?? null,
      grantTypes: (client.grant_types as string[] | undefined) ?? null,
      responseTypes:
        (client.response_types as string[] | undefined) ?? null,
      scope: client.scope ?? null,
    });

    return {
      ...client,
      client_id: clientId,
      client_id_issued_at: now,
    };
  }
}

// ── OAuth Provider ────────────────────────────────────────────────────

export class TendyOAuthProvider implements OAuthServerProvider {
  clientsStore = new TendyClientsStore();

  /**
   * Renders a simple login form and handles authorization.
   * On successful login, creates an auth code and redirects back to the client.
   */
  async authorize(
    client: OAuthClientInformationFull,
    params: AuthorizationParams,
    res: Response,
  ): Promise<void> {
    // Render login form
    const formHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Sign in to Tendy</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #0f1117; color: #e4e4e7; display: flex; justify-content: center; align-items: center; min-height: 100vh; }
    .card { background: #1c1c22; border-radius: 12px; padding: 2rem; width: 100%; max-width: 400px; box-shadow: 0 4px 24px rgba(0,0,0,0.4); }
    h1 { font-size: 1.5rem; margin-bottom: 0.25rem; }
    .subtitle { color: #71717a; margin-bottom: 1.5rem; font-size: 0.9rem; }
    label { display: block; font-size: 0.875rem; margin-bottom: 0.25rem; color: #a1a1aa; }
    input { width: 100%; padding: 0.75rem; border: 1px solid #27272a; border-radius: 8px; background: #09090b; color: #fafafa; font-size: 1rem; margin-bottom: 1rem; }
    input:focus { outline: none; border-color: #22c55e; }
    button { width: 100%; padding: 0.75rem; background: #22c55e; color: #000; border: none; border-radius: 8px; font-size: 1rem; font-weight: 600; cursor: pointer; }
    button:hover { background: #16a34a; }
    .error { color: #ef4444; font-size: 0.875rem; margin-bottom: 1rem; display: none; }
    .app-name { color: #71717a; font-size: 0.85rem; margin-bottom: 1.5rem; }
  </style>
</head>
<body>
  <div class="card">
    <h1>Sign in to Tendy</h1>
    <p class="subtitle">Authorize access to your garden data</p>
    ${client.client_name ? `<p class="app-name">Requested by: ${client.client_name}</p>` : ""}
    <div class="error" id="error"></div>
    <form id="loginForm" method="POST" action="/oauth/login">
      <input type="hidden" name="client_id" value="${client.client_id}" />
      <input type="hidden" name="redirect_uri" value="${params.redirectUri}" />
      <input type="hidden" name="code_challenge" value="${params.codeChallenge}" />
      <input type="hidden" name="state" value="${params.state || ""}" />
      <input type="hidden" name="scope" value="${(params.scopes || []).join(" ")}" />
      <input type="hidden" name="resource" value="${params.resource?.toString() || ""}" />
      <label for="email">Email</label>
      <input type="email" id="email" name="email" required autocomplete="email" />
      <label for="password">Password</label>
      <input type="password" id="password" name="password" required autocomplete="current-password" />
      <button type="submit">Sign in & Authorize</button>
    </form>
  </div>
</body>
</html>`;

    res.setHeader("Content-Type", "text/html");
    res.status(200).send(formHtml);
  }

  /**
   * Handle the login form submission: validate credentials, create auth code, redirect.
   */
  async handleLogin(
    body: {
      email: string;
      password: string;
      client_id: string;
      redirect_uri: string;
      code_challenge: string;
      state?: string;
      scope?: string;
      resource?: string;
    },
  ): Promise<{ redirectUrl: string } | { error: string }> {
    // Validate user credentials
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.email, body.email))
      .limit(1);

    if (!user) return { error: "Invalid email or password" };

    const valid = await bcrypt.compare(body.password, user.passwordHash);
    if (!valid) return { error: "Invalid email or password" };

    // Create authorization code
    const code = randomToken(32);
    const expiresAt = new Date(Date.now() + AUTH_CODE_TTL * 1000);

    await db.insert(oauthCodes).values({
      code,
      clientId: body.client_id,
      userId: user.id,
      codeChallenge: body.code_challenge,
      redirectUri: body.redirect_uri,
      scope: body.scope || null,
      resource: body.resource || null,
      expiresAt,
    });

    // Build redirect URL with code and state
    const redirectUrl = new URL(body.redirect_uri);
    redirectUrl.searchParams.set("code", code);
    if (body.state) {
      redirectUrl.searchParams.set("state", body.state);
    }

    return { redirectUrl: redirectUrl.toString() };
  }

  async challengeForAuthorizationCode(
    _client: OAuthClientInformationFull,
    authorizationCode: string,
  ): Promise<string> {
    const [row] = await db
      .select()
      .from(oauthCodes)
      .where(eq(oauthCodes.code, authorizationCode))
      .limit(1);

    if (!row) throw new Error("Invalid authorization code");
    if (new Date() > row.expiresAt) {
      await db.delete(oauthCodes).where(eq(oauthCodes.code, authorizationCode));
      throw new Error("Authorization code expired");
    }

    return row.codeChallenge;
  }

  async exchangeAuthorizationCode(
    client: OAuthClientInformationFull,
    authorizationCode: string,
    _codeVerifier?: string,
    _redirectUri?: string,
    resource?: URL,
  ): Promise<OAuthTokens> {
    // Look up and consume the auth code
    const [codeRow] = await db
      .select()
      .from(oauthCodes)
      .where(
        and(
          eq(oauthCodes.code, authorizationCode),
          eq(oauthCodes.clientId, client.client_id),
        ),
      )
      .limit(1);

    if (!codeRow) throw new Error("Invalid authorization code");
    if (new Date() > codeRow.expiresAt) throw new Error("Authorization code expired");

    // Delete the consumed code
    await db.delete(oauthCodes).where(eq(oauthCodes.code, authorizationCode));

    // Generate tokens
    const accessToken = `tndy_at_${randomToken(32)}`;
    const refreshToken = `tndy_rt_${randomToken(32)}`;
    const now = new Date();
    const resourceStr = resource?.toString() || codeRow.resource;

    await db.insert(oauthTokens).values([
      {
        token: accessToken,
        tokenType: "access",
        clientId: client.client_id,
        userId: codeRow.userId,
        scope: codeRow.scope,
        resource: resourceStr,
        expiresAt: new Date(now.getTime() + ACCESS_TOKEN_TTL * 1000),
      },
      {
        token: refreshToken,
        tokenType: "refresh",
        clientId: client.client_id,
        userId: codeRow.userId,
        scope: codeRow.scope,
        resource: resourceStr,
        expiresAt: new Date(now.getTime() + REFRESH_TOKEN_TTL * 1000),
      },
    ]);

    return {
      access_token: accessToken,
      token_type: "Bearer",
      expires_in: ACCESS_TOKEN_TTL,
      refresh_token: refreshToken,
      scope: codeRow.scope ?? undefined,
    };
  }

  async exchangeRefreshToken(
    client: OAuthClientInformationFull,
    refreshToken: string,
    scopes?: string[],
    resource?: URL,
  ): Promise<OAuthTokens> {
    const [row] = await db
      .select()
      .from(oauthTokens)
      .where(
        and(
          eq(oauthTokens.token, refreshToken),
          eq(oauthTokens.tokenType, "refresh"),
          eq(oauthTokens.clientId, client.client_id),
        ),
      )
      .limit(1);

    if (!row) throw new Error("Invalid refresh token");
    if (new Date() > row.expiresAt) throw new Error("Refresh token expired");

    // Rotate: delete old refresh token, create new tokens
    await db.delete(oauthTokens).where(eq(oauthTokens.token, refreshToken));

    const newAccessToken = `tndy_at_${randomToken(32)}`;
    const newRefreshToken = `tndy_rt_${randomToken(32)}`;
    const now = new Date();
    const scope = scopes?.join(" ") || row.scope;
    const resourceStr = resource?.toString() || row.resource;

    await db.insert(oauthTokens).values([
      {
        token: newAccessToken,
        tokenType: "access",
        clientId: client.client_id,
        userId: row.userId,
        scope,
        resource: resourceStr,
        expiresAt: new Date(now.getTime() + ACCESS_TOKEN_TTL * 1000),
      },
      {
        token: newRefreshToken,
        tokenType: "refresh",
        clientId: client.client_id,
        userId: row.userId,
        scope,
        resource: resourceStr,
        expiresAt: new Date(now.getTime() + REFRESH_TOKEN_TTL * 1000),
      },
    ]);

    return {
      access_token: newAccessToken,
      token_type: "Bearer",
      expires_in: ACCESS_TOKEN_TTL,
      refresh_token: newRefreshToken,
      scope: scope ?? undefined,
    };
  }

  /**
   * Verifies an access token. Checks OAuth tokens first, then falls back
   * to the existing JWT / API key auth for backward compatibility.
   */
  async verifyAccessToken(token: string): Promise<AuthInfo> {
    // Try OAuth access token first
    const [row] = await db
      .select()
      .from(oauthTokens)
      .where(
        and(
          eq(oauthTokens.token, token),
          eq(oauthTokens.tokenType, "access"),
        ),
      )
      .limit(1);

    if (row) {
      if (new Date() > row.expiresAt) {
        throw new Error("Token expired");
      }
      return {
        token,
        clientId: row.clientId,
        scopes: row.scope ? row.scope.split(" ") : [],
        expiresAt: Math.floor(row.expiresAt.getTime() / 1000),
        resource: row.resource ? new URL(row.resource) : undefined,
        extra: { userId: row.userId },
      };
    }

    // Fall back to existing JWT / API key auth
    const auth = await authenticateBearer(token);
    if (auth) {
      return {
        token,
        clientId: "legacy",
        scopes: [],
        expiresAt: Math.floor(Date.now() / 1000) + 3600,
        extra: { userId: auth.userId },
      };
    }

    throw new Error("Invalid access token");
  }

  async revokeToken(
    _client: OAuthClientInformationFull,
    request: OAuthTokenRevocationRequest,
  ): Promise<void> {
    await db.delete(oauthTokens).where(eq(oauthTokens.token, request.token));
  }
}

// Periodically clean up expired codes and tokens (every hour)
setInterval(
  async () => {
    try {
      const now = new Date();
      await db.delete(oauthCodes).where(lt(oauthCodes.expiresAt, now));
      await db.delete(oauthTokens).where(lt(oauthTokens.expiresAt, now));
    } catch {
      // Silently ignore cleanup errors
    }
  },
  60 * 60 * 1000,
);
