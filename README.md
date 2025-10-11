# Multi Calculator Backend

Node.js/Express backend API for the Multi Calculator application with MongoDB and JWT authentication.

## Features

- 🔐 JWT Authentication
- 🗄️ MongoDB Integration
- 🔒 Password Hashing with bcrypt
- 🌐 CORS enabled
- ⚡ Express.js framework

## Setup

1. Install dependencies:
```bash
npm install
```

2. Create environment file:
```bash
cp .env.example .env
```

3. Update the `.env` file with your configuration:
```env
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/multicalc?retryWrites=true&w=majority
JWT_SECRET=your_super_secret_jwt_key_here
PORT=5000
```

4. Start development server:
```bash
npm run dev
```

## Available Scripts

- `npm start` - Start production server
- `npm run dev` - Start development server with nodemon

## API Endpoints

### Authentication Routes

#### POST /api/auth/signup
Register a new user
```json
{
  "username": "string",
  "password": "string"
}
```

#### POST /api/auth/login
Login existing user
```json
{
  "username": "string",
  "password": "string"
}
```

Returns JWT token on successful login.

## Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `MONGODB_URI` | MongoDB connection string | Yes |
| `JWT_SECRET` | Secret key for JWT tokens | Yes |
| `PORT` | Server port | No (default: 5000) |

## Database Schema

### User Collection
```javascript
{
  username: String (required, unique),
  password: String (required, hashed)
}
```

## Deployment

### Railway (Recommended)
1. Connect GitHub repository
2. Set environment variables
3. Deploy automatically

### Render
1. Connect repository
2. Set build command: `npm install`
3. Set start command: `npm start`
4. Add environment variables

### Heroku
1. Create Heroku app
2. Set environment variables
3. Deploy with Git

## Security Features

- Password hashing with bcryptjs
- JWT token authentication
- CORS protection
- Environment variable protection

## Tech Stack

- **Node.js** - Runtime environment
- **Express.js** - Web framework
- **MongoDB** - Database
- **Mongoose** - ODM for MongoDB
- **JWT** - Authentication tokens
- **bcryptjs** - Password hashing

## Error Handling

The API returns consistent error responses:
```json
{
  "success": false,
  "message": "Error description"
}
```

Success responses:
```json
{
  "success": true,
  "message": "Success message",
  "data": {}
}
```
