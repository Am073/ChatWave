const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User.model');
const settings = require('../config/settings');
const { generateToken, setCsrfCookie } = require('../middlewares/csrf.middleware');

// Helper to generate access and refresh tokens
const generateTokens = (user) => {
  const accessToken = jwt.sign(
    {
      userId: user._id,
      role: user.role,
      college_name: user.college_name,
      department: user.department,
      college_id: user.college_id,
    },
    settings.JWT_SECRET,
    { expiresIn: '15m' }
  );

  const refreshToken = jwt.sign(
    { userId: user._id },
    settings.JWT_REFRESH_SECRET,
    { expiresIn: '7d' }
  );

  return { accessToken, refreshToken };
};

// Set token cookies on response
const setTokenCookies = (res, accessToken, refreshToken) => {
  const isProd = settings.NODE_ENV === 'production';
  
  res.cookie('access_token', accessToken, {
    httpOnly: true,
    secure: isProd,
    sameSite: 'lax',
    maxAge: 15 * 60 * 1000, // 15 minutes
    path: '/',
  });

  res.cookie('refresh_token', refreshToken, {
    httpOnly: true,
    secure: isProd,
    sameSite: 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    path: '/',
  });
};

exports.register = async (req, res) => {
  try {
    const { name, college_id, password, college_name, department, role } = req.body;

    if (!name || !college_id || !password || !college_name || !role) {
      return res.status(400).json({ error: 'Missing required registration fields' });
    }

    const existingUser = await User.findOne({ college_id });
    if (existingUser) {
      return res.status(400).json({ error: 'User with this College ID already exists' });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 12);

    // Create user
    const newUser = new User({
      name,
      college_id,
      password: hashedPassword,
      college_name,
      department: department || null,
      role,
      username: college_id,
      email: `${college_id.toLowerCase()}@chatwave.edu`,
      is_active: true,
    });

    // Generate tokens
    const { accessToken, refreshToken } = generateTokens(newUser);

    // Hash refresh token for DB
    newUser.refresh_token_hash = await bcrypt.hash(refreshToken, 10);
    await newUser.save();

    // Set cookies
    setTokenCookies(res, accessToken, refreshToken);
    
    // Set CSRF Cookie
    const csrfToken = generateToken();
    setCsrfCookie(res, csrfToken);

    return res.status(201).json({
      message: 'Registration successful',
      user: {
        id: newUser._id,
        name: newUser.name,
        college_id: newUser.college_id,
        role: newUser.role,
        college_name: newUser.college_name,
        department: newUser.department,
      },
    });
  } catch (error) {
    console.error('Registration error:', error);
    return res.status(500).json({ error: 'Internal server error during registration' });
  }
};

exports.login = async (req, res) => {
  try {
    const { college_id, email, password, role } = req.body;

    if ((!college_id && !email) || !password || !role) {
      return res.status(400).json({ error: 'College ID or Email, password, and role are required' });
    }

    const user = await User.findOne({
      $or: [
        { college_id: college_id || '' },
        { email: college_id || email || '' }
      ]
    });
    if (!user) {
      return res.status(401).json({ error: 'Invalid College ID or password' });
    }

    if (!user.is_active) {
      return res.status(401).json({ error: 'Account is inactive' });
    }

    // Verify role matches selected role
    if (user.role !== role) {
      return res.status(401).json({ error: 'Incorrect role selected for this account' });
    }

    // Verify password
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid College ID or password' });
    }

    // Generate tokens
    const { accessToken, refreshToken } = generateTokens(user);

    // Save refresh token hash
    user.refresh_token_hash = await bcrypt.hash(refreshToken, 10);
    await user.save();

    // Set cookies
    setTokenCookies(res, accessToken, refreshToken);
    
    // Set CSRF Cookie
    const csrfToken = generateToken();
    setCsrfCookie(res, csrfToken);

    return res.status(200).json({
      message: 'Login successful',
      user: {
        id: user._id,
        name: user.name,
        college_id: user.college_id,
        role: user.role,
        college_name: user.college_name,
        department: user.department,
      },
    });
  } catch (error) {
    console.error('Login error:', error);
    return res.status(500).json({ error: 'Internal server error during login' });
  }
};

