const Announcement = require('../models/Announcement.model');

exports.createAnnouncement = async (req, res) => {
  try {
    const { title, content, category, is_private, department } = req.body;

    if (!content || !content.trim()) {
      return res.status(400).json({ error: 'Content is required' });
    }

    // Bug #6 Isolation Check: if is_private is true, department is required
    if (is_private && (!department || !department.trim())) {
      return res.status(400).json({ error: 'Department is required for private announcements' });
    }

    const scope = is_private ? 'department' : 'college_wide';
    const finalDepartment = is_private ? department.trim() : null;

    const announcement = new Announcement({
      author: req.user._id,
      college_name: req.user.college_name,
      department: finalDepartment,
      title: title || '',
      content: content.trim(),
      category: category || 'notice',
      scope,
      is_private: !!is_private,
      read_by: []
    });

    await announcement.save();

    return res.status(201).json(announcement);
  } catch (error) {
    console.error('Create announcement error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

exports.getAnnouncements = async (req, res) => {
  try {
    // Fixed Scope: College-wide (department: null) OR department-specific for user's department (Fixes Bug #6)
    const query = {
      college_name: req.user.college_name,
      $or: [
        { department: null },
        { department: req.user.department }
      ]
    };

    const list = await Announcement.find(query)
      .populate('author', 'name role')
      .sort({ createdAt: -1 });

    return res.status(200).json(list);
  } catch (error) {
    console.error('Get announcements error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

exports.markAsRead = async (req, res) => {
  try {
    const { id } = req.params;
    const announcement = await Announcement.findById(id);

    if (!announcement) {
      return res.status(404).json({ error: 'Announcement not found' });
    }

    // Multi-tenant check
    if (announcement.college_name !== req.user.college_name) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Push user ID to read_by list if not already present
    if (!announcement.read_by.includes(req.user._id)) {
      announcement.read_by.push(req.user._id);
      await announcement.save();
    }

    return res.status(200).json({ message: 'Announcement marked as read' });
  } catch (error) {
    console.error('Mark announcement read error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

exports.deleteAnnouncement = async (req, res) => {
  try {
    const { id } = req.params;
    const announcement = await Announcement.findById(id);

    if (!announcement) {
      return res.status(404).json({ error: 'Announcement not found' });
    }

    // Multi-tenant check
    if (announcement.college_name !== req.user.college_name) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Author or admin only
    if (req.user.role !== 'admin' && announcement.author.toString() !== req.user._id.toString()) {
      return res.status(403).json({ error: 'Access denied: insufficient permissions' });
    }

    await Announcement.findByIdAndDelete(id);

    return res.status(200).json({ message: 'Announcement deleted successfully' });
  } catch (error) {
    console.error('Delete announcement error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};
