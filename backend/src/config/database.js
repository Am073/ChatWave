const mongoose = require('mongoose');
const settings = require('./settings');

const connectToDatabase = async (retries = 3, delay = 1000) => {
  try {
    await mongoose.connect(settings.MONGO_URI);
    console.log('✅ Connected to MongoDB successfully.');
  } catch (error) {
    if (retries > 0) {
      console.warn(`⚠️ Database connection failed. Retrying in ${delay}ms... (Retries left: ${retries})`);
      console.error(error.message);
      await new Promise((resolve) => setTimeout(resolve, delay));
      return connectToDatabase(retries - 1, delay * 2);
    } else {
      console.error('❌ Failed to connect to MongoDB after all retries.');
      process.exit(1);
    }
  }
};

module.exports = connectToDatabase;
