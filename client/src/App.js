import React, { useState, useEffect, createContext, useContext } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import axios from 'axios';
import toast, { Toaster } from 'react-hot-toast';
import { 
  User, 
  Plus, 
  Settings, 
  BarChart3, 
  Target, 
  Code, 
  Users, 
  Mail,
  Play,
  Pause,
  TrendingUp,
  Eye,
  Split,
  Moon,
  Sun,
  CheckCircle,
  AlertCircle,
  Activity,
  Globe,
  LogOut
} from 'lucide-react';

// API configuration
const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';
axios.defaults.baseURL = API_BASE_URL;

// Auth Context
const AuthContext = createContext();

const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [clients, setClients] = useState([]);
  const [currentClient, setCurrentClient] = useState(null);
  const [loading, setLoading] = useState(true);
  const [token, setToken] = useState(localStorage.getItem('token'));

  useEffect(() => {
    if (token) {
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      fetchUserData();
    } else {
      setLoading(false);
    }
  }, [token]);

  const fetchUserData = async () => {
    try {
      const response = await axios.get('/auth/me');
      setUser(response.data.user);
      setClients(response.data.clients);
      if (response.data.clients.length > 0) {
        setCurrentClient(response.data.clients[0]);
      }
    } catch (error) {
      console.error('Failed to fetch user data:', error);
      logout();
    } finally {
      setLoading(false);
    }
  };

  const login = async (email, password) => {
    try {
      const response = await axios.post('/auth/login', { email, password });
      const { token: newToken, user: userData, clients: userClients } = response.data;
      
      setToken(newToken);
      setUser(userData);
      setClients(userClients);
      if (userClients.length > 0) {
        setCurrentClient(userClients[0]);
      }
      
      localStorage.setItem('token', newToken);
      axios.defaults.headers.common['Authorization'] = `Bearer ${newToken}`;
      
      toast.success('Succesvol ingelogd!');
      return true;
    } catch (error) {
      toast.error(error.response?.data?.error || 'Login mislukt');
      return false;
    }
  };

  const register = async (email, password, name) => {
    try {
      const response = await axios.post('/auth/register', { email, password, name });
      const { token: newToken, user: userData, client } = response.data;
      
      setToken(newToken);
      setUser(userData);
      setClients([client]);
      setCurrentClient(client);
      
      localStorage.setItem('token', newToken);
      axios.defaults.headers.common['Authorization'] = `Bearer ${newToken}`;
      
      toast.success('Account succesvol aangemaakt!');
      return true;
    } catch (error) {
      toast.error(error.response?.data?.error || 'Registratie mislukt');
      return false;
    }
  };

  const logout = () => {
    setToken(null);
    setUser(null);
    setClients([]);
    setCurrentClient(null);
    localStorage.removeItem('token');
    delete axios.defaults.headers.common['Authorization'];
    toast.success('Uitgelogd');
  };

  const value = {
    user,
    clients,
    currentClient,
    setCurrentClient,
    login,
    register,
    logout,
    loading,
    isAuthenticated: !!user
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

// Theme Context
const ThemeContext = createContext();

const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};

const ThemeProvider = ({ children }) => {
  const [isDark, setIsDark] = useState(() => {
    const saved = localStorage.getItem('theme');
    return saved ? JSON.parse(saved) : true; // Default to dark mode
  });

  useEffect(() => {
    localStorage.setItem('theme', JSON.stringify(isDark));
    if (isDark) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isDark]);

  const toggleTheme = () => setIsDark(!isDark);

  return (
    <ThemeContext.Provider value={{ isDark, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};

// Login Component
const LoginForm = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    name: ''
  });
  const [loading, setLoading] = useState(false);
  const { login, register } = useAuth();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (isLogin) {
        await login(formData.email, formData.password);
      } else {
        await register(formData.email, formData.password, formData.name);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-violet-900 flex items-center justify-center p-4">
      <div className="bg-gray-800 rounded-2xl shadow-2xl w-full max-w-md p-8 border border-gray-700">
        <div className="text-center mb-8">
          <div className="bg-purple-600 w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <BarChart3 className="text-white" size={32} />
          </div>
          <h1 className="text-3xl font-bold text-white mb-2">A/B Testing Platform</h1>
          <p className="text-gray-400">
            {isLogin ? 'Log in om door te gaan' : 'Maak een nieuw account aan'}
          </p>
        </div>
        
        <form onSubmit={handleSubmit} className="space-y-6">
          {!isLogin && (
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Naam</label>
              <input
                type="text"
                name="name"
                value={formData.name}
                onChange={handleChange}
                className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent text-white"
                placeholder="Je volledige naam"
                required={!isLogin}
              />
            </div>
          )}
          
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Email</label>
            <input
              type="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent text-white"
              placeholder="je@email.com"
              required
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Wachtwoord</label>
            <input
              type="password"
              name="password"
              value={formData.password}
              onChange={handleChange}
              className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent text-white"
              placeholder="••••••••"
              required
            />
          </div>
          
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-purple-600 hover:bg-purple-700 disabled:bg-purple-800 text-white py-3 rounded-lg transition-colors font-medium"
          >
            {loading ? 'Even geduld...' : (isLogin ? 'Inloggen' : 'Account Aanmaken')}
          </button>
        </form>
        
        <div className="mt-6 text-center">
          <button
            onClick={() => setIsLogin(!isLogin)}
            className="text-purple-400 hover:text-purple-300 text-sm transition-colors"
          >
            {isLogin ? 'Nog geen account? Registreer hier' : 'Al een account? Log hier in'}
          </button>
        </div>
      </div>
    </div>
  );
};