exports.logout = async (req, res) => {
  try {
    if (req.user) {
      req.user.refresh_token_hash = null;
      await req.user.save();
    }
    
    res.clearCookie('access_token', { path: '/' });
    res.clearCookie('refresh_token', { path: '/' });
    res.clearCookie('csrf_token', { path: '/' });

    return res.status(200).json({ message: 'Logout successful' });
  } catch (error) {
    console.error('Logout error:', error);
    return res.status(500).json({ error: 'Internal server error during logout' });
  }
};

exports.refresh = async (req, res) => {
  try {
    const refreshToken = req.cookies.refresh_token;
    if (!refreshToken) {
      return res.status(401).json({ error: 'Refresh token missing' });
    }

    const decoded = jwt.verify(refreshToken, settings.JWT_REFRESH_SECRET);
    const user = await User.findById(decoded.userId);

    if (!user || !user.is_active || !user.refresh_token_hash) {
      return res.status(401).json({ error: 'Invalid user session' });
    }

    // Verify refresh token hash
    const isMatch = await bcrypt.compare(refreshToken, user.refresh_token_hash);
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid refresh token' });
    }

    // Generate new access token
    const accessToken = jwt.sign(
      {
        userId: user._id,
        role: user.role,
        college_name: user.college_name,
        department: user.department,
        college_id: user.college_id,
      },
      settings.JWT_SECRET,
      { expiresIn: '15m' }
    );

    // Set new access token cookie
    const isProd = settings.NODE_ENV === 'production';
    res.cookie('access_token', accessToken, {
      httpOnly: true,
      secure: isProd,
      sameSite: 'lax',
      maxAge: 15 * 60 * 1000,
      path: '/',
    });

    return res.status(200).json({ message: 'Token refreshed successfully' });
  } catch (error) {
    console.error('Token refresh error:', error);
    return res.status(401).json({ error: 'Invalid or expired refresh token' });
  }
};

// FIXED: Query user from DB before comparing and hashing to fix Bug #1
exports.changePassword = async (req, res) => {
  try {
    const { oldPassword, newPassword } = req.body;

    if (!oldPassword || !newPassword) {
      return res.status(400).json({ error: 'Old password and new password are required' });
    }

    if (newPassword.length < 8) {
      return res.status(400).json({ error: 'New password must be at least 8 characters long' });
    }

    // Bug #1 Fix: Explicitly fetch user from database first
    const dbUser = await User.findById(req.user._id);
    if (!dbUser) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Compare old password
    const isMatch = await bcrypt.compare(oldPassword, dbUser.password);
    if (!isMatch) {
      return res.status(400).json({ error: 'Incorrect current password' });
    }

    // Hash and save new password
    dbUser.password = await bcrypt.hash(newPassword, 12);
    await dbUser.save();

    return res.status(200).json({ message: 'Password changed successfully' });
  } catch (error) {
    console.error('Change password error:', error);
    return res.status(500).json({ error: 'Internal server error during password change' });
  }
};

exports.getCsrfToken = async (req, res) => {
  try {
    const csrfToken = generateToken();
    setCsrfCookie(res, csrfToken);
    
    const accessToken = req.cookies.access_token || '';
    return res.status(200).json({ csrfToken, accessToken });
  } catch (error) {
    console.error('Get CSRF token error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

exports.me = async (req, res) => {
  try {
    // req.user is attached by authMiddleware
    return res.status(200).json({
      id: req.user._id,
      name: req.user.name,
      college_id: req.user.college_id,
      role: req.user.role,
      college_name: req.user.college_name,
      department: req.user.department,
    });
  } catch (error) {
    console.error('Me endpoint error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};
