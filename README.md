# SMSI ISO 27001 Guide - Backend API

This is the Node.js/Express.js backend for the SMSI ISO 27001 Guide application.

## 🏗️ Architecture

- **Framework**: Express.js
- **Database**: MongoDB with Mongoose ODM
- **Authentication**: JWT with refresh tokens
- **Security**: bcrypt, helmet, rate limiting, CORS
- **Validation**: express-validator
- **Email**: Nodemailer (for password reset)

## 📁 Project Structure

```
backend/
├── models/           # MongoDB schemas and models
│   ├── User.js      # User model with authentication
│   ├── Questionnaire.js  # Questionnaire responses and results
│   └── Roadmap.js   # Personalized roadmap data
├── routes/           # API route handlers
│   ├── auth.js      # Authentication routes
│   ├── users.js     # User management routes
│   ├── questionnaires.js  # Questionnaire CRUD operations
│   └── roadmaps.js  # Roadmap management routes
├── middleware/       # Custom middleware
│   └── auth.js      # JWT authentication and authorization
├── server.js         # Main server file
├── package.json      # Dependencies and scripts
├── env.example       # Environment variables template
└── README.md         # This file
```

## 🚀 Quick Start

### 1. Install Dependencies

```bash
npm install
```

### 2. Environment Configuration

```bash
# Copy environment template
cp env.example .env

# Edit .env file with your configuration
nano .env
```

### 3. Start MongoDB

Ensure MongoDB is running on your system:

```bash
# Check MongoDB status
sudo systemctl status mongod

# Start if not running
sudo systemctl start mongod
```

### 4. Start Server

```bash
# Development mode (with auto-reload)
npm run dev

# Production mode
npm start
```

## 🔧 Configuration

### Environment Variables

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `PORT` | Server port | 3001 | No |
| `NODE_ENV` | Environment mode | development | No |
| `MONGODB_URI` | MongoDB connection string | mongodb://localhost:27017/smsi-iso27001 | Yes |
| `JWT_SECRET` | JWT signing secret | - | Yes |
| `JWT_REFRESH_SECRET` | JWT refresh secret | - | Yes |
| `JWT_EXPIRES_IN` | Access token expiry | 1h | No |
| `JWT_REFRESH_EXPIRES_IN` | Refresh token expiry | 7d | No |
| `BCRYPT_ROUNDS` | Password hashing rounds | 12 | No |
| `RATE_LIMIT_WINDOW_MS` | Rate limit window | 900000 (15 min) | No |
| `RATE_LIMIT_MAX_REQUESTS` | Max requests per window | 100 | No |
| `FRONTEND_URL` | Frontend URL for CORS | http://localhost:3000 | No |

### JWT Configuration

Generate strong secrets for production:

