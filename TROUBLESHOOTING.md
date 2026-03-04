# Troubleshooting Guide

## Common Issues

### Backend won't start
- Check MongoDB is running
- Verify `.env` configuration
- Check for missing dependencies: `npm install`

### ML API not responding
- Ensure Python dependencies are installed: `pip install -r requirements.txt`
- Train model before starting API

### Frontend errors
- Run `npm install` in frontend directory
- Check API URLs in config

### Certificate/SSL issues
- Regenerate certificates in `backend/cert/`
- Use correct file paths in server config
