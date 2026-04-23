require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const i18next = require('i18next');
const middleware = require('i18next-express-middleware');
const Backend = require('i18next-fs-backend');

const path = require('path');




const app = express();


app.use(cors());
app.use(express.json());

// Connect to MongoDB
mongoose.connect(process.env.MONGO_URI)
    .then(() => console.log('MongoDB connected'))
    .catch(err => console.log(err));
    

// Define routes
app.use('/api/user', require('./routes/user'));
app.use('/api/babysitter', require('./routes/babysitter'));
app.use('/api/admin', require('./routes/admin'));

const PORT = process.env.PORT || 5170;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));

