import swaggerJsdoc from 'swagger-jsdoc';
import swaggerUi from 'swagger-ui-express';

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'FanFever API Documentation',
      version: '1.0.0',
      description: 'API documentation for the FanFever Dynamic Ticket Pricing Monolith',
    },
    servers: [
      {
        url: 'http://localhost:4000/api/v1',
        description: 'V1 API Server',
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
        },
      },
    },
  },
  apis: ['./src/modules/**/*.routes.js', './src/modules/**/*.controller.js'], 
};

const specs = swaggerJsdoc(options);

export const setupSwagger = (app) => {
  app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(specs, {
    swaggerOptions: {
      persistAuthorization: true,
    }
  }));
  console.log('📖 [Swagger] Documentation available at /api/docs');
};

export default setupSwagger;
