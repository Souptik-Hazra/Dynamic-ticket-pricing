# Issue Template

## Description

Please describe the issue or feature request clearly.

## Steps to Reproduce (for bugs)
1. 
2. 
3. 

## Expected Behavior

## Actual Behavior

## Additional Context

---
Thank you for reporting!

## Common Issues & Troubleshooting

- **Backend server fails to start:**
	- Check MongoDB is running and URI is correct
	- Ensure .env file is present and valid
	- Check for port conflicts (default: 3001)
- **ML API not responding:**
	- Install Python dependencies (`pip install -r requirements.txt`)
	- Train model before starting API
	- Ensure port 5000 is available
- **Frontend connection errors:**
	- Verify API URLs in config
	- Check CORS setup on backend
	- Ensure backend/ML servers are running
- **Ticket purchase errors:**
	- Check Redis/RabbitMQ availability
	- Validate event/ticket IDs
- **SSL/Certificate issues:**
	- Confirm certificate files exist in backend/cert
	- Check file paths and permissions
- **Authentication problems:**
	- Check JWT token validity
	- Ensure password hashing matches
	- Confirm role-based access is enforced