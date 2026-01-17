/**
 * @swagger
 * /api/auth/register:
 *   post:
 *     summary: Register a new user
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - email
 *               - password
 *             properties:
 *               name:
 *                 type: string
 *                 example: John Doe
 *               email:
 *                 type: string
 *                 format: email
 *                 example: john@example.com
 *               password:
 *                 type: string
 *                 format: password
 *                 minLength: 6
 *                 example: password123
 *     responses:
 *       201:
 *         description: User registered successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AuthResponse'
 *       400:
 *         description: Invalid input or user already exists
 *
 * /api/auth/login:
 *   post:
 *     summary: Login user
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *               password:
 *                 type: string
 *     responses:
 *       200:
 *         description: Login successful
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AuthResponse'
 *       401:
 *         description: Invalid credentials
 *
 * /api/auth/me:
 *   get:
 *     summary: Get current user profile
 *     tags: [Authentication]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: User profile
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/User'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */

/**
 * @swagger
 * /api/events:
 *   get:
 *     summary: Get all events
 *     tags: [Events]
 *     parameters:
 *       - in: query
 *         name: category
 *         schema:
 *           type: string
 *           enum: [concert, sports, theater, conference, festival]
 *         description: Filter by event category
 *       - in: query
 *         name: sort
 *         schema:
 *           type: string
 *           enum: [date, price, popularity]
 *         description: Sort order
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *         description: Number of events to return
 *     responses:
 *       200:
 *         description: List of events
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Event'
 *
 *   post:
 *     summary: Create a new event (Admin only)
 *     tags: [Events, Admin]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/Event'
 *     responses:
 *       201:
 *         description: Event created successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Event'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         description: Admin access required
 *
 * /api/events/{id}:
 *   get:
 *     summary: Get event by ID
 *     tags: [Events]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Event ID
 *     responses:
 *       200:
 *         description: Event details
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Event'
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 *
 *   put:
 *     summary: Update event (Admin only)
 *     tags: [Events, Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/Event'
 *     responses:
 *       200:
 *         description: Event updated
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 *
 *   delete:
 *     summary: Delete event (Admin only)
 *     tags: [Events, Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Event deleted
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 */

/**
 * @swagger
 * /api/tickets:
 *   get:
 *     summary: Get user's tickets
 *     tags: [Tickets]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of user's tickets
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Ticket'
 *
 *   post:
 *     summary: Purchase tickets
 *     tags: [Tickets]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - eventId
 *               - quantity
 *             properties:
 *               eventId:
 *                 type: string
 *                 description: Event ID to purchase tickets for
 *               quantity:
 *                 type: integer
 *                 minimum: 1
 *                 maximum: 10
 *                 description: Number of tickets
 *     responses:
 *       201:
 *         description: Tickets purchased successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Ticket'
 *       400:
 *         description: Not enough seats available
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *
 * /api/tickets/{id}/cancel:
 *   put:
 *     summary: Cancel a ticket
 *     tags: [Tickets]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Ticket cancelled and refund processed
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 */

/**
 * @swagger
 * /api/ml/predict:
 *   post:
 *     summary: Get ML price prediction
 *     tags: [ML Model]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - base_price
 *               - demand_level
 *               - days_until_event
 *             properties:
 *               base_price:
 *                 type: number
 *                 example: 500
 *                 description: Base ticket price in INR
 *               demand_level:
 *                 type: number
 *                 minimum: 0
 *                 maximum: 100
 *                 example: 75
 *                 description: Current demand level (0-100)
 *               days_until_event:
 *                 type: integer
 *                 minimum: 0
 *                 example: 14
 *                 description: Days remaining until event
 *               competitor_price:
 *                 type: number
 *                 example: 600
 *               time_of_day:
 *                 type: integer
 *                 minimum: 0
 *                 maximum: 23
 *                 example: 14
 *               day_of_week:
 *                 type: integer
 *                 minimum: 0
 *                 maximum: 6
 *                 example: 5
 *               tickets_sold_ratio:
 *                 type: number
 *                 minimum: 0
 *                 maximum: 1
 *                 example: 0.6
 *               event_popularity:
 *                 type: number
 *                 minimum: 0
 *                 maximum: 100
 *                 example: 80
 *     responses:
 *       200:
 *         description: Price prediction
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/PricePrediction'
 *
 * /api/ml/health:
 *   get:
 *     summary: Check ML model health
 *     tags: [ML Model]
 *     responses:
 *       200:
 *         description: ML model is healthy
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: healthy
 *                 model_version:
 *                   type: string
 *                   example: v20240117_130152
 *                 accuracy:
 *                   type: number
 *                   example: 0.9142
 */

/**
 * @swagger
 * /api/analytics/dashboard:
 *   get:
 *     summary: Get analytics dashboard data (Admin only)
 *     tags: [Analytics, Admin]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Dashboard analytics data
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 totalRevenue:
 *                   type: number
 *                 totalTicketsSold:
 *                   type: integer
 *                 activeEvents:
 *                   type: integer
 *                 averagePrice:
 *                   type: number
 *                 revenueByDay:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       date:
 *                         type: string
 *                       revenue:
 *                         type: number
 *
 * /api/analytics/price-history/{eventId}:
 *   get:
 *     summary: Get price history for an event
 *     tags: [Analytics]
 *     parameters:
 *       - in: path
 *         name: eventId
 *         required: true
 *         schema:
 *           type: string
 *       - in: query
 *         name: range
 *         schema:
 *           type: string
 *           enum: [24h, 7d, 30d]
 *           default: 7d
 *     responses:
 *       200:
 *         description: Price history data
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   timestamp:
 *                     type: string
 *                     format: date-time
 *                   price:
 *                     type: number
 *                   demand:
 *                     type: number
 */

/**
 * @swagger
 * /api/admin/users:
 *   get:
 *     summary: Get all users (Admin only)
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of all users
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/User'
 *       403:
 *         description: Admin access required
 *
 * /api/admin/stats:
 *   get:
 *     summary: Get system statistics (Admin only)
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: System statistics
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 totalUsers:
 *                   type: integer
 *                 totalEvents:
 *                   type: integer
 *                 totalRevenue:
 *                   type: number
 *                 mlModelAccuracy:
 *                   type: number
 */

// This file contains only Swagger documentation comments
// It's referenced by swagger.js for API documentation
module.exports = {};