// Dashboard Component
const Dashboard = () => {
  const { currentClient } = useAuth();
  const [stats, setStats] = useState({
    activeTests: 0,
    totalVisitors: 0,
    totalConversions: 0,
    conversionRate: 0
  });

  useEffect(() => {
    fetchDashboardData();
  }, [currentClient]);

  const fetchDashboardData = async () => {
    if (!currentClient) return;
    
    try {
      const response = await axios.get(`/analytics/stats/${currentClient.id}`);
      setStats(response.data);
    } catch (error) {
      console.error('Failed to fetch dashboard data:', error);
      toast.error('Kon dashboard data niet laden');
    }
  };

  return (
    <div className="space-y-8">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
          <div className="flex items-center">
            <div className="bg-blue-600 p-3 rounded-lg">
              <Activity className="text-white" size={24} />
            </div>
            <div className="ml-4">
              <p className="text-sm text-gray-400">Actieve Tests</p>
              <p className="text-2xl font-bold text-white">{stats.activeTests}</p>
            </div>
          </div>
        </div>
        
        <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
          <div className="flex items-center">
            <div className="bg-green-600 p-3 rounded-lg">
              <Users className="text-white" size={24} />
            </div>
            <div className="ml-4">
              <p className="text-sm text-gray-400">Bezoekers</p>
              <p className="text-2xl font-bold text-white">{stats.totalVisitors.toLocaleString()}</p>
            </div>
          </div>
        </div>
        
        <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
          <div className="flex items-center">
            <div className="bg-purple-600 p-3 rounded-lg">
              <Target className="text-white" size={24} />
            </div>
            <div className="ml-4">
              <p className="text-sm text-gray-400">Conversies</p>
              <p className="text-2xl font-bold text-white">{stats.totalConversions}</p>
            </div>
          </div>
        </div>
        
        <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
          <div className="flex items-center">
            <div className="bg-orange-600 p-3 rounded-lg">
              <TrendingUp className="text-white" size={24} />
            </div>
            <div className="ml-4">
              <p className="text-sm text-gray-400">Conversie Ratio</p>
              <p className="text-2xl font-bold text-white">{stats.conversionRate}%</p>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-gray-800 rounded-xl border border-gray-700 p-6">
        <h2 className="text-xl font-semibold text-white mb-4">Welkom bij je A/B Testing Platform!</h2>
        <p className="text-gray-300 mb-4">
          Je platform is succesvol gedeployed en klaar voor gebruik. Hier kun je:
        </p>
        <ul className="text-gray-300 space-y-2">
          <li>• A/B tests aanmaken en beheren</li>
          <li>• Real-time statistieken bekijken</li>
          <li>• Team leden uitnodigen</li>
          <li>• Conversie doelen instellen</li>
        </ul>
      </div>
    </div>
  );
};

// Simple Tests Component
const Tests = () => {
  const { currentClient } = useAuth();
  const [tests, setTests] = useState([]);
  const [showCreateTest, setShowCreateTest] = useState(false);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-white">A/B Tests</h1>
        <button
          onClick={() => setShowCreateTest(true)}
          className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg transition-colors flex items-center space-x-2"
        >
          <Plus size={20} />
          <span>Nieuwe Test</span>
        </button>
      </div>

      <div className="bg-gray-800 rounded-xl border border-gray-700 p-6">
        <p className="text-gray-300">Tests functionality coming soon...</p>
      </div>
    </div>
  );
};

