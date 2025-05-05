import express from 'express';
import { verifyToken, isValidTokenPayload, createToken } from '../auth/token-service';
import jwt from 'jsonwebtoken';

const router = express.Router();

// Test route to verify auth middleware is working
router.get("/api/auth-test", (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).json({ error: "No authorization token provided" });
  }

  const token = authHeader.split(" ")[1];
  if (!token) {
    return res.status(401).json({ error: "Invalid authorization header format" });
  }

  try {
    const decoded = verifyToken(token);
    console.log(`Auth-test: decoded token:`, decoded);
    
    // Check if the token has valid information
    if (!isValidTokenPayload(decoded)) {
      console.error(`Auth-test: Invalid token payload:`, JSON.stringify(decoded));
      return res.status(401).json({ error: "Invalid token format - missing user identifier" });
    }
    
    res.json({ 
      message: "Authentication successful",
      user: {
        userId: decoded.userId,
        email: decoded.email
      }
    });
  } catch (error: any) {
    console.error(`Auth-test: Token verification failed:`, error);
    return res.status(401).json({ 
      error: "Authentication failed", 
      details: error.message 
    });
  }
});

// Test endpoint to generate/verify tokens and check behavior
router.get("/api/debug-token-test", (req, res) => {
  try {
    // Generate a test token for userId 54
    const userId = 54;
    const email = "athomas@exlsolutions.ae";
    
    console.log(`DEBUG TEST: Calling createToken with userId=${userId}, email=${email}`);
    console.log(`DEBUG TEST: Email value type: ${typeof email}, value: "${email}"`);
    
    // Generate a token with both userId and email
    const token = createToken(userId, email);
    console.log(`DEBUG TEST: Created token: ${token.substring(0, 20)}...`);
    
    // Decode the token to check its payload
    const decoded = jwt.decode(token);
    console.log(`DEBUG TEST: Token payload: ${JSON.stringify(decoded)}`);
    
    // Verify the token
    const verified = verifyToken(token);
    console.log(`DEBUG TEST: Verified token payload: ${JSON.stringify(verified)}`);
    
    // Generate a token with only userId (no email)
    const tokenNoEmail = createToken(userId);
    console.log(`DEBUG TEST: Created token (no email): ${tokenNoEmail.substring(0, 20)}...`);
    
    // Decode and verify the token without email
    const decodedNoEmail = jwt.decode(tokenNoEmail);
    console.log(`DEBUG TEST: Token payload (no email): ${JSON.stringify(decodedNoEmail)}`);
    
    const verifiedNoEmail = verifyToken(tokenNoEmail);
    console.log(`DEBUG TEST: Verified token payload (no email): ${JSON.stringify(verifiedNoEmail)}`);
    
    // Return results
    res.json({
      message: "Token tests completed successfully",
      results: {
        withEmail: {
          token: token.substring(0, 20) + "...",
          decoded,
          verified: !!verified
        },
        withoutEmail: {
          token: tokenNoEmail.substring(0, 20) + "...",
          decoded: decodedNoEmail,
          verified: !!verifiedNoEmail
        }
      }
    });
  } catch (error: any) {
    console.error(`DEBUG TEST: Error:`, error);
    res.status(500).json({
      error: "Error during token testing",
      details: error.message,
      stack: error.stack
    });
  }
});

export default router;