```bash
# Generate random JWT secret
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

## 📱 API Endpoints

### Authentication Routes (`/api/auth`)

| Method | Endpoint | Description | Access |
|--------|----------|-------------|---------|
| POST | `/register` | User registration | Public |
| POST | `/login` | User authentication | Public |
| POST | `/refresh` | Refresh access token | Public |
| POST | `/forgot-password` | Request password reset | Public |
| POST | `/reset-password` | Reset password | Public |
| POST | `/logout` | User logout | Private |
| GET | `/me` | Get current user profile | Private |
| PUT | `/me` | Update user profile | Private |

### User Routes (`/api/users`)

| Method | Endpoint | Description | Access |
|--------|----------|-------------|---------|
| GET | `/` | Get all users | Admin |
| GET | `/:id` | Get user by ID | Self/Admin |
| PUT | `/:id` | Update user | Self/Admin |
| DELETE | `/:id` | Delete user | Admin |
| PUT | `/:id/password` | Change password | Self/Admin |
| GET | `/stats/summary` | User statistics | Admin |
| POST | `/:id/lock` | Lock/unlock user | Admin |

### Questionnaire Routes (`/api/questionnaires`)

| Method | Endpoint | Description | Access |
|--------|----------|-------------|---------|
| POST | `/` | Submit questionnaire | Private |
| GET | `/` | Get user questionnaires | Private |
| GET | `/:id` | Get questionnaire by ID | Private |
| PUT | `/:id` | Update questionnaire | Private |
| DELETE | `/:id` | Delete questionnaire | Private |
| GET | `/stats/summary` | Get statistics | Private |
| GET | `/stats/trends` | Get trends | Private |

### Roadmap Routes (`/api/roadmaps`)

| Method | Endpoint | Description | Access |
|--------|----------|-------------|---------|
| POST | `/` | Create roadmap | Private |
| GET | `/` | Get user roadmaps | Private |
| GET | `/:id` | Get roadmap by ID | Private |
| PUT | `/:id` | Update roadmap | Private |
| DELETE | `/:id` | Delete roadmap | Private |
| POST | `/:id/tasks` | Add task | Private |
| PUT | `/:id/tasks/:taskId` | Update task | Private |
| GET | `/:id/progress` | Get progress | Private |

## 🔐 Authentication & Authorization

### JWT Tokens

- **Access Token**: Short-lived (1 hour) for API requests
- **Refresh Token**: Long-lived (7 days) for token renewal
- **Password Reset Token**: Short-lived (10 minutes) for password reset

### Role-Based Access Control

- **User**: Basic access to own resources
- **Web Developer**: Extended access with development tools
- **Admin**: Full access to all resources and user management

### Security Features

- Password hashing with bcrypt (12 rounds)
- Rate limiting (100 requests per 15 minutes)
- Account lockout after 5 failed login attempts
- CORS protection
- Helmet security headers
- Input validation with express-validator

## 🗄️ Database Models

### User Model

- Authentication fields (email, password)
- Profile information (name, company, position, etc.)
- Role-based permissions
- Account security (login attempts, lock status)
- Preferences and settings

### Questionnaire Model

- User responses to ISO 27001 questions
- Automatic score calculation
- Category-based scoring (Plan, Do, Check, Act)
- Maturity level assessment
- Non-conformity identification

### Roadmap Model

- Personalized improvement roadmap
- Task management with priorities
- Milestone tracking
- Progress monitoring
- Risk assessment and compliance requirements

## 🧪 Testing

### Health Check

```bash
curl http://localhost:3001/health
```

Expected response:
```json
{
  "status": "OK",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "uptime": 123.456
}
```

### API Testing

Use tools like Postman or curl to test endpoints:

```bash
# Test registration
curl -X POST http://localhost:3001/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"name":"Test User","email":"test@example.com","password":"TestPass123"}'

# Test login
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"TestPass123"}'
```

## 🚀 Production Deployment

### Environment Setup

1. Set `NODE_ENV=production`
2. Use strong, unique JWT secrets
3. Configure production MongoDB URI
4. Set appropriate rate limiting values
5. Configure email service for password reset

### Security Considerations

- Use HTTPS in production
- Set secure cookie options
- Configure proper CORS origins
- Implement request logging
- Set up monitoring and alerting

### Performance Optimization

- Enable MongoDB connection pooling
- Implement caching strategies
- Use compression middleware
- Monitor API response times

## 🐛 Troubleshooting

### Common Issues

#### MongoDB Connection Failed
- Verify MongoDB is running
- Check connection string format
- Ensure network access to MongoDB port

#### JWT Errors
- Verify JWT secrets are set
- Check token expiration times
- Ensure consistent secret usage

#### CORS Errors
- Verify frontend URL in environment
- Check CORS middleware configuration
- Ensure proper origin handling

### Debug Mode

Enable detailed logging:
```env
NODE_ENV=development
```

### Logs

Check server logs for detailed error information:
```bash
# View real-time logs
tail -f logs/app.log

# Check system logs
sudo journalctl -u your-app-service -f
```

## 📚 Dependencies

### Core Dependencies

- **express**: Web framework
- **mongoose**: MongoDB ODM
- **bcryptjs**: Password hashing
- **jsonwebtoken**: JWT implementation
- **cors**: Cross-origin resource sharing
- **helmet**: Security headers
- **express-rate-limit**: Rate limiting
- **express-validator**: Input validation

### Development Dependencies

- **nodemon**: Auto-reload during development
- **jest**: Testing framework

## 🤝 Contributing

1. Follow the existing code style
2. Add proper error handling
3. Include input validation
4. Write tests for new features
5. Update documentation

## 📄 License

This project is licensed under the MIT License.

## 🆘 Support

For issues and questions:
1. Check the troubleshooting section
2. Review server logs
3. Verify configuration
4. Test with minimal setup
5. Check MongoDB connection status