// Simple Clients Component  
const Clients = () => {
  const { clients, currentClient, setCurrentClient } = useAuth();

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-white">Clients</h1>
      </div>

      <div className="grid gap-6">
        {clients.map(client => (
          <div key={client.id} className="bg-gray-800 rounded-xl border border-gray-700 p-6">
            <div className="flex justify-between items-start">
              <div>
                <h3 className="text-xl font-semibold text-white">{client.name}</h3>
                <p className="text-gray-400">{client.domain}</p>
              </div>
              
              <button
                onClick={() => setCurrentClient(client)}
                className={`px-4 py-2 rounded-lg transition-colors ${
                  currentClient?.id === client.id 
                    ? 'bg-purple-600 text-white' 
                    : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                }`}
              >
                {currentClient?.id === client.id ? 'Actief' : 'Selecteren'}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

// Simple Settings Component
const SettingsPage = () => {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-white">Instellingen</h1>
      
      <div className="bg-gray-800 rounded-xl border border-gray-700 p-6">
        <h3 className="text-lg font-semibold text-white mb-4">Platform Instellingen</h3>
        <p className="text-gray-300">Settings functionality coming soon...</p>
      </div>
    </div>
  );
};

// Header Component
const Header = () => {
  const { user, currentClient, logout } = useAuth();
  const { isDark, toggleTheme } = useTheme();

  return (
    <header className="bg-gray-800 border-b border-gray-700">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <div className="flex items-center space-x-4">
            <div className="bg-purple-600 w-10 h-10 rounded-xl flex items-center justify-center">
              <BarChart3 className="text-white" size={24} />
            </div>
            <h1 className="text-xl font-bold text-white">A/B Testing Platform</h1>
            
            {currentClient && (
              <div className="bg-gray-700 px-4 py-2 rounded-lg text-sm text-gray-300">
                {currentClient.name}
              </div>
            )}
          </div>
          
          <div className="flex items-center space-x-4">
            <button
              onClick={toggleTheme}
              className="p-2 text-gray-400 hover:text-white transition-colors"
            >
              {isDark ? <Sun size={20} /> : <Moon size={20} />}
            </button>
            
            <div className="flex items-center space-x-2 text-gray-300">
              <User size={16} />
              <span className="text-sm">{user?.name}</span>
            </div>
            
            <button
              onClick={logout}
              className="p-2 text-gray-400 hover:text-red-400 transition-colors"
              title="Uitloggen"
            >
              <LogOut size={20} />
            </button>
          </div>
        </div>
      </div>
    </header>
  );
};

// Sidebar Component
const Sidebar = ({ activeTab, setActiveTab }) => {
  const menuItems = [
    { id: 'dashboard', label: 'Dashboard', icon: BarChart3 },
    { id: 'tests', label: 'A/B Tests', icon: Split },
    { id: 'clients', label: 'Clients', icon: Users },
    { id: 'settings', label: 'Instellingen', icon: Settings }
  ];

  return (
    <nav className="w-64 bg-gray-800 border-r border-gray-700 min-h-screen">
      <div className="p-4">
        <div className="space-y-2">
          {menuItems.map(item => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg transition-colors ${
                activeTab === item.id
                  ? 'bg-purple-600 text-white'
                  : 'text-gray-300 hover:bg-gray-700 hover:text-white'
              }`}
            >
              <item.icon size={20} />
              <span className="font-medium">{item.label}</span>
            </button>
          ))}
        </div>
      </div>
    </nav>
  );
};

// Main App Component
const MainApp = () => {
  const [activeTab, setActiveTab] = useState('dashboard');

  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard':
        return <Dashboard />;
      case 'tests':
        return <Tests />;
      case 'clients':
        return <Clients />;
      case 'settings':
        return <SettingsPage />;
      default:
        return <Dashboard />;
    }
  };

  return (
    <div className="min-h-screen bg-gray-900">
      <Header />
      <div className="flex">
        <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} />
        <main className="flex-1 p-8">
          <div className="max-w-7xl mx-auto">
            {renderContent()}
          </div>
        </main>
      </div>
    </div>
  );
};

// App Component
const App = () => {
  const { loading, isAuthenticated } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-white">Laden...</div>
      </div>
    );
  }

  return isAuthenticated ? <MainApp /> : <LoginForm />;
};

// Root App with Providers
const AppWithProviders = () => (
  <ThemeProvider>
    <AuthProvider>
      <Router>
        <App />
        <Toaster 
          position="top-right"
          toastOptions={{
            duration: 4000,
            style: {
              background: '#374151',
              color: '#fff',
              border: '1px solid #4B5563'
            }
          }}
        />
      </Router>
    </AuthProvider>
  </ThemeProvider>
);

export default AppWithProviders;
