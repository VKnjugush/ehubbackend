require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const path = require('path');

const User = require('./models/user');
const Tournament = require('./models/tournament');
const Subscriber = require('./models/subscriber');
const auth = require('./middleware/auth');

const app = express();

// Middleware
app.use(cors());
app.use(express.json()); // ✅ Ensures req.body is parsed

// ✅ Connect to MongoDB with better options

mongoose.connect(process.env.MONGO_URI)
  .then(() => {
    console.log('✅ MongoDB Connected');
    
    // ✅ Start server only AFTER MongoDB connects
    const port = process.env.PORT || 5000;
    const hostname = '127.0.0.1';

    app.listen(port, () => {
      console.log(`🚀 Server running at http://${hostname}:${port}/`);
      console.log('📡 Waiting for requests...');
    });
  })
  .catch(err => {
    console.error('❌ MongoDB Connection Error:', err);
  });

// ✅ Register Route (wrapped in try/catch)
app.post('/api/register', async (req, res) => {
  try {
    const { email, password } = req.body;
    const existing = await User.findOne({ email });
    if (existing) return res.status(400).json({ message: 'User exists' });

    const hashed = await bcrypt.hash(password, 10);
    const user = new User({ email, password: hashed });
    await user.save();

    res.json({ message: 'Registered' });
  } catch (err) {
    console.error('Registration Error:', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// ✅ Login Route (wrapped in try/catch)
app.post('/api/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });
    if (!user || !(await bcrypt.compare(password, user.password)))
      return res.status(400).json({ message: 'Invalid credentials' });

    const token = jwt.sign(
      { id: user._id, email: user.email },
      process.env.JWT_SECRET
    );
    res.json({ token });
  } catch (err) {
    console.error('Login Error:', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// ✅ Create Tournament (auth + try/catch)
app.post('/api/tournaments', auth, async (req, res) => {
  try {
    const { name, description } = req.body;
    const tournament = new Tournament({
      name,
      description,
      createdBy: req.user.id,
      participants: [req.user.id]
    });
    await tournament.save();
    res.json(tournament);
  } catch (err) {
    console.error('Create Tournament Error:', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// ✅ Get All Tournaments
app.get('/api/tournaments', async (req, res) => {
  try {
    const tournaments = await Tournament.find()
      .populate('createdBy', 'email')
      .populate('participants', 'email');
    res.json(tournaments);
  } catch (err) {
    console.error('List Tournaments Error:', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// ✅ Join Tournament (auth + try/catch)
app.post('/api/tournaments/:id/join', auth, async (req, res) => {
  try {
    const tournament = await Tournament.findById(req.params.id);
    if (!tournament) return res.status(404).json({ message: 'Not found' });

    if (!tournament.participants.includes(req.user.id)) {
      tournament.participants.push(req.user.id);
      await tournament.save();
    }

    res.json(tournament);
  } catch (err) {
    console.error('Join Tournament Error:', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// ✅ Subscribe to Newsletter (already good but added logging)
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
    console.error('Subscription error:', err);
    res.status(500).json({ message: 'Subscription failed. Please try again.', error: err.message });
  }
});

app.get('/subscribe', (req, res) => {
  res.send('Subscribe endpoint: Please use POST to /api/subscribe with your email.');
});

// ✅ Serve static frontend in production
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, '../client/build')));
  app.get('*', (req, res) => {
    res.sendFile(path.resolve(__dirname, '../client/build', 'index.html'));
  });
}

// Root endpoint
app.get('/', (req, res) => {
  res.send('Welcome to the eHub API');
});

// ✅ Fallback error handler (MUST BE LAST)
app.use((err, req, res, next) => {
  console.error('🔥 Uncaught Server Error:', err);
  res.status(500).json({ message: 'Internal Server Error', error: err.message });
});

// ✅ PORT fallback
const port = process.env.PORT || 5000;
const hostname = '127.0.0.1';

