import { useState } from "react";

function randomHash(len: number) {
  return Array.from(
    window.crypto.getRandomValues(new Uint8Array(Math.ceil(len / 2))),
    (b) => ("0" + (b & 0xFF).toString(16)).slice(-2)
  ).join("")
}

const generateCodeChallenge = async (verifier: string) => {
  const encoder = new TextEncoder();
  const data = encoder.encode(verifier);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return btoa(String.fromCharCode(...new Uint8Array(hash)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
};

export function usePKCEAuth() {
  const [error, setError] = useState<string | undefined>()

  const login = async (url: string, redirect_uri: string, scopes?: string[]) => {
    try {

      const codeVerifier = randomHash(128);
      const codeChallenge = await generateCodeChallenge(codeVerifier);
      const state = randomHash(64);

      sessionStorage.setItem("pkceSession", JSON.stringify({ codeVerifier, state }));


      const params = new URLSearchParams({
        client_id: import.meta.env.VITE_CLIENT_ID,
        redirect_uri: redirect_uri,
        response_type: 'code',
        code_challenge: codeChallenge,
        code_challenge_method: 'S256',
        state: state
      });

      if (Array.isArray(scopes) && scopes?.length) {
        params.append("scope", scopes.join(" "))
      }

      window.location['assign'](`${url}?${params}`);
    } catch (err: any) {
      setError('Failed to initiate login: ' + err.message);
    }

  }

  const getToken = async (url: string, redirect_uri: string, code: string, codeVerifier: string) => {
    try {
      const params = new URLSearchParams({
        client_id: import.meta.env.VITE_CLIENT_ID,
        code: code,
        grant_type: 'authorization_code',
        redirect_uri: redirect_uri,
        code_verifier: codeVerifier
      });

      const response = await fetch(`${url}?${params}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error_description || 'Token exchange failed');
      }

      const data = await response.json();
      return { accessToken: data.access_token, scopes: data.scope.split(" ") };
    } catch (err: any) {
      throw new Error('Failed to exchange code for token: ' + err.message);
    }
  };


  return { login, getToken, error }
}
