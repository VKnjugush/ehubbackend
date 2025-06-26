require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('./models/user');
const Tournament = require('./models/tournament');
const Subscriber = require('./models/subscriber');
const auth = require('./middleware/auth');
const path = require('path');

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Connect to MongoDB
mongoose.connect(process.env.MONGO_URI)
.then(() => console.log('MongoDB Connected'))
.catch(err => console.error('MongoDB Connection Error:', err));

// Register
app.post('/api/register', async (req, res) => {
  const { email, password } = req.body;
  const existing = await User.findOne({ email });
  if (existing) return res.status(400).json({ message: 'User exists' });
  const hashed = await bcrypt.hash(password, 10);
  const user = new User({ email, password: hashed });
  await user.save();
  res.json({ message: 'Registered' });
});

// Login
app.post('/api/login', async (req, res) => {
  const { email, password } = req.body;
  const user = await User.findOne({ email });
  if (!user || !(await bcrypt.compare(password, user.password)))
    return res.status(400).json({ message: 'Invalid credentials' });
  const token = jwt.sign({ id: user._id, email: user.email }, process.env.JWT_SECRET);
  res.json({ token });
});

// Create Tournament (auth required)
app.post('/api/tournaments', auth, async (req, res) => {
  const { name, description } = req.body;
  const tournament = new Tournament({
    name,
    description,
    createdBy: req.user.id,
    participants: [req.user.id]
  });
  await tournament.save();
  res.json(tournament);
});

// List Tournaments
app.get('/api/tournaments', async (req, res) => {
  const tournaments = await Tournament.find().populate('createdBy', 'email').populate('participants', 'email');
  res.json(tournaments);
});

// Join Tournament (auth required)
app.post('/api/tournaments/:id/join', auth, async (req, res) => {
  const tournament = await Tournament.findById(req.params.id);
  if (!tournament) return res.status(404).json({ message: 'Not found' });
  if (!tournament.participants.includes(req.user.id)) {
    tournament.participants.push(req.user.id);
    await tournament.save();
  }
  res.json(tournament);
});

// Subscribe to newsletter
app.post('/api/subscribe', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ message: 'Email is required' });

    const existing = await Subscriber.findOne({ email });
    if (existing) return res.status(400).json({ message: 'Email already subscribed' });

    const subscriber = new Subscriber({ email });
    await subscriber.save();
    res.status(201).json({ message: 'Subscribed successfully!' });
  } catch (err) {
    // Add this for better debugging:
    if (err.name === 'ValidationError') {
      return res.status(400).json({ message: err.message });
    }
    if (err.code === 11000) {
      return res.status(400).json({ message: 'Email already subscribed' });
    }
    console.error('Subscription error:', err);
    res.status(500).json({ message: 'Subscription failed. Please try again.', error: err.message });
  }
});

// Serve static assets if in production
if (process.env.NODE_ENV === 'production') {
    // Set static folder
    app.use(express.static(path.join(__dirname, '../client/build')));

    app.get('*', (req, res) => {
        res.sendFile(path.resolve(__dirname, '../client/build', 'index.html'));
    });
}

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));