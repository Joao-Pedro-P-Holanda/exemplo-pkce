import { useEffect, useState } from 'react'
import './App.css'
import { LogOut, GitBranch, User, Lock, AlertCircle } from 'lucide-react';

interface GitLabUser {
  id: number;
  username: string;
  name: string;
  email?: string;
  avatar_url?: string;
  web_url: string;
  state?: string;
  bio?: string;
}

interface AuthSession {
  accessToken: string;
  user: GitLabUser;
}

declare global {
  interface Window {
    authSession?: AuthSession;
  }
}

function App() {
  const [user, setUser] = useState<GitLabUser | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // GitLab configuration
  const GITLAB_URL = 'https://gitlab.com'; // Change to your GitLab instance
  const REDIRECT_URI = window.location.origin;
  const SCOPES = 'read_user';



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


  const login = async () => {
    try {
      const codeVerifier = randomHash(128);
      const codeChallenge = await generateCodeChallenge(codeVerifier);
      const state = randomHash(64);

      // Store verifier and state in sessionStorage
      sessionStorage.setItem("pkceSession", JSON.stringify({ codeVerifier, state }));


      const params = new URLSearchParams({
        client_id: import.meta.env.VITE_CLIENT_ID,
        redirect_uri: REDIRECT_URI,
        response_type: 'code',
        scope: SCOPES,
        code_challenge: codeChallenge,
        code_challenge_method: 'S256',
        state: state
      });

      window.location['replace'](`${GITLAB_URL}/oauth/authorize?${params}`);
    } catch (err: any) {
      setError('Failed to initiate login: ' + err.message);
    }
  };

  // Exchange code for token using PKCE
  const exchangeCodeForToken = async (code: string, codeVerifier: string) => {
    try {
      const params = new URLSearchParams({
        client_id: import.meta.env.VITE_CLIENT_ID,
        code: code,
        grant_type: 'authorization_code',
        redirect_uri: REDIRECT_URI,
        code_verifier: codeVerifier
      });

      const response = await fetch(`${GITLAB_URL}/oauth/token?${params}`, {
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
      return data.access_token;
    } catch (err: any) {
      throw new Error('Failed to exchange code for token: ' + err.message);
    }
  };

  // Fetch user info
  const fetchUserInfo = async (accessToken: string) => {
    try {
      const response = await fetch(`${GITLAB_URL}/api/v4/user`, {
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to fetch user info');
      }

      return await response.json();
    } catch (err: any) {
      throw new Error('Failed to fetch user info: ' + err.message);
    }
  };

  useEffect(() => {
    const handleCallback = async () => {
      const params = new URLSearchParams(window.location.search);
      const code = params.get('code');
      const state = params.get('state');
      const errorParam = params.get('error');

      if (errorParam) {
        setError('OAuth error: ' + (params.get('error_description') || errorParam));
        setLoading(false);
        return;
      }

      if (code && state) {

        try {
          const pkceSession = JSON.parse(sessionStorage.getItem("pkceSession") || "null");

          if (!pkceSession || pkceSession.state !== state) {
            throw new Error('Invalid state parameter - possible CSRF attack');
          }

          const accessToken = await exchangeCodeForToken(code, pkceSession.codeVerifier);
          const userData = await fetchUserInfo(accessToken);

          // Store token and user in memory only (no localStorage/sessionStorage)
          window.authSession = { accessToken, user: userData };
          setUser(userData);

          // Clean up PKCE session
          sessionStorage.removeItem("pkceSession");

          // Clean up URL
          window.history.replaceState({}, document.title, window.location.pathname);
        } catch (err: any) {
          setError(err.message);
        }
      } else if (window.authSession) {
        // Restore session from memory
        setUser(window.authSession.user);
      }

      setLoading(false);
    };

    handleCallback();
  }, []);

  const logout = () => {
    delete window.authSession;
    sessionStorage.removeItem("pkceSession");
    setUser(null);
    setError(null);
  };

  if (loading) {
    return (
      <div>
        <div>
          <p>Carregando...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div>
        <div className="content">
          <div>
            <AlertCircle />
            <h2>Erro de autenticação</h2>
          </div>
          <p>{error}</p>
          <button
            onClick={() => {
              setError(null);
              setLoading(false);
            }}
          >
            Tentar novamente
          </button>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div >
        <div className="content">
          <GitBranch />
          <h1>PKCE com Gitlab</h1>
          <p>
            Utilizando o fluxo PKCE do Oauth para acessar detalhes da conta Gitlab
          </p>
          <button
            onClick={login}
            className="login-button"
          >
            <Lock />
            Login
          </button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div>
        <div>
          <div>
            <div>
              <div>
                {user.avatar_url && (
                  <img
                    src={user.avatar_url}
                    alt={user.name}
                  />
                )}
                <div>
                  <h2>{user.name}</h2>
                  <p>@{user.username}</p>
                </div>
              </div>
              <button onClick={logout}>
                <LogOut />
                Logout
              </button>
            </div>
          </div>
          <div>
            <h3>
              <User />
              Informação do perfil
            </h3>
            <div>
              <div>
                <p>Email</p>
                <p>{user.email || 'Não informado'}</p>
              </div>
              <div>
                <p>ID</p>
                <p>{user.id}</p>
              </div>
              <div>
                <p>Estado</p>
                <p>{user.state || 'Não informado'}</p>
              </div>
              <div>
                <p>URL do perfil</p>
                <a
                  href={user.web_url}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Ver perfil
                </a>
              </div>
            </div>
            {user.bio && (
              <div>
                <p>Bio</p>
                <p>{user.bio}</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div >
  );

}

export default App
