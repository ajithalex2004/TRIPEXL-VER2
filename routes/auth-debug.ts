import express from 'express';
import { storage } from '../storage';
import bcrypt from 'bcryptjs';

const router = express.Router();

// Route to check if a username exists
router.get('/check-username/:username', async (req, res) => {
  try {
    const username = req.params.username;
    console.log(`[AUTH-DEBUG] Checking if username exists: ${username}`);
    
    const user = await storage.getUserByUserName(username);
    
    if (user) {
      console.log(`[AUTH-DEBUG] User found: ${user.id}`);
      const { password, ...userWithoutPassword } = user;
      return res.json({ 
        exists: true, 
        user: userWithoutPassword
      });
    } else {
      console.log(`[AUTH-DEBUG] Username '${username}' not found`);
      return res.json({ exists: false });
    }
  } catch (error) {
    console.error('[AUTH-DEBUG] Error checking username:', error);
    return res.status(500).json({ error: 'Server error', message: error.message });
  }
});

// Route to test password verification
router.post('/verify-password', async (req, res) => {
  try {
    const { username, password } = req.body;
    
    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }
    
    console.log(`[AUTH-DEBUG] Testing password verification for username: ${username}`);
    
    const user = await storage.getUserByUserName(username);
    
    if (!user) {
      console.log(`[AUTH-DEBUG] User not found: ${username}`);
      return res.status(404).json({ error: 'User not found' });
    }
    
    // Log password format to help debug
    console.log(`[AUTH-DEBUG] Password format: ${user.password.substring(0, 10)}...`);
    
    // Test various password comparison methods
    const bcryptCompare = await bcrypt.compare(password, user.password);
    
    // Try direct string comparison (just for debugging)
    const directCompare = (password === user.password);
    
    // Try storage validation method if available
    let storageCompare = false;
    if (typeof storage.validateUserPassword === 'function') {
      try {
        storageCompare = await storage.validateUserPassword(user, password);
      } catch (err) {
        console.log('[AUTH-DEBUG] Error in storage.validateUserPassword:', err);
      }
    }
    
    console.log(`[AUTH-DEBUG] Comparison results:
      - bcrypt.compare: ${bcryptCompare}
      - direct compare: ${directCompare}
      - storage.validateUserPassword: ${storageCompare}
    `);
    
    return res.json({ 
      valid: bcryptCompare,
      directCompare,
      storageCompare,
      message: bcryptCompare ? 'Password is valid' : 'Password is invalid',
      passwordType: user.password.startsWith('$2') ? 'bcrypt' : 'unknown'
    });
  } catch (error) {
    console.error('[AUTH-DEBUG] Error verifying password:', error);
    return res.status(500).json({ error: 'Server error', message: error.message });
  }
});

// Route to reset a user's password (FOR TESTING ONLY)
router.post('/reset-password', async (req, res) => {
  try {
    const { username, newPassword } = req.body;
    
    if (!username || !newPassword) {
      return res.status(400).json({ error: 'Username and new password are required' });
    }
    
    console.log(`[AUTH-DEBUG] Resetting password for username: ${username}`);
    
    const user = await storage.getUserByUserName(username);
    
    if (!user) {
      console.log(`[AUTH-DEBUG] User not found: ${username}`);
      return res.status(404).json({ error: 'User not found' });
    }
    
    // Hash new password with bcrypt
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    
    // Update user's password
    await storage.updateUserPassword(user.id, hashedPassword);
    
    console.log(`[AUTH-DEBUG] Password reset successful for user: ${username}`);
    
    return res.json({ 
      success: true,
      message: 'Password reset successful'
    });
  } catch (error) {
    console.error('[AUTH-DEBUG] Error resetting password:', error);
    return res.status(500).json({ error: 'Server error', message: error.message });
  }
});

// Add a direct test endpoint for comparePasswords function
router.post('/test-compare-passwords', async (req, res) => {
  try {
    const { supplied, stored } = req.body;
    
    if (!supplied || !stored) {
      return res.status(400).json({ error: 'Both supplied and stored passwords are required' });
    }
    
    console.log(`[DEBUG ENDPOINT] Testing password comparison - supplied length: ${supplied.length}, stored starts with: ${stored.substring(0, 3)}...`);
    
    let bcryptResult = false;
    let legacyResult = false;
    
    // Test bcrypt
    try {
      bcryptResult = bcrypt.compareSync(supplied, stored);
      console.log(`[DEBUG ENDPOINT] bcrypt comparison result: ${bcryptResult}`);
    } catch (error) {
      console.error(`[DEBUG ENDPOINT] Error in bcrypt comparison:`, error);
    }
    
    // Test legacy format if it has a period
    if (stored.includes('.')) {
      try {
        const [hashed, salt] = stored.split(".");
        if (hashed && salt) {
          console.log(`[DEBUG ENDPOINT] Testing legacy format with salt: ${salt.substring(0, 3)}...`);
          
          const hashedBuf = Buffer.from(hashed, "hex");
          const suppliedBuf = Buffer.from(
            bcrypt.hashSync(`${supplied}${salt}`, 4).substring(7, 30), 
            'utf8'
          );
          
          const lengthMatch = hashedBuf.length === suppliedBuf.length;
          console.log(`[DEBUG ENDPOINT] Legacy buffer length match: ${lengthMatch}, ${hashedBuf.length} vs ${suppliedBuf.length}`);
          
          if (lengthMatch) {
            let mismatch = 0;
            for (let i = 0; i < hashedBuf.length; i++) {
              mismatch |= hashedBuf[i] ^ suppliedBuf[i];
            }
            legacyResult = mismatch === 0;
            console.log(`[DEBUG ENDPOINT] Legacy constant-time comparison result: ${legacyResult}`);
          }
        }
      } catch (error) {
        console.error(`[DEBUG ENDPOINT] Error in legacy comparison:`, error);
      }
    }
    
    return res.json({
      bcryptResult,
      legacyResult,
      overallResult: bcryptResult || legacyResult,
      storedFormat: stored.startsWith('$2') ? 'bcrypt' : (stored.includes('.') ? 'legacy' : 'unknown')
    });
  } catch (error) {
    console.error('[DEBUG ENDPOINT] Error in test-compare-passwords:', error);
    return res.status(500).json({ error: 'Server error', message: error.message });
  }
});

export const authDebugRouter = router;