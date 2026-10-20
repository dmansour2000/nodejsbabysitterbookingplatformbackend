const mongoose = require('mongoose');
require('dotenv').config();
const bcrypt = require('bcryptjs');
const User = require('./models/User'); // Adjust the path as necessary

async function createSuperUser() {
    await mongoose.connect(process.env.MONGO_URI);

    const username = 'superadmin';
    const password = 'SuperSecretPassword123';
    const role = 'admin';
    const isSuperUser = true; // Custom flag for super user

    let user = await User.findOne({ username });
    if (user) {
        console.log('Super user already exists');
        return;
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    user = new User({
        username,
        password: hashedPassword,
        role,
        isSuperUser
    });

    await user.save();
    console.log('Super user created:', username);
    mongoose.connection.close();
}

createSuperUser().catch(err => console.error(err));