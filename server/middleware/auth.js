const supabase = require('../services/supabaseService');

const authenticateToken = async (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Toegangstoken vereist' });
  }

  try {
    const { data, error } = await supabase.auth.getUser(token);
    if (error || !data?.user) {
      return res.status(403).json({ error: 'Ongeldig of verlopen token' });
    }

    req.user = data.user; // Contains id and metadata
    next();
  } catch (err) {
    console.error('Authentication error:', err);
    res.status(500).json({ error: 'Authenticatie mislukt' });
  }
};

module.exports = authenticateToken;
