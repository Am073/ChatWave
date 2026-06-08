const crypto = require('crypto');
const UserGoogleToken = require('../models/UserGoogleToken.model');
const CalendarEvent = require('../models/CalendarEvent.model');
const settings = require('../config/settings');

// Encryption Helpers using built-in crypto
const ALGORITHM = 'aes-256-cbc';
const ENCRYPTION_KEY = crypto.scryptSync(settings.JWT_SECRET, 'salt', 32);

const encrypt = (text) => {
  if (!text) return null;
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(ALGORITHM, ENCRYPTION_KEY, iv);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return iv.toString('hex') + ':' + encrypted;
};

const decrypt = (encryptedText) => {
  if (!encryptedText) return null;
  const textParts = encryptedText.split(':');
  const iv = Buffer.from(textParts.shift(), 'hex');
  const encrypted = Buffer.from(textParts.join(':'), 'hex');
  const decipher = crypto.createDecipheriv(ALGORITHM, ENCRYPTION_KEY, iv);
  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
};

// GET /api/calendar/auth
exports.getAuthUrl = async (req, res) => {
  try {
    const scope = 'https://www.googleapis.com/auth/calendar.events';
    const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?` + 
      `client_id=${encodeURIComponent(settings.GOOGLE_CLIENT_ID)}` +
      `&redirect_uri=${encodeURIComponent(settings.GOOGLE_REDIRECT_URI)}` +
      `&response_type=code` +
      `&scope=${encodeURIComponent(scope)}` +
      `&access_type=offline` +
      `&prompt=consent` +
      `&state=${req.user._id.toString()}`; // pass user ID in state for verification fallback

    return res.status(200).json({ url: authUrl });
  } catch (error) {
    console.error('Google Auth URL generation failed:', error);
    return res.status(500).json({ error: 'Failed to initiate Google Calendar authentication' });
  }
};

// GET /api/calendar/callback
exports.oauthCallback = async (req, res) => {
  try {
    const { code, state } = req.query;

    if (!code) {
      return res.status(400).send('Authorization code missing');
    }

    // Google Calendar OAuth callback
    // Exchange auth code for token
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        code,
        client_id: settings.GOOGLE_CLIENT_ID,
        client_secret: settings.GOOGLE_CLIENT_SECRET,
        redirect_uri: settings.GOOGLE_REDIRECT_URI,
        grant_type: 'authorization_code',
      }),
    });

    const tokenData = await tokenResponse.json();

    if (tokenData.error) {
      console.error('Google token exchange error:', tokenData);
      return res.status(400).send(`Token exchange failed: ${tokenData.error_description}`);
    }

    // Determine user ID (prioritize cookie auth req.user, fallback to state parameter)
    const userId = req.user?._id || state;
    if (!userId) {
      return res.status(401).send('Unauthorized session during OAuth callback');
    }

    // Encrypt and store tokens
    const accessTokenEncrypted = encrypt(tokenData.access_token);
    const refreshTokenEncrypted = tokenData.refresh_token ? encrypt(tokenData.refresh_token) : null;
    const expiresAt = new Date(Date.now() + tokenData.expires_in * 1000);

    // Save/Update in DB
    const updateData = {
      access_token: accessTokenEncrypted,
      expires_at: expiresAt,
    };
    if (refreshTokenEncrypted) {
      updateData.refresh_token = refreshTokenEncrypted;
    }

    await UserGoogleToken.findOneAndUpdate(
      { user: userId },
      updateData,
      { upsert: true, new: true }
    );

    // Redirect to settings page in the frontend
    return res.redirect(`${settings.FRONTEND_URL}/student?googleCalendarConnected=true`);
  } catch (error) {
    console.error('OAuth Callback processing error:', error);
    return res.status(500).send('OAuth callback internal server error');
  }
};

// POST /api/calendar/sync
exports.syncEvent = async (req, res) => {
  try {
    const { eventId } = req.body;
    if (!eventId) {
      return res.status(400).json({ error: 'eventId is required' });
    }

    const event = await CalendarEvent.findOne({ _id: eventId, user: req.user._id });
    if (!event) {
      return res.status(404).json({ error: 'Event not found or unauthorized' });
    }

    const userToken = await UserGoogleToken.findOne({ user: req.user._id });
    if (!userToken) {
      return res.status(400).json({ error: 'Google Calendar is not connected. Connect it first.' });
    }

    let accessToken = decrypt(userToken.access_token);

    // Check if token is expired
    if (new Date() >= new Date(userToken.expires_at)) {
      if (!userToken.refresh_token) {
        return res.status(400).json({ error: 'Access token expired and no refresh token available. Reconnect Calendar.' });
      }

      console.log('Refreshing Google access token...');
      const refreshResponse = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          client_id: settings.GOOGLE_CLIENT_ID,
          client_secret: settings.GOOGLE_CLIENT_SECRET,
          refresh_token: decrypt(userToken.refresh_token),
          grant_type: 'refresh_token',
        }),
      });

      const refreshData = await refreshResponse.json();

      if (refreshData.error) {
        console.error('Refresh token failed:', refreshData);
        return res.status(400).json({ error: 'Failed to refresh Google token. Reconnect Calendar.' });
      }

      accessToken = refreshData.access_token;
      userToken.access_token = encrypt(accessToken);
      userToken.expires_at = new Date(Date.now() + refreshData.expires_in * 1000);
      await userToken.save();
    }

    // Push event to Google Calendar API
    const googleEventPayload = {
      summary: event.title,
      description: event.event_description || 'Synced from ChatWave chatbot',
      start: {
        dateTime: event.start_time.toISOString(),
        timeZone: 'UTC',
      },
      end: {
        dateTime: event.end_time ? event.end_time.toISOString() : new Date(event.start_time.getTime() + 60*60*1000).toISOString(),
        timeZone: 'UTC',
      },
    };

    const gcalResponse = await fetch('https://www.googleapis.com/calendar/v3/calendars/primary/events', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(googleEventPayload),
    });

    const gcalData = await gcalResponse.json();

    if (gcalData.error) {
      console.error('Google Calendar event creation failed:', gcalData.error);
      return res.status(400).json({ error: `Sync failed: ${gcalData.error.message}` });
    }

    // Save Google Event ID in local DB record
    event.google_event_id = gcalData.id;
    await event.save();

    return res.status(200).json({
      message: 'Event synced to Google Calendar successfully',
      googleEventId: gcalData.id,
      event,
    });
  } catch (error) {
    console.error('Sync event error:', error);
    return res.status(500).json({ error: 'Internal server error during sync' });
  }
};

// GET /api/calendar/events
exports.getEvents = async (req, res) => {
  try {
    const list = await CalendarEvent.find({ user: req.user._id }).sort({ start_time: 1 });
    return res.status(200).json(list);
  } catch (error) {
    console.error('Get calendar events error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

// GET /api/calendar/status
exports.getStatus = async (req, res) => {
  try {
    const token = await UserGoogleToken.findOne({ user: req.user._id });
    return res.status(200).json({
      connected: !!token,
    });
  } catch (error) {
    console.error('Get calendar status error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};
