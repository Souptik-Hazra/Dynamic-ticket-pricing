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
 *         schema:
 *           $ref: '#/definitions/AuthResponse'
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
 *         schema:
 *           $ref: '#/definitions/AuthResponse'
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
 *         schema:
 *           $ref: '#/definitions/User'
 *       401:
 *         $ref: '#/definitions/UnauthorizedError'
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
 *         schema:
 *           type: array
 *           items:
 *             $ref: '#/definitions/Event'
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
 *         schema:
 *           $ref: '#/definitions/Event'
 *       401:
 *         $ref: '#/definitions/UnauthorizedError'
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
 *         schema:
 *           $ref: '#/definitions/Event'
 *       404:
 *         $ref: '#/definitions/NotFoundError'
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
 *         $ref: '#/definitions/NotFoundError'
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
 *         $ref: '#/definitions/NotFoundError'
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
 *         schema:
 *           type: array
 *           items:
 *             $ref: '#/definitions/Ticket'
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
 *         schema:
 *           $ref: '#/definitions/Ticket'
 *       400:
 *         description: Not enough seats available
 *       401:
 *         $ref: '#/definitions/UnauthorizedError'
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
 *         $ref: '#/definitions/NotFoundError'
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
 *         schema:
 *           $ref: '#/definitions/PricePrediction'
 *
 * /api/ml/health:
 *   get:
 *     summary: Check ML model health
 *     tags: [ML Model]
 *     responses:
 *       200:
 *         description: ML model is healthy
 *         schema:
 *           $ref: '#/definitions/MLHealth'
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
 *         schema:
 *           $ref: '#/definitions/DashboardAnalytics'
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
 *         schema:
 *           $ref: '#/definitions/PriceHistory'
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
 *         schema:
 *           $ref: '#/definitions/User'
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
 *         schema:
 *           $ref: '#/definitions/SystemStats'
 */

// This file contains only Swagger documentation comments
// It's referenced by swagger.js for API documentation
module.exports = {};
