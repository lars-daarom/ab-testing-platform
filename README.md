# A/B Testing Platform 🚀

Een complete A/B testing platform gebouwd voor [daar-om.nl](https://daar-om.nl) met alle functionaliteiten die je nodig hebt voor professionele conversion optimalisatie.

## ✨ Features

### 🔐 **User Management**
- Gebruikersregistratie en authenticatie
- Client/workspace management
- Role-based permissions (Admin, Editor, Viewer)
- Email uitnodigingen voor teamleden

### 🧪 **A/B Testing**
- **Multiple test types**: A/B Testing, Split URL Testing, Multivariate Testing
- **Visual Editor**: Eenvoudige test configuratie interface
- **Smart Traffic Distribution**: Configureerbare traffic splits
- **Goal Tracking**: URL-based, Click-based en Custom event conversions
- **Real-time Statistics**: Live visitor en conversie tracking

### 📊 **Analytics & Reporting**
- **Statistical Significance**: Automatische significantie berekeningen
- **Confidence Intervals**: Betrouwbaarheidsintervallen voor alle metrics
- **Detailed Reports**: Uitgebreide test rapporten met demografische data
- **Export Functionality**: Data export naar CSV/JSON
- **Real-time Dashboard**: Live statistieken en test status

### 🎯 **Smart Tracking**
- **Universal Tracking Script**: Eén snippet voor alle tests (zoals VWO)
- **Automatic User Assignment**: Consistente variatie toewijzing
- **Cross-device Tracking**: Gebruiker tracking across devices
- **Performance Optimized**: Minimale impact op website snelheid

### 🔗 **API Integration**
- **RESTful API**: Complete API voor alle functionaliteiten
- **JSON Endpoints**: Status endpoints per client
- **Webhook Support**: Real-time notificaties
- **Rate Limiting**: Bescherming tegen misbruik

## 🏗️ **Tech Stack**

### Backend
- **Node.js** + **Express.js** - REST API server
- **PostgreSQL** - Database voor alle data opslag
- **Sequelize** - ORM voor database operaties
- **JWT** - Veilige authenticatie
- **Nodemailer** - Email service voor uitnodigingen
- **bcryptjs** - Password hashing

### Frontend
- **React 18** - Modern frontend framework
- **Tailwind CSS** - Utility-first CSS framework
- **Lucide React** - Mooie icon set
- **React Router** - Client-side routing
- **Axios** - HTTP client
- **React Hot Toast** - Notificaties

### Analytics & Statistics
- **Custom Statistical Engine** - Z-tests, confidence intervals
- **Real-time Calculations** - Live significantie updates
- **Bayesian Analysis** - Advanced statistical methods
- **Sample Size Calculations** - Test planning tools

## 🚀 **Quick Start**

### Lokale Development

1. **Clone de repository**
```bash
git clone https://github.com/yourusername/ab-testing-platform.git
cd ab-testing-platform
```

2. **Install dependencies**
```bash
# Backend dependencies
npm install

# Frontend dependencies
cd client && npm install && cd ..
```

3. **Database setup**
```bash
# Start PostgreSQL (met Docker)
docker run --name abtesting-postgres -e POSTGRES_PASSWORD=password -e POSTGRES_DB=abtesting_db -p 5432:5432 -d postgres:13

# Of gebruik je eigen PostgreSQL installatie
```

4. **Environment configuratie**
```bash
# Kopieer example env file
cp .env.example .env

# Pas de waarden aan in .env:
DATABASE_URL=postgresql://postgres:password@localhost:5432/abtesting_db
JWT_SECRET=your-super-secret-jwt-key
FRONTEND_URL=http://localhost:3000
```

5. **Start de applicatie**
```bash
# Development mode (start beide frontend en backend)
npm run dev

# Of start ze apart:
npm run server  # Backend op http://localhost:5000
npm run client  # Frontend op http://localhost:3000
```

6. **Open je browser**
   - Frontend: [http://localhost:3000](http://localhost:3000)
   - API: [http://localhost:5000/api](http://localhost:5000/api)

### 🌐 **Deployment op Render.com**

1. **Push je code naar GitHub**
```bash
git add .
git commit -m "Initial commit"
git push origin main
```

2. **Connect met Render.com**
   - Ga naar [render.com](https://render.com)
   - Connect je GitHub repository
   - Gebruik de `render.yaml` configuratie file

3. **Environment Variables instellen**
   - Alle benodigde environment variables staan in `.env.example`
   - Render zal automatisch DATABASE_URL en JWT_SECRET genereren
   - Voeg je SMTP email configuratie toe

4. **Deploy**
   - Render zal automatisch je applicatie deployen
   - Database wordt automatisch aangemaakt en gekoppeld
   - SSL certificaten worden automatisch ingesteld

## 📚 **API Documentation**

### Authentication
```bash
POST /api/auth/register    # Registreer nieuwe gebruiker
POST /api/auth/login       # Login gebruiker
GET  /api/auth/me          # Huidige gebruiker info
POST /api/auth/invite      # Verstuur uitnodiging
POST /api/auth/accept-invitation  # Accepteer uitnodiging
```

### Clients
```bash
GET    /api/clients        # Alle clients voor gebruiker
POST   /api/clients        # Nieuwe client aanmaken
GET    /api/clients/:id    # Client details
PATCH  /api/clients/:id    # Client bijwerken
GET    /api/clients/:id/status  # Client status (public API)
```

### Tests
```bash
GET    /api/tests          # Alle tests voor client
POST   /api/tests          # Nieuwe test aanmaken
GET    /api/tests/:id      # Test details
PATCH  /api/tests/:id      # Test bijwerken
DELETE /api/tests/:id      # Test archiveren
GET    /api/tests/:id/config  # Test configuratie (voor tracking)
```

### Tracking
```bash
POST /api/track/visitor     # Track bezoeker
POST /api/track/conversion  # Track conversie
POST /api/track/event       # Track custom event
GET  /api/track/analytics/:testId  # Test analytics
```

### Analytics
```bash
GET /api/analytics/stats/:clientId     # Client dashboard stats
GET /api/analytics/report/:testId      # Uitgebreid test rapport
GET /api/analytics/funnel/:testId      # Funnel analyse
GET /api/analytics/export/:testId      # Data export
```

## 🎯 **Tracking Implementation**

### Basic Implementation
Voeg deze code toe aan je website:

```html
<!-- A/B Test Tracking -->
<script>
window.abTestConfig = {
  testId: 'your-test-id',
  clientId: 'your-client-id'
};
</script>
<script src="https://your-render-app.onrender.com/track.js"></script>
```

### Advanced Implementation met Custom Goals
```javascript
// Track custom conversie
if (userCompletedPurchase) {
  fetch('/api/track/conversion', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      testId: 'your-test-id',
      userId: 'user-123',
      variation: 'B',
      revenue: 99.99
    })
  });
}
```

## 🎨 **Customization**

### Styling
Het platform gebruikt Tailwind CSS met een dark mode theme. Alle kleuren en styling kunnen aangepast worden in:
- `client/tailwind.config.js` - Tailwind configuratie
- `client/src/App.js` - React componenten

### Email Templates
Email templates kunnen aangepast worden in:
- `server/utils/email.js` - Alle email templates

### Statistical Methods
Custom statistische berekeningen in:
- `server/utils/statistics.js` - Alle statistische functies

## 🔒 **Security Features**

- **JWT Authentication** - Veilige user sessions
- **Password Hashing** - bcrypt met salt rounds
- **Rate Limiting** - API bescherming
- **CORS Protection** - Cross-origin request filtering
- **Input Validation** - Alle inputs worden gevalideerd
- **SQL Injection Protection** - Sequelize ORM bescherming

## 📈 **Performance**

- **Optimized Tracking Script** - < 5KB gzipped
- **Database Indexing** - Geoptimaliseerde queries
- **Caching Ready** - Redis support voorbereid
- **CDN Ready** - Static assets optimalisatie
- **Lazy Loading** - Componenten worden lazy geladen

## 🤝 **Contributing**

1. Fork de repository
2. Create feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open Pull Request

## 📄 **License**

Dit project is gelicenseerd onder de MIT License - zie [LICENSE](LICENSE) file voor details.

## 👥 **Support**

Voor vragen of ondersteuning:
- Email: [support@daar-om.nl](mailto:support@daar-om.nl)
- Website: [daar-om.nl](https://daar-om.nl)

## 🚀 **Roadmap**

### Komende Features
- [ ] **Visual Editor** - Drag & drop test editor
- [ ] **Heatmaps Integration** - Visual analytics
- [ ] **Advanced Segmentation** - Audience targeting
- [ ] **Multi-armed Bandit** - AI-powered test optimization
- [ ] **Mobile App** - Native iOS/Android apps
- [ ] **Slack/Teams Integration** - Team notifications
- [ ] **Advanced Reports** - PDF exports en scheduling

---

**Gebouwd met ❤️ voor [daar-om.nl](https://daar-om.nl)**
