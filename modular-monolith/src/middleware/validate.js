import response from '../shared/utils/response.js';

/**
 * 🛡️ Zod Validation Middleware
 * 
 * Validates request body, query, or params against a Zod schema.
 * Returns standardized error responses on failure.
 */
export const validate = (schema) => (req, res, next) => {
  try {
    const result = schema.safeParse({
      body: req.body,
      query: req.query,
      params: req.params,
    });

    if (!result.success) {
      return response.error(
        res, 
        'Validation failed', 
        400, 
        'ERR_VALIDATION_FAILED', 
        result.error.format()
      );
    }

    // Replace request parts with sanitized data
    req.body = result.data.body;
    req.query = result.data.query;
    req.params = result.data.params;
    
    next();
  } catch (err) {
    next(err);
  }
};

export default validate;
