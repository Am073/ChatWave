const User = require('../models/User.model');
const Document = require('../models/Document.model');
const ChatLog = require('../models/ChatLog.model');
const Announcement = require('../models/Announcement.model');
const qdrantProvider = require('../providers/qdrant.provider');
const settings = require('../config/settings');
const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');

exports.getStats = async (req, res) => {
  try {
    const college_name = req.user.college_name;

    const [
      totalUsers,
      totalDocuments,
      totalChats,
      documentsProcessing,
      documentsFailed
    ] = await Promise.all([
      User.countDocuments({ college_name }),
      Document.countDocuments({ college_name }),
      ChatLog.countDocuments({ college_name }),
      Document.countDocuments({ college_name, status: 'processing' }),
      Document.countDocuments({ college_name, status: 'failed' })
    ]);

    return res.status(200).json({
      totalUsers,
      totalDocuments,
      totalChats,
      documentsProcessing,
      documentsFailed
    });
  } catch (error) {
    console.error('Get admin stats error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

exports.getUsers = async (req, res) => {
  try {
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 20;
    const college_name = req.user.college_name;

    const query = { college_name };
    const total = await User.countDocuments(query);
    const users = await User.find(query)
      .select('-password')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit);

    return res.status(200).json({
      total,
      page,
      limit,
      users
    });
  } catch (error) {
    console.error('Get admin users error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

exports.createUser = async (req, res) => {
  try {
    const { name, college_id, password, role, department } = req.body;

    if (!name || !college_id || !password || !role) {
      return res.status(400).json({ error: 'Name, College ID, password, and role are required' });
    }

    const college_name = req.user.college_name; // Multi-tenant override

    const existingUser = await User.findOne({ college_id });
    if (existingUser) {
      return res.status(400).json({ error: 'User with this College ID already exists' });
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    const newUser = new User({
      name,
      college_id,
      password: hashedPassword,
      role,
      college_name,
      department: department || null,
      username: college_id,
      email: `${college_id.toLowerCase()}@chatwave.edu`,
      is_active: true
    });

    await newUser.save();

    return res.status(201).json({
      message: 'User created successfully',
      user: {
        id: newUser._id,
        name: newUser.name,
        college_id: newUser.college_id,
        role: newUser.role,
        college_name: newUser.college_name,
        department: newUser.department
      }
    });
  } catch (error) {
    console.error('Create user admin error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

exports.updateUser = async (req, res) => {
  try {
    const { id } = req.params;
    const { role, is_active, department } = req.body;

    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Multi-tenant check
    if (user.college_name !== req.user.college_name) {
      return res.status(403).json({ error: 'Access denied' });
    }

    if (role !== undefined) user.role = role;
    if (is_active !== undefined) user.is_active = is_active;
    if (department !== undefined) user.department = department || null;

    await user.save();

    return res.status(200).json({
      message: 'User updated successfully',
      user: {
        id: user._id,
        name: user.name,
        college_id: user.college_id,
        role: user.role,
        college_name: user.college_name,
        department: user.department,
        is_active: user.is_active
      }
    });
  } catch (error) {
    console.error('Update user admin error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

exports.deleteUser = async (req, res) => {
  try {
    const { id } = req.params;
    const user = await User.findById(id);

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Multi-tenant check
    if (user.college_name !== req.user.college_name) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Soft delete user
    user.is_active = false;
    await user.save();

    return res.status(200).json({ message: 'User soft deleted successfully (deactivated)' });
  } catch (error) {
    console.error('Delete user admin error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

exports.getDocuments = async (req, res) => {
  try {
    const docs = await Document.find({ college_name: req.user.college_name })
      .populate('uploader', 'name role')
      .sort({ createdAt: -1 });

    return res.status(200).json(docs);
  } catch (error) {
    console.error('Admin get documents error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

exports.deleteDocument = async (req, res) => {
  try {
    const { id } = req.params;
    const doc = await Document.findById(id);

    if (!doc) {
      return res.status(404).json({ error: 'Document not found' });
    }

    // Multi-tenant check
    if (doc.college_name !== req.user.college_name) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Force remove vectors
    try {
      await qdrantProvider.deleteByDocumentId(doc.college_name, doc._id.toString());
    } catch (qdrantError) {
      console.error(`Failed to remove vectors for document ${id} from Qdrant:`, qdrantError.message);
    }

    await Document.findByIdAndDelete(id);

    return res.status(200).json({ message: 'Document and vectors force deleted successfully' });
  } catch (error) {
    console.error('Admin delete document error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

exports.triggerSeed = async (req, res) => {
  try {
    if (settings.NODE_ENV === 'production') {
      return res.status(403).json({ error: 'Seeding is disabled in production' });
    }

    const seedUsers = require('../../seed');
    await seedUsers();

    return res.status(200).json({ message: 'Database seeded successfully' });
  } catch (error) {
    console.error('Admin seed trigger error:', error);
    return res.status(500).json({ error: 'Failed to seed database' });
  }
};

exports.getActivity = async (req, res) => {
  try {
    const college_name = req.user.college_name;
    const limit = parseInt(req.query.limit, 10) || 20;

    const [docs, announcements, chats] = await Promise.all([
      Document.find({ college_name }).sort({ createdAt: -1 }).limit(limit).populate('uploader', 'name'),
      Announcement.find({ college_name }).sort({ createdAt: -1 }).limit(limit).populate('author', 'name'),
      ChatLog.find({ college_name }).sort({ createdAt: -1 }).limit(limit).populate('user', 'name')
    ]);

    const activities = [];

    docs.forEach(d => {
      activities.push({
        id: d._id,
        type: 'upload',
        description: `Document "${d.filename}" was uploaded by ${d.uploader?.name || 'Unknown'}`,
        timestamp: d.createdAt,
        user: d.uploader?.name || 'Unknown'
      });
    });

    announcements.forEach(a => {
      activities.push({
        id: a._id,
        type: 'announcement',
        description: `Announcement "${a.title}" was posted by ${a.author?.name || 'Unknown'}`,
        timestamp: a.createdAt,
        user: a.author?.name || 'Unknown'
      });
    });

    chats.forEach(c => {
      activities.push({
        id: c._id,
        type: 'chat',
        description: `User ${c.user?.name || 'Unknown'} asked: "${c.question.substring(0, 60)}${c.question.length > 60 ? '...' : ''}"`,
        timestamp: c.createdAt,
        user: c.user?.name || 'Unknown'
      });
    });

    // Sort by timestamp descending
    activities.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    return res.status(200).json({
      activities: activities.slice(0, limit)
    });
  } catch (error) {
    console.error('Get admin activity error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

exports.getHealth = async (req, res) => {
  try {
    const mongoStatus = mongoose.connection.readyState === 1 ? 'operational' : 'degraded';
    
    // Qdrant health check
    let qdrantStatus = 'operational';
    try {
      if (process.env.NODE_ENV !== 'test') {
        await qdrantProvider.client.getCollections();
      }
    } catch (e) {
      qdrantStatus = 'degraded';
    }

    const geminiStatus = settings.GEMINI_API_KEY ? 'operational' : 'degraded';

    const healthData = {
      overall: (mongoStatus === 'operational' && qdrantStatus === 'operational' && geminiStatus === 'operational') ? 'operational' : 'degraded',
      services: {
        mongodb: { status: mongoStatus, uptime: mongoStatus === 'operational' ? 100 : 0 },
        vector_db: { status: qdrantStatus, uptime: qdrantStatus === 'operational' ? 100 : 0 },
        llm: { status: geminiStatus, uptime: geminiStatus === 'operational' ? 100 : 0 },
        websocket: { status: 'operational', uptime: 100 },
        google_calendar: { status: 'operational', uptime: 100 }
      }
    };

    return res.status(200).json(healthData);
  } catch (error) {
    console.error('Get admin health error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};
