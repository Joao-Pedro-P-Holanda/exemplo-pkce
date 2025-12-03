import { useEffect, useState } from 'react'
import { LogOut, Lock, AlertCircle, Gitlab, FolderGit2, Plus, ExternalLink, X } from 'lucide-react';
import { usePKCEAuth } from './auth';
import './App.css';

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

interface GitLabRepository {
  id: number;
  name: string;
  path: string;
  description?: string;
  web_url: string;
  visibility: string;
  created_at: string;
  last_activity_at: string;
}

interface AuthSession {
  accessToken: string;
  scopes: string[];
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
  const [repositories, setRepositories] = useState<GitLabRepository[]>([]);
  const [loadingRepos, setLoadingRepos] = useState(false);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [newRepoName, setNewRepoName] = useState('');
  const [newRepoDescription, setNewRepoDescription] = useState('');
  const [creating, setCreating] = useState(false);

  const { login, getToken, error } = usePKCEAuth();

  const gitlab_uri = 'https://gitlab.com';
  const redirect_uri = window.location.href;
  const profile_scopes = ['read_user'];
  const repo_scopes = ['read_user', 'write_repository', 'api'];


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

  const fetchRepositories = async () => {
    console.log(window.authSession?.scopes)
    if (!window.authSession || (window.authSession && !window.authSession.scopes.includes("write_repository"))) return;

    setLoadingRepos(true);
    try {
      const response = await fetch(`${gitlab_uri}/api/v4/projects?owned=true&simple=true`, {
        headers: {
          'Authorization': `Bearer ${window.authSession.accessToken}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to fetch repositories');
      }

      const data = await response.json();
      setRepositories(data);
    } catch (err: any) {
      console.error('Error fetching repositories:', err);
    } finally {
      setLoadingRepos(false);
    }
  };

  const createRepository = async () => {
    if (!window.authSession?.accessToken || !newRepoName.trim()) return;

    setCreating(true);
    try {
      const response = await fetch(`${gitlab_uri}/api/v4/projects`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${window.authSession.accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: newRepoName,
          description: newRepoDescription,
          visibility: 'private'
        })
      });

      if (!response.ok) {
        throw new Error('Failed to create repository');
      }

      const newRepo = await response.json();
      setRepositories([newRepo, ...repositories]);
      setCreateDialogOpen(false);
      setNewRepoName('');
      setNewRepoDescription('');
    } catch (err: any) {
      console.error('Error creating repository:', err);
      alert('Failed to create repository: ' + err.message);
    } finally {
      setCreating(false);
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

      if (window.authSession) {
        setUser(window.authSession.user);
        await fetchRepositories();
      } else if (code && state) {

        const pkceSession = JSON.parse(sessionStorage.getItem("pkceSession") || "null");

        if (!pkceSession || pkceSession.state !== state) {
          throw new Error('Invalid state parameter - possible CSRF attack');
        }

        const { accessToken, scopes } = await getToken(`${gitlab_uri}/oauth/token`, redirect_uri, code, pkceSession.codeVerifier);

        const userData = await fetchUserInfo(accessToken);

        window.authSession = {
          accessToken,
          user: userData,
          scopes: scopes
        };
        setUser(userData);
        await fetchRepositories();

        sessionStorage.removeItem("pkceSession");
        window.history.replaceState({}, document.title, window.location.pathname);
      }

      setLoading(false);
    };

    handleCallback();
  }, [])
  const logout = () => {
    delete window.authSession;
    sessionStorage.removeItem("pkceSession");
    setUser(null);
    setRepositories([]);
  };

  if (loading) {
    return (
      <div className="loading-container">
        <p>Carregando...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="error-container">
        <AlertCircle size={48} className="error-icon" />
        <h2>Erro de autenticação</h2>
        <p>{error}</p>
        <button
          onClick={() => window.location.reload()}
          className="btn btn-primary"
          style={{ marginTop: '1rem' }}
        >
          Tentar novamente
        </button>
      </div>
    );
  }

  if (!user) {
    return (
      <main className="app-container app-container-xnarrow landing">
        <div className="landing-header">
          <Gitlab size={64} className="landing-icon" />
          <h1 className="landing-title">PKCE com Gitlab</h1>
          <p className="landing-description">
            Utilizando o fluxo PKCE do Oauth para acessar detalhes da conta Gitlab
          </p>
          <hr className="landing-divider" />
        </div>

        <div className="landing-buttons">
          <button
            onClick={() => login(`${gitlab_uri}/oauth/authorize`, redirect_uri, profile_scopes)}
            className="btn btn-primary"
          >
            <Lock size={20} />
            Login (Perfil)
          </button>

          <button
            onClick={() => login(`${gitlab_uri}/oauth/authorize`, redirect_uri, repo_scopes)}
            className="btn btn-gitlab"
          >
            <FolderGit2 size={20} />
            Login (Repositórios)
          </button>
        </div>
      </main>
    );
  }

  if (window.authSession && window.authSession.scopes.includes("write_repository")) {
    return (
      <div className="app-container">
        <div className="header">
          <div className="header-user">
            {user.avatar_url && (
              <img src={user.avatar_url} alt={user.name} className="header-avatar header-avatar-sm" />
            )}
            <div className="header-info">
              <h1 className="header-title-sm">Meus Repositórios</h1>
              <p>@{user.username}</p>
            </div>
          </div>
          <button onClick={logout} className="btn btn-secondary">
            <LogOut size={16} />
            Logout
          </button>
        </div>

        <div className="repo-header">
          <h2>
            {repositories.length} {repositories.length === 1 ? 'Repositório' : 'Repositórios'}
          </h2>
          <button
            onClick={() => setCreateDialogOpen(true)}
            className="btn btn-primary"
          >
            <Plus size={20} />
            Novo Repositório
          </button>
        </div>

        {loadingRepos ? (
          <div className="repo-loading">
            <p>Carregando repositórios...</p>
          </div>
        ) : repositories.length === 0 ? (
          <div className="repo-empty">
            <FolderGit2 size={48} className="repo-empty-icon" />
            <h3>
              Nenhum repositório encontrado
            </h3>
            <p>
              Crie seu primeiro repositório para começar
            </p>
          </div>
        ) : (
          <div className="repo-grid">
            {repositories.map((repo) => (
              <div key={repo.id} className="repo-card">
                <h3>{repo.name}</h3>
                <p className="repo-description">
                  {repo.description || 'Sem descrição'}
                </p>
                <p className="repo-date">
                  Criado em: {new Date(repo.created_at).toLocaleDateString('pt-BR')}
                </p>
                <a
                  href={repo.web_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="repo-link"
                >
                  <ExternalLink size={16} />
                  Ver no GitLab
                </a>
              </div>
            ))}
          </div>
        )}

        {createDialogOpen && (
          <div className="dialog-overlay">
            <div className="dialog">
              <div className="dialog-header">
                <h2>Criar Novo Repositório</h2>
                <button
                  onClick={() => setCreateDialogOpen(false)}
                  className="dialog-close"
                >
                  <X size={24} />
                </button>
              </div>
              <div className="dialog-content">
                <div className="form-group">
                  <label className="form-label">
                    Nome do Repositório
                  </label>
                  <input
                    type="text"
                    value={newRepoName}
                    onChange={(e) => setNewRepoName(e.target.value)}
                    placeholder="meu-projeto"
                    className="form-input"
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">
                    Descrição (opcional)
                  </label>
                  <textarea
                    value={newRepoDescription}
                    onChange={(e) => setNewRepoDescription(e.target.value)}
                    placeholder="Uma breve descrição do projeto"
                    rows={3}
                    className="form-textarea"
                  />
                </div>
              </div>
              <div className="dialog-actions">
                <button
                  onClick={() => setCreateDialogOpen(false)}
                  className="btn btn-secondary"
                >
                  Cancelar
                </button>
                <button
                  onClick={createRepository}
                  disabled={!newRepoName.trim() || creating}
                  className="btn btn-primary"
                >
                  {creating ? 'Criando...' : 'Criar'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="app-container app-container-narrow">
      <div className="header">
        <div className="header-user">
          {user.avatar_url && (
            <img src={user.avatar_url} alt={user.name} className="header-avatar" />
          )}
          <div className="header-info">
            <h1>{user.name}</h1>
            <p>@{user.username}</p>
          </div>
        </div>
        <button onClick={logout} className="btn btn-secondary">
          <LogOut size={16} />
          Logout
        </button>
      </div>

      <div className="profile-card">
        <h2>Informação do perfil</h2>
        <hr className="profile-divider" />
        <div className="profile-grid">
          <div>
            <p className="profile-field-label">Email</p>
            <p className="profile-field-value">{user.email || 'Não informado'}</p>
          </div>
          <div>
            <p className="profile-field-label">ID</p>
            <p className="profile-field-value">{user.id}</p>
          </div>
          <div>
            <p className="profile-field-label">Status</p>
            <p className="profile-field-value">{user.state || 'Não informado'}</p>
          </div>
          <div>
            <p className="profile-field-label">URL do perfil</p>
            <a
              href={user.web_url}
              target="_blank"
              rel="noopener noreferrer"
              className="profile-link"
            >
              Ver perfil →
            </a>
          </div>
        </div>
        {user.bio && (
          <div className="profile-bio">
            <p className="profile-field-label">Bio</p>
            <p className="profile-field-value">{user.bio}</p>
          </div>
        )}
      </div>
    </div>
  );
}

export default App;
