const mongoose = require("mongoose");

const careerSchema = new mongoose.Schema({
   name: String,
   imageUrl: String,
   description: String,
   isDeleted: { type: Boolean, default: false },
   reactions: {
      r1: { type: Number, default: 0 },
      r2: { type: Number, default: 0 },
      r3: { type: Number, default: 0 },
      r4: { type: Number, default: 0 },
      r5: { type: Number, default: 0 },
   },   
},
{ timestamps: true });

module.exports = mongoose.model("Career", careerSchema);