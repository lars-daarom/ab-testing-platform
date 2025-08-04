import React, { useState, useEffect, createContext, useContext } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
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
  Calendar,
  CheckCircle,
  AlertCircle,
  Activity,
  Globe,
  Shield,
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
  const [recentTests, setRecentTests] = useState([]);

  useEffect(() => {
    fetchDashboardData();
  }, [currentClient]);

  const fetchDashboardData = async () => {
    if (!currentClient) return;
    
    try {
      const [statsResponse, testsResponse] = await Promise.all([
        axios.get(`/analytics/stats/${currentClient.id}`),
        axios.get(`/tests?clientId=${currentClient.id}&limit=5`)
      ]);
      
      setStats(statsResponse.data);
      setRecentTests(testsResponse.data.tests);
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

      {/* Recent Tests */}
      <div className="bg-gray-800 rounded-xl border border-gray-700">
        <div className="p-6 border-b border-gray-700">
          <h2 className="text-xl font-semibold text-white">Recente Tests</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-700">
              <tr>
                <th className="px-6 py-4 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Test</th>
                <th className="px-6 py-4 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Type</th>
                <th className="px-6 py-4 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Status</th>
                <th className="px-6 py-4 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Bezoekers</th>
                <th className="px-6 py-4 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Significantie</th>
                <th className="px-6 py-4 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Acties</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-700">
              {recentTests.map(test => (
                <tr key={test.id} className="hover:bg-gray-700">
                  <td className="px-6 py-4">
                    <div className="font-medium text-white">{test.name}</div>
                    <div className="text-sm text-gray-400">Aangemaakt: {new Date(test.createdAt).toLocaleDateString('nl-NL')}</div>
                  </td>
                  <td className="px-6 py-4">
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-900 text-blue-200">
                      {test.type === 'ab' ? 'A/B Test' : 'Split URL'}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      test.status === 'running' ? 'bg-green-900 text-green-200' :
                      test.status === 'paused' ? 'bg-yellow-900 text-yellow-200' :
                      'bg-gray-700 text-gray-300'
                    }`}>
                      {test.status === 'running' ? 'Actief' : 
                       test.status === 'paused' ? 'Gepauzeerd' : 'Concept'}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-300">
                    {(test.totalVisitors || 0).toLocaleString()}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center">
                      <div className="text-sm text-gray-300">{((test.significance || 0) * 100).toFixed(0)}%</div>
                      {test.significance >= 0.95 && (
                        <CheckCircle className="ml-2 text-green-400" size={16} />
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex space-x-2">
                      <button className="text-purple-400 hover:text-purple-300">
                        <Eye size={16} />
                      </button>
                      <button className="text-blue-400 hover:text-blue-300">
                        <Code size={16} />
                      </button>
                      <button className="text-green-400 hover:text-green-300">
                        <Play size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

// Header Component
const Header = () => {
  const { user, currentClient, clients, setCurrentClient, logout } = useAuth();
  const { isDark, toggleTheme } = useTheme();
  const [showClientDropdown, setShowClientDropdown] = useState(false);

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
              <div className="relative">
                <button
                  onClick={() => setShowClientDropdown(!showClientDropdown)}
                  className="bg-gray-700 hover:bg-gray-600 px-4 py-2 rounded-lg text-sm text-gray-300 border border-gray-600 transition-colors"
                >
                  {currentClient.name}
                </button>
                
                {showClientDropdown && (
                  <div className="absolute top-full left-0 mt-2 w-64 bg-gray-800 rounded-lg shadow-lg border border-gray-700 z-50">
                    <div className="p-2">
                      {clients.map(client => (
                        <button
                          key={client.id}
                          onClick={() => {
                            setCurrentClient(client);
                            setShowClientDropdown(false);
                          }}
                          className={`w-full text-left px-3 py-2 rounded-lg transition-colors ${
                            currentClient.id === client.id 
                              ? 'bg-purple-600 text-white' 
                              : 'text-gray-300 hover:bg-gray-700'
                          }`}
                        >
                          <div className="font-medium">{client.name}</div>
                          <div className="text-xs text-gray-400">{client.domain}</div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
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

// Tests Component
const Tests = () => {
  const { currentClient } = useAuth();
  const [tests, setTests] = useState([]);
  const [showCreateTest, setShowCreateTest] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchTests();
  }, [currentClient]);

  const fetchTests = async () => {
    if (!currentClient) return;
    
    try {
      const response = await axios.get(`/tests?clientId=${currentClient.id}`);
      setTests(response.data.tests);
    } catch (error) {
      console.error('Failed to fetch tests:', error);
      toast.error('Kon tests niet laden');
    } finally {
      setLoading(false);
    }
  };

  const updateTestStatus = async (testId, status) => {
    try {
      await axios.patch(`/tests/${testId}`, { status });
      setTests(tests.map(test => 
        test.id === testId ? { ...test, status } : test
      ));
      toast.success(`Test ${status === 'running' ? 'gestart' : 'gepauzeerd'}`);
    } catch (error) {
      toast.error('Kon test status niet wijzigen');
    }
  };

  const generateSnippet = (test) => {
    const snippet = `<!-- A/B Test Snippet -->
<script>
window.abTestConfig = {
  testId: '${test.id}',
  clientId: '${currentClient.id}'
};
</script>
<script src="${window.location.origin}/track.js"></script>`;
    
    navigator.clipboard.writeText(snippet);
    toast.success('Tracking code gekopieerd!');
  };

  if (loading) {
    return <div className="text-white">Tests laden...</div>;
  }

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

      {showCreateTest && (
        <CreateTestForm 
          onClose={() => setShowCreateTest(false)} 
          onSuccess={fetchTests}
        />
      )}

      <div className="grid gap-6">
        {tests.map(test => (
          <TestCard 
            key={test.id} 
            test={test} 
            onStatusChange={updateTestStatus}
            onGenerateSnippet={generateSnippet}
          />
        ))}
      </div>
    </div>
  );
};

// Create Test Form Component
const CreateTestForm = ({ onClose, onSuccess }) => {
  const { currentClient } = useAuth();
  const [formData, setFormData] = useState({
    name: '',
    type: 'ab',
    hypothesis: '',
    trafficSplit: { A: 50, B: 50 },
    goal: { type: 'url', value: '' },
    targetUrl: '',
    variations: [
      { id: 'A', name: 'Original', css: '', js: '' },
      { id: 'B', name: 'Variation', css: '', js: '' }
    ]
  });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name || !formData.goal.value) {
      toast.error('Vul alle verplichte velden in');
      return;
    }

    setLoading(true);
    try {
      await axios.post('/tests', {
        ...formData,
        clientId: currentClient.id
      });
      toast.success('Test succesvol aangemaakt!');
      onSuccess();
      onClose();
    } catch (error) {
      toast.error('Kon test niet aanmaken');
    } finally {
      setLoading(false);
    }
  };

  const updateTrafficSplit = (variant, value) => {
    const intValue = parseInt(value) || 0;
    const otherVariant = variant === 'A' ? 'B' : 'A';
    setFormData({
      ...formData,
      trafficSplit: {
        [variant]: intValue,
        [otherVariant]: 100 - intValue
      }
    });
  };

  return (
    <div className="bg-gray-800 rounded-xl border border-gray-700 p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold text-white">Nieuwe Test Aanmaken</h2>
        <button
          onClick={onClose}
          className="text-gray-400 hover:text-white transition-colors"
        >
          ✕
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Test Naam *</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({...formData, name: e.target.value})}
              className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 text-white"
              placeholder="Bijv. Homepage Hero Test"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Test Type</label>
            <select
              value={formData.type}
              onChange={(e) => setFormData({...formData, type: e.target.value})}
              className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 text-white"
            >
              <option value="ab">A/B Test</option>
              <option value="split_url">Split URL Test</option>
              <option value="multivariate">Multivariate Test</option>
            </select>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">Hypothese</label>
          <textarea
            value={formData.hypothesis}
            onChange={(e) => setFormData({...formData, hypothesis: e.target.value})}
            className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 text-white"
            rows="3"
            placeholder="Beschrijf wat je verwacht dat er gaat gebeuren..."
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">Traffic Verdeling</label>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-gray-400 mb-1">Variant A (%)</label>
              <input
                type="number"
                value={formData.trafficSplit.A}
                onChange={(e) => updateTrafficSplit('A', e.target.value)}
                className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 text-white"
                min="0"
                max="100"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">Variant B (%)</label>
              <input
                type="number"
                value={formData.trafficSplit.B}
                onChange={(e) => updateTrafficSplit('B', e.target.value)}
                className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 text-white"
                min="0"
                max="100"
              />
            </div>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">Conversie Doel *</label>
          <div className="grid grid-cols-1 gap-4">
            <select
              value={formData.goal.type}
              onChange={(e) => setFormData({
                ...formData, 
                goal: { ...formData.goal, type: e.target.value }
              })}
              className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 text-white"
            >
              <option value="url">URL Bereikt</option>
              <option value="click">Element Geklikt</option>
              <option value="custom">Custom Event</option>
            </select>
            <input
              type="text"
              value={formData.goal.value}
              onChange={(e) => setFormData({
                ...formData, 
                goal: { ...formData.goal, value: e.target.value }
              })}
              className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 text-white"
              placeholder={formData.goal.type === 'url' ? '/checkout' : '#button-id'}
              required
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">Target URL</label>
          <input
            type="url"
            value={formData.targetUrl}
            onChange={(e) => setFormData({...formData, targetUrl: e.target.value})}
            className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 text-white"
            placeholder="https://example.com/page"
          />
        </div>

        <div className="flex space-x-4 pt-4">
          <button
            type="submit"
            disabled={loading}
            className="bg-purple-600 hover:bg-purple-700 disabled:bg-purple-800 text-white px-6 py-3 rounded-lg transition-colors"
          >
            {loading ? 'Aanmaken...' : 'Test Aanmaken'}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="bg-gray-600 hover:bg-gray-700 text-white px-6 py-3 rounded-lg transition-colors"
          >
            Annuleren
          </button>
        </div>
      </form>
    </div>
  );
};

// Test Card Component
const TestCard = ({ test, onStatusChange, onGenerateSnippet }) => {
  const totalVisitors = test.totalVisitors || 0;
  const totalConversions = test.totalConversions || 0;
  const conversionRate = totalVisitors > 0 ? ((totalConversions / totalVisitors) * 100).toFixed(2) : 0;
  const significance = (test.significance || 0) * 100;

  return (
    <div className="bg-gray-800 rounded-xl border border-gray-700 p-6">
      <div className="flex justify-between items-start mb-4">
        <div>
          <h3 className="text-xl font-semibold text-white">{test.name}</h3>
          <p className="text-gray-400 text-sm">
            {test.type === 'ab' ? 'A/B Test' : 'Split URL Test'} • 
            Aangemaakt: {new Date(test.createdAt).toLocaleDateString('nl-NL')}
          </p>
          {test.hypothesis && (
            <p className="text-gray-300 text-sm mt-2 italic">"{test.hypothesis}"</p>
          )}
        </div>
        
        <div className="flex items-center space-x-3">
          <span className={`px-3 py-1 rounded-full text-sm font-medium ${
            test.status === 'running' ? 'bg-green-900 text-green-200' :
            test.status === 'paused' ? 'bg-yellow-900 text-yellow-200' :
            'bg-gray-700 text-gray-300'
          }`}>
            {test.status === 'running' ? 'Actief' : 
             test.status === 'paused' ? 'Gepauzeerd' : 'Concept'}
          </span>
          
          <button
            onClick={() => onGenerateSnippet(test)}
            className="bg-purple-700 hover:bg-purple-600 text-white px-3 py-1 rounded-lg transition-colors flex items-center space-x-1"
          >
            <Code size={16} />
            <span>Code</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-gray-700 rounded-lg p-4">
          <div className="text-sm text-gray-400 mb-1">Bezoekers</div>
          <div className="text-xl font-bold text-white">{totalVisitors.toLocaleString()}</div>
        </div>
        <div className="bg-gray-700 rounded-lg p-4">
          <div className="text-sm text-gray-400 mb-1">Conversies</div>
          <div className="text-xl font-bold text-white">{totalConversions}</div>
        </div>
        <div className="bg-gray-700 rounded-lg p-4">
          <div className="text-sm text-gray-400 mb-1">Conversie Ratio</div>
          <div className="text-xl font-bold text-white">{conversionRate}%</div>
        </div>
      </div>

      <div className="flex items-center justify-between pt-4 border-t border-gray-700">
        <div className="flex items-center space-x-4">
          <div className="flex items-center text-sm text-gray-300">
            <Target className="mr-2" size={16} />
            Doel: {test.goal?.value || 'Niet ingesteld'}
          </div>
          <div className="flex items-center text-sm text-gray-300">
            <TrendingUp className="mr-2" size={16} />
            Significantie: {significance.toFixed(0)}%
            {significance >= 95 && (
              <CheckCircle className="ml-2 text-green-400" size={16} />
            )}
          </div>
        </div>
        
        <div className="flex space-x-2">
          {test.status === 'running' ? (
            <button
              onClick={() => onStatusChange(test.id, 'paused')}
              className="bg-yellow-700 hover:bg-yellow-600 text-white px-3 py-1 rounded-lg transition-colors flex items-center space-x-1"
            >
              <Pause size={16} />
              <span>Pauzeren</span>
            </button>
          ) : (
            <button
              onClick={() => onStatusChange(test.id, 'running')}
              className="bg-green-700 hover:bg-green-600 text-white px-3 py-1 rounded-lg transition-colors flex items-center space-x-1"
            >
              <Play size={16} />
              <span>Starten</span>
            </button>
          )}
          
          <button className="bg-blue-700 hover:bg-blue-600 text-white px-3 py-1 rounded-lg transition-colors flex items-center space-x-1">
            <Eye size={16} />
            <span>Bekijken</span>
          </button>
        </div>
      </div>
    </div>
  );
};

// Clients Component
const Clients = () => {
  const { clients, currentClient, setCurrentClient } = useAuth();
  const [showCreateClient, setShowCreateClient] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('viewer');

  const sendInvite = async (clientId) => {
    if (!inviteEmail) {
      toast.error('Vul een email adres in');
      return;
    }

    try {
      await axios.post('/auth/invite', {
        email: inviteEmail,
        clientId,
        role: inviteRole
      });
      toast.success(`Uitnodiging verstuurd naar ${inviteEmail}`);
      setInviteEmail('');
    } catch (error) {
      toast.error(error.response?.data?.error || 'Kon uitnodiging niet versturen');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-white">Clients</h1>
        <button
          onClick={() => setShowCreateClient(true)}
          className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg transition-colors flex items-center space-x-2"
        >
          <Plus size={20} />
          <span>Nieuwe Client</span>
        </button>
      </div>

      <div className="grid gap-6">
        {clients.map(client => (
          <div key={client.id} className="bg-gray-800 rounded-xl border border-gray-700 p-6">
            <div className="flex justify-between items-start mb-4">
              <div>
                <h3 className="text-xl font-semibold text-white">{client.name}</h3>
                <p className="text-gray-400">{client.domain}</p>
                <p className="text-xs text-gray-500">
                  Aangemaakt: {new Date(client.createdAt).toLocaleDateString('nl-NL')}
                </p>
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

            <div className="border-t border-gray-700 pt-4">
              <h4 className="font-medium text-white mb-4">Gebruikers Uitnodigen</h4>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                <input
                  type="email"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  className="px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 text-white"
                  placeholder="email@example.com"
                />
                <select
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value)}
                  className="px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 text-white"
                >
                  <option value="viewer">Viewer</option>
                  <option value="editor">Editor</option>
                  <option value="admin">Admin</option>
                </select>
                <button
                  onClick={() => sendInvite(client.id)}
                  className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg transition-colors flex items-center justify-center space-x-1"
                >
                  <Mail size={16} />
                  <span>Uitnodigen</span>
                </button>
                <div className="text-sm text-gray-400 flex items-center">
                  <Globe size={16} className="mr-1" />
                  API: /api/clients/{client.id}/status
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

// Settings Component
const Settings = () => {
  const { currentClient } = useAuth();
  const [settings, setSettings] = useState({
    significanceThreshold: 0.95,
    minimumSampleSize: 1000,
    autoStart: false,
    webhookUrl: ''
  });

  const saveSettings = async () => {
    try {
      await axios.patch(`/clients/${currentClient.id}/settings`, settings);
      toast.success('Instellingen opgeslagen');
    } catch (error) {
      toast.error('Kon instellingen niet opslaan');
    }
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-white">Instellingen</h1>
      
      <div className="bg-gray-800 rounded-xl border border-gray-700 p-6">
        <h3 className="text-lg font-semibold text-white mb-4">Statistiek Instellingen</h3>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-gray-300">Significantie Drempel</span>
            <select
              value={settings.significanceThreshold}
              onChange={(e) => setSettings({...settings, significanceThreshold: parseFloat(e.target.value)})}
              className="px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 text-white"
            >
              <option value="0.90">90%</option>
              <option value="0.95">95%</option>
              <option value="0.99">99%</option>
            </select>
          </div>
          
          <div className="flex items-center justify-between">
            <span className="text-gray-300">Minimum Sample Size</span>
            <input
              type="number"
              value={settings.minimumSampleSize}
              onChange={(e) => setSettings({...settings, minimumSampleSize: parseInt(e.target.value)})}
              className="w-32 px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 text-white"
            />
          </div>
        </div>
      </div>

      <div className="bg-gray-800 rounded-xl border border-gray-700 p-6">
        <h3 className="text-lg font-semibold text-white mb-4">API Configuratie</h3>
        <div className="space-y-4">
          <div>
            <label className="block text-gray-300 mb-2">Webhook URL</label>
            <input
              type="url"
              value={settings.webhookUrl}
              onChange={(e) => setSettings({...settings, webhookUrl: e.target.value})}
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 text-white"
              placeholder="https://your-app.com/webhook"
            />
          </div>
        </div>
      </div>

      <button
        onClick={saveSettings}
        className="bg-purple-600 hover:bg-purple-700 text-white px-6 py-3 rounded-lg transition-colors"
      >
        Instellingen Opslaan
      </button>
    </div>
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
        return <Settings />;
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
