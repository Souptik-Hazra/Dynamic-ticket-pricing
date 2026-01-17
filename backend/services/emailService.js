const nodemailer = require('nodemailer');

class EmailService {
  constructor() {
    // Configure transporter (using Gmail as example)
    // For production, use proper SMTP service like SendGrid, AWS SES, etc.
    this.transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port: process.env.SMTP_PORT || 587,
      secure: false,
      auth: {
        user: process.env.SMTP_USER || '',
        pass: process.env.SMTP_PASS || ''
      }
    });
    
    this.fromEmail = process.env.FROM_EMAIL || 'noreply@ticketprice.com';
    this.isConfigured = !!(process.env.SMTP_USER && process.env.SMTP_PASS);
    
    if (!this.isConfigured) {
      console.log('⚠️  Email service not configured. Set SMTP_USER and SMTP_PASS in .env');
    }
  }

  async sendBookingConfirmation(userEmail, bookingDetails) {
    if (!this.isConfigured) {
      console.log('📧 Email would be sent to:', userEmail);
      console.log('   Booking:', bookingDetails.bookingReference);
      return { success: true, simulated: true };
    }

    const { bookingReference, eventName, eventDate, venue, quantity, totalPrice, ticketType } = bookingDetails;

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
          .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
          .ticket-box { background: white; border: 2px dashed #667eea; padding: 20px; margin: 20px 0; border-radius: 10px; }
          .detail-row { display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #eee; }
          .total { font-size: 24px; color: #667eea; font-weight: bold; }
          .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
          .btn { display: inline-block; background: #667eea; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; margin-top: 20px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🎫 Booking Confirmed!</h1>
            <p>Your tickets are ready</p>
          </div>
          <div class="content">
            <p>Thank you for your purchase! Here are your booking details:</p>
            
            <div class="ticket-box">
              <h2 style="margin: 0 0 15px 0; color: #667eea;">📍 ${eventName}</h2>
              
              <div class="detail-row">
                <span>Booking Reference:</span>
                <strong>${bookingReference}</strong>
              </div>
              
              <div class="detail-row">
                <span>Date:</span>
                <span>${new Date(eventDate).toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</span>
              </div>
              
              <div class="detail-row">
                <span>Venue:</span>
                <span>${venue}</span>
              </div>
              
              <div class="detail-row">
                <span>Ticket Type:</span>
                <span>${ticketType || 'Standard'}</span>
              </div>
              
              <div class="detail-row">
                <span>Quantity:</span>
                <span>${quantity} ticket(s)</span>
              </div>
              
              <div class="detail-row">
                <span>Total Paid:</span>
                <span class="total">₹${totalPrice.toFixed(2)}</span>
              </div>
            </div>
            
            <p>📱 Show this email at the venue for entry.</p>
            <p>⚠️ Please arrive 30 minutes before the event starts.</p>
            
            <center>
              <a href="#" class="btn">View Your Tickets</a>
            </center>
          </div>
          <div class="footer">
            <p>Dynamic Ticket Pricing System</p>
            <p>This is an automated message. Please do not reply.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    try {
      await this.transporter.sendMail({
        from: `"Dynamic Tickets" <${this.fromEmail}>`,
        to: userEmail,
        subject: `🎫 Booking Confirmed - ${eventName}`,
        html: html
      });
      
      console.log(`📧 Confirmation email sent to ${userEmail}`);
      return { success: true };
    } catch (error) {
      console.error('Email send error:', error);
      return { success: false, error: error.message };
    }
  }

  async sendPriceDropAlert(userEmail, eventDetails) {
    if (!this.isConfigured) {
      console.log('📧 Price drop alert would be sent to:', userEmail);
      return { success: true, simulated: true };
    }

    const { eventName, oldPrice, newPrice, percentageDrop } = eventDetails;

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #28a745; color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
          .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
          .price-compare { display: flex; justify-content: space-around; padding: 20px; }
          .old-price { color: #999; text-decoration: line-through; font-size: 24px; }
          .new-price { color: #28a745; font-size: 32px; font-weight: bold; }
          .savings { background: #28a745; color: white; padding: 10px 20px; border-radius: 20px; display: inline-block; }
          .btn { display: inline-block; background: #28a745; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>💰 Price Drop Alert!</h1>
          </div>
          <div class="content">
            <h2>${eventName}</h2>
            <p>Good news! The price has dropped on an event you're interested in.</p>
            
            <div class="price-compare">
              <div>
                <p>Was</p>
                <span class="old-price">₹${oldPrice.toFixed(2)}</span>
              </div>
              <div>
                <p>Now</p>
                <span class="new-price">₹${newPrice.toFixed(2)}</span>
              </div>
            </div>
            
            <center>
              <span class="savings">Save ${percentageDrop}%!</span>
              <br><br>
              <a href="#" class="btn">Book Now</a>
            </center>
          </div>
        </div>
      </body>
      </html>
    `;

    try {
      await this.transporter.sendMail({
        from: `"Dynamic Tickets" <${this.fromEmail}>`,
        to: userEmail,
        subject: `💰 Price Drop: ${eventName} - Save ${percentageDrop}%!`,
        html: html
      });
      
      return { success: true };
    } catch (error) {
      console.error('Email send error:', error);
      return { success: false, error: error.message };
    }
  }

  async sendWelcomeEmail(userEmail, userName) {
    if (!this.isConfigured) {
      console.log('📧 Welcome email would be sent to:', userEmail);
      return { success: true, simulated: true };
    }

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 40px; text-align: center; border-radius: 10px 10px 0 0; }
          .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
          .feature { padding: 15px; margin: 10px 0; background: white; border-radius: 5px; }
          .btn { display: inline-block; background: #667eea; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Welcome to Dynamic Tickets! 🎉</h1>
          </div>
          <div class="content">
            <h2>Hi ${userName}!</h2>
            <p>Thank you for joining Dynamic Ticket Pricing. Here's what you can do:</p>
            
            <div class="feature">✨ <strong>Smart Pricing</strong> - Get the best prices with AI-powered dynamic pricing</div>
            <div class="feature">🔔 <strong>Price Alerts</strong> - Get notified when prices drop</div>
            <div class="feature">📊 <strong>Analytics</strong> - Track price trends and make informed decisions</div>
            <div class="feature">⚡ <strong>Instant Booking</strong> - Secure your tickets in seconds</div>
            
            <center>
              <a href="#" class="btn">Browse Events</a>
            </center>
          </div>
        </div>
      </body>
      </html>
    `;

    try {
      await this.transporter.sendMail({
        from: `"Dynamic Tickets" <${this.fromEmail}>`,
        to: userEmail,
        subject: `Welcome to Dynamic Tickets, ${userName}! 🎉`,
        html: html
      });
      
      return { success: true };
    } catch (error) {
      console.error('Email send error:', error);
      return { success: false, error: error.message };
    }
  }
}

module.exports = new EmailService();
