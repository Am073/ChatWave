const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('./src/models/User.model');
const settings = require('./src/config/settings');

const seedUsers = async () => {
  try {
    // Connect to database
    await mongoose.connect(settings.MONGO_URI);
    console.log('Connected to MongoDB for seeding...');

    // Remove existing seed users completely
    const targetIds = ['ADMIN001', 'FACULTY001', 'STUDENT001', 'CW-ADMIN', 'CW-FACULTY', 'CW-STUDENT'];
    const deleteResult = await User.deleteMany({ college_id: { $in: targetIds } });
    console.log(`Removed ${deleteResult.deletedCount} existing seed users from database.`);

    // Hash password
    const hashedPassword = await bcrypt.hash('Password@123', 12);

    const users = [
      {
        name: 'ChatWave Admin',
        college_id: 'CW-ADMIN',
        email: 'admin@chatwave.edu',
        username: 'cw-admin',
        password: hashedPassword,
        role: 'admin',
        college_name: 'ChatWave College',
        department: null,
        is_active: true
      },
      {
        name: 'Dr. Rajesh Kumar',
        college_id: 'CW-FACULTY',
        email: 'rajesh@chatwave.edu',
        username: 'cw-faculty',
        password: hashedPassword,
        role: 'faculty',
        college_name: 'ChatWave College',
        department: 'Computer Science',
        is_active: true
      },
      {
        name: 'Aarav Sharma',
        college_id: 'CW-STUDENT',
        email: 'aarav@chatwave.edu',
        username: 'cw-student',
        password: hashedPassword,
        role: 'student',
        college_name: 'ChatWave College',
        department: 'Computer Science',
        is_active: true
      }
    ];

    for (const userData of users) {
      await User.create(userData);
      console.log(`Seeded user: ${userData.name} (${userData.role}) with ID: ${userData.college_id}`);
    }

    console.log('Seeding completed successfully!');
  } catch (error) {
    console.error('Error seeding database:', error);
  } finally {
    await mongoose.connection.close();
    console.log('Database connection closed.');
  }
};

if (require.main === module) {
  seedUsers();
}

module.exports = seedUsers;
