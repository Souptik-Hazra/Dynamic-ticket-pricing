
const swaggerJsdoc = require('swagger-jsdoc');

const options = {
  swaggerDefinition: {
    swagger: '2.0',
    info: {
      title: 'Dynamic Ticket Pricing API',
      version: '1.0.0',
      description: 'API for dynamic ticket pricing, event management, and analytics.'
    },
    host: 'localhost:3001',
    basePath: '/api',
    schemes: ['http', 'https'],
    definitions: {
      AuthResponse: {
        type: 'object',
        properties: {
          token: { type: 'string', example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...' },
          user: { $ref: '#/definitions/User' }
        }
      },
      User: {
        type: 'object',
        properties: {
          _id: { type: 'string', example: '507f1f77bcf86cd799439011' },
          name: { type: 'string', example: 'Admin 1' },
          email: { type: 'string', format: 'email', example: 'admin@cf.com' },
          password: { type: 'string', example: '$2a$10$4p5VeQBxQ559MBCjGDT37uZS8hh/cLBt85M0NZYgrKZqiD6010jqK' },
          role: { type: 'string', example: 'admin' },
          isActive: { type: 'boolean', example: true },
          icon: { type: 'string', example: '' },
          city: { type: 'string', example: '' },
          subscription: { type: 'object' },
          createdAt: { type: 'string', format: 'date-time', example: '2026-02-21T17:27:56.713+00:00' },
          __v: { type: 'integer', example: 0 },
          lastLogin: { type: 'string', format: 'date-time', example: '2026-02-21T18:54:56.072+00:00' }
        }
      },
      Event: {
        type: 'object',
        properties: {
          _id: { type: 'string', example: '696b493dcbd8a2ade0c7bbb3' },
          name: { type: 'string', example: 'Garba Night' },
          description: { type: 'string', example: 'Garba' },
          venue: { type: 'string', example: 'SJT Ground' },
          date: { type: 'string', format: 'date-time', example: '2026-01-29T16:01:00.000Z' },
          ticketCategories: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                name: { type: 'string', example: 'standard' },
                price: { type: 'number', example: 100 },
                maxPrice: { type: 'number', example: 300 },
                seats: { type: 'integer', example: 198 },
                availableSeats: { type: 'integer', example: 0 },
                _id: { type: 'string', example: '6973b9eb5f21a2ce11845c39' }
              }
            }
          },
          popularity: { type: 'integer', example: 5 },
          eventPopularity: { type: 'integer', example: 1 },
          historicalDemand: { type: 'number', example: 0.5 },
          category: { type: 'string', example: 'festival' },
          image: { type: 'string', example: 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcRPa7X0ewafG3cjsMOrgOkAeX1Z1JmT-lPhWQ&s' },
          ticketsSold: { type: 'integer', example: 259 },
          totalSales: { type: 'number', example: 0 },
          totalRevenue: { type: 'number', example: 118531.71 },
          status: { type: 'string', example: 'completed' },
          eventDate: { type: 'string', format: 'date-time', example: '2026-01-30T08:31:00.000Z' },
          capacity: { type: 'integer', example: 259 },
          totalCapacity: { type: 'integer', example: 254 },
          availableTickets: { type: 'integer', example: 0 },
          basePrice: { type: 'number', example: 100 },
          ticketPrice: { type: 'number', example: 100 },
          currentPrice: { type: 'number', example: 281.3 },
          createdAt: { type: 'string', format: 'date-time', example: '2026-01-17T08:33:01.948Z' },
          updatedAt: { type: 'string', format: 'date-time', example: '2026-02-09T13:57:43.270Z' },
          __v: { type: 'integer', example: 0 },
          endDate: { type: 'string', format: 'date-time', example: '2026-02-07T18:11:00.000Z' },
          startDate: { type: 'string', format: 'date-time', example: '2026-01-05T18:11:00.000Z' }
        }
      },
      Ticket: {
        type: 'object',
        properties: {
          _id: { type: 'string', example: '696b953adf0b3cbca2f5ef14' },
          eventId: { type: 'string', example: '696b493dcbd8a2ade0c7bbb3' },
          userId: { type: 'string', example: '696b1f8d204a11c58c72c32c' },
          customerName: { type: 'string', example: 'Admin User' },
          customerEmail: { type: 'string', example: 'admin@test.com' },
          quantity: { type: 'integer', example: 195 },
          price: { type: 'number', example: 154 },
          totalAmount: { type: 'number', example: 30030 },
          purchaseDate: { type: 'string', format: 'date-time', example: '2026-01-17T13:57:14.948Z' },
          categoryName: { type: 'string', example: 'standard' },
          ticketType: { type: 'string', example: 'standard' },
          status: { type: 'string', example: 'confirmed' },
          bookingReference: { type: 'string', example: 'TKT-1768658234948-FT9PC8PCH' },
          createdAt: { type: 'string', format: 'date-time', example: '2026-01-17T13:57:14.960Z' },
          updatedAt: { type: 'string', format: 'date-time', example: '2026-01-17T13:57:14.960Z' },
          __v: { type: 'integer', example: 0 }
        }
      },
      PricePrediction: {
        type: 'object',
        properties: {
          _id: { type: 'string', example: '696b3f8ddef52da7551c6b1d' },
          event: { type: 'string', example: '696b2c1b04e73ff71cd9d80e' },
          inputFeatures: {
            type: 'object',
            properties: {
              demand: { type: 'number', example: 100 },
              capacity: { type: 'number', example: 160 },
              daysUntilEvent: { type: 'integer', example: 13 },
              eventPopularity: { type: 'number', example: 0.7 },
              competitorPrice: { type: 'number', example: 14.4 },
              historicalSales: { type: 'number', example: 0 },
              season: { type: 'integer', example: 1 },
              dayOfWeek: { type: 'integer', example: 5 }
            }
          },
          predictedPrice: { type: 'number', example: 69.07 },
          priceRange: {
            type: 'object',
            properties: {
              min: { type: 'number', example: 63.54 },
              max: { type: 'number', example: 74.6 }
            }
          },
          confidence: { type: 'number', example: 0.95 },
          modelVersion: { type: 'string', example: 'v20260117_130152' },
          timestamp: { type: 'string', format: 'date-time', example: '2026-01-17T07:51:41.086Z' },
          createdAt: { type: 'string', format: 'date-time', example: '2026-01-17T07:51:41.087Z' },
          updatedAt: { type: 'string', format: 'date-time', example: '2026-01-17T07:51:41.087Z' },
          __v: { type: 'integer', example: 0 }
        }
      },
      Error: {
        type: 'object',
        properties: {
          message: { type: 'string', example: 'An error occurred' },
          error: { type: 'string' }
        }
      },
      UnauthorizedError: {
        type: 'object',
        properties: {
          message: { type: 'string', example: 'Access token is missing or invalid' },
          error: { type: 'string' }
        }
      },
      NotFoundError: {
        type: 'object',
        properties: {
          message: { type: 'string', example: 'The specified resource was not found' },
          error: { type: 'string' }
        }
      }
    },
  },
  apis: [
    './routes/admin.js',
    './routes/analytics.js',
    './routes/auth.js',
    './routes/events.js',
    './routes/mlModel.js',
    './routes/subscription.js',
    './routes/tickets.js',
    './swagger-docs.js'
  ]
};

const specs = swaggerJsdoc(options);
module.exports = specs;
