const swaggerJsdoc = require('swagger-jsdoc');

const options = {
  swaggerDefinition: {
    openapi: '3.0.0',
    info: {
      title: 'Dynamic Ticket Pricing API',
      version: '1.0.0',
      description: `
# Dynamic Ticket Pricing API

A comprehensive API for managing dynamic ticket pricing using machine learning.

## Features
- 🎫 Event Management
- 💰 Dynamic Pricing with ML
- 🔐 JWT Authentication
- 📊 Analytics & Reporting
- 🎟️ Ticket Booking System

## Authentication
Most endpoints require a JWT token. Include it in the Authorization header:
\`\`\`
Authorization: Bearer <your-token>
\`\`\`

## Currency
All prices are in Indian Rupees (₹ INR).
      `,
      contact: {
        name: 'API Support',
        email: 'support@dynamicticketpricing.com'
      },
      license: {
        name: 'MIT',
        url: 'https://opensource.org/licenses/MIT'
      }
    },
    servers: [
      {
        url: 'http://localhost:3001',
        description: 'Development server'
      },
      {
        url: 'https://api.dynamicticketpricing.com',
        description: 'Production server'
      }
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'Enter your JWT token'
        }
      },
      schemas: {
        User: {
          type: 'object',
          properties: {
            _id: { type: 'string', example: '507f1f77bcf86cd799439011' },
            name: { type: 'string', example: 'John Doe' },
            email: { type: 'string', format: 'email', example: 'john@example.com' },
            isAdmin: { type: 'boolean', default: false },
            createdAt: { type: 'string', format: 'date-time' }
          }
        },
        Event: {
          type: 'object',
          required: ['title', 'description', 'date', 'location', 'basePrice', 'totalSeats'],
          properties: {
            _id: { type: 'string', example: '507f1f77bcf86cd799439011' },
            title: { type: 'string', example: 'Music Concert 2024' },
            description: { type: 'string', example: 'An amazing music concert' },
            date: { type: 'string', format: 'date-time' },
            location: { type: 'string', example: 'Mumbai Stadium' },
            category: { 
              type: 'string', 
              enum: ['concert', 'sports', 'theater', 'conference', 'festival'],
              example: 'concert'
            },
            basePrice: { type: 'number', example: 500 },
            currentPrice: { type: 'number', example: 650 },
            totalSeats: { type: 'integer', example: 1000 },
            availableSeats: { type: 'integer', example: 750 },
            image: { type: 'string', example: 'https://example.com/image.jpg' }
          }
        },
        Ticket: {
          type: 'object',
          properties: {
            _id: { type: 'string' },
            user: { type: 'string', description: 'User ID' },
            event: { type: 'string', description: 'Event ID' },
            quantity: { type: 'integer', minimum: 1 },
            pricePerTicket: { type: 'number' },
            totalPrice: { type: 'number' },
            status: { 
              type: 'string', 
              enum: ['pending', 'confirmed', 'cancelled'],
              default: 'confirmed'
            },
            purchasedAt: { type: 'string', format: 'date-time' }
          }
        },
        PricePrediction: {
          type: 'object',
          properties: {
            predicted_price: { type: 'number', example: 650.50 },
            confidence: { type: 'number', example: 0.85 },
            currency: { type: 'string', example: 'INR' },
            factors: {
              type: 'object',
              properties: {
                demand_impact: { type: 'string', example: 'high' },
                time_factor: { type: 'string', example: 'moderate' },
                competitor_influence: { type: 'string', example: 'low' }
              }
            }
          }
        },
        Error: {
          type: 'object',
          properties: {
            message: { type: 'string', example: 'An error occurred' },
            error: { type: 'string' }
          }
        },
        AuthResponse: {
          type: 'object',
          properties: {
            token: { type: 'string', example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...' },
            user: { $ref: '#/components/schemas/User' }
          }
        }
      },
      responses: {
        UnauthorizedError: {
          description: 'Access token is missing or invalid',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/Error' }
            }
          }
        },
        NotFoundError: {
          description: 'The specified resource was not found',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/Error' }
            }
          }
        }
      }
    },
    tags: [
      { name: 'Authentication', description: 'User registration and login' },
      { name: 'Events', description: 'Event management endpoints' },
      { name: 'Tickets', description: 'Ticket booking and management' },
      { name: 'ML Model', description: 'Machine learning price prediction' },
      { name: 'Analytics', description: 'Analytics and reporting' },
      { name: 'Admin', description: 'Admin-only endpoints' }
    ]
  },
  apis: ['./routes/admin.js', './routes/analytics.js', './routes/auth.js', './routes/events.js', './routes/mlModel.js', './routes/subscription.js', './routes/tickets.js', './swagger-docs.js']
};

const specs = swaggerJsdoc(options);

module.exports = specs;
