const express = require('express');
const app = express();
const cors = require('cors');

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Import routes
const authRoutes = require('./routes/auth'); // Your existing auth routes
const testRoutes = require('./routes/test'); // Your existing test/students routes
const clientRoutes = require('./routes/clients'); // NEW - Client routes

// Use routes
app.use('/api', authRoutes);
app.use('/api', testRoutes);
app.use('/api', clientRoutes); // NEW - Add this line

// Start server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});