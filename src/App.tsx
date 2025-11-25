import { useEffect, useState } from 'react'
import './App.css'
import { LogOut, Lock, AlertCircle, Gitlab } from 'lucide-react';
import { usePKCEAuth } from './auth';
import Button from '@mui/material/Button';
import { Avatar, Divider, Grid, Typography } from '@mui/material';

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

console.log(import.meta.env.VITE_CLIENT_ID)

function App() {
  const [user, setUser] = useState<GitLabUser | null>(null);
  const [loading, setLoading] = useState(false);

  const { login, getToken, error } = usePKCEAuth()

  const gitlab_uri = 'https://gitlab.com';
  const redirect_uri = window.location.origin;
  const scopes = ['read_user'];


  // Fetch user info
  const fetchUserInfo = async (accessToken: string) => {
    try {
      const response = await fetch(`${gitlab_uri}/api/v4/user`, {
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
        setLoading(false);
        return;
      }

      if (code && state) {

        const pkceSession = JSON.parse(sessionStorage.getItem("pkceSession") || "null");

        if (!pkceSession || pkceSession.state !== state) {
          throw new Error('Invalid state parameter - possible CSRF attack');
        }

        const accessToken = await getToken(`${gitlab_uri}/oauth/token`, redirect_uri, code, pkceSession.codeVerifier);
        const userData = await fetchUserInfo(accessToken);

        // Store token and user in memory only (no localStorage/sessionStorage)
        window.authSession = { accessToken, user: userData };
        setUser(userData);

        // Clean up PKCE session
        sessionStorage.removeItem("pkceSession");

        // Clean up URL
        window.history.replaceState({}, document.title, window.location.pathname);
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
          <Button
            onClick={() => {
              setLoading(false);
            }}
          >
            Tentar novamente
          </Button>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <main style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", height: "100%" }}>
        <div>
          <Gitlab size={64} />
          <Typography variant="h1">PKCE com Gitlab</Typography>
          <Typography>
            Utilizando o fluxo PKCE do Oauth para acessar detalhes da conta Gitlab
          </Typography>
        </div>

        <Divider />

        <div>
          <Button
            onClick={() => login(`${gitlab_uri}/oauth/authorize`, redirect_uri, scopes)}
            className="login-button"
          >
            <Lock />
            Login
          </Button>
        </div>
      </main >
    );
  }

  return (
    <div>
      <div>
        <div>
          <div>
            <div>
              {user.avatar_url && (
                <Avatar
                  sx={{ width: 24, height: 24 }}
                  src={user.avatar_url}
                  alt={user.name}
                />
              )}
              <Button onClick={logout}>
                <LogOut />
                Logout
              </Button>

              <div>
                <Typography variant="h2">{user.name}</Typography>
                <Typography variant="body1">@{user.username}</Typography>
              </div>
            </div>
          </div>
          <div>
            <Typography variant="h4">
              Informação do perfil
            </Typography>
            <Divider />
            <Grid>
              <div>
                <Typography variant="h5">Email</Typography>
                <p>{user.email || 'Não informado'}</p>
              </div>
              <div>
                <Typography variant="h5">ID</Typography>
                <p>{user.id}</p>
              </div>
              <div>
                <Typography variant='h5'>Status</Typography>
                <p>{user.state || 'Não informado'}</p>
              </div>
              <div>
                <Typography variant="h5">URL do perfil</Typography>
                <a
                  href={user.web_url}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Ver perfil
                </a>
              </div>
            </Grid>
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
