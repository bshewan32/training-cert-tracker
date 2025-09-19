const mongoose = require("mongoose");

const UserTokenSchema = new mongoose.Schema({
  // Link back to your User model
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, unique: true },

  // Minimal MSAL fields
  account: {
    homeAccountId: String,
    environment: String,
    tenantId: String,
    username: String,
  },

  refreshToken: { type: String, required: true },
  scopes: [String],
  expiresOn: Date,
}, { timestamps: true });

module.exports = mongoose.model("UserToken", UserTokenSchema);
