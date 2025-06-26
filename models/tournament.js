const mongoose = require('mongoose');
const TournamentSchema = new mongoose.Schema({
  name: String,
  description: String,
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  participants: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }]
});
module.exports = mongoose.model('Tournament', TournamentSchema);