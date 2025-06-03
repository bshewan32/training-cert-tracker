const mongoose = require('mongoose');
const uri = 'mongokey';

const Certificate = require('./src/models/Certificate'); // adjust path
const Position = require('./src/models/Position');       // adjust path

mongoose.connect(uri, { useNewUrlParser: true, useUnifiedTopology: true });

async function fixCertificates() {
  const certs = await Certificate.find({ position: { $type: 'string' } });

  for (const cert of certs) {
    const pos = await Position.findOne({ title: cert.position });
    if (pos) {
      cert.position = pos._id;
      await cert.save();
      console.log(`Updated certificate ${cert._id} -> position ${pos.title}`);
    } else {
      console.warn(`Could not find position for: "${cert.position}"`);
    }
  }

  mongoose.disconnect();
}

fixCertificates().catch(err => {
  console.error('Error fixing certificates:', err);
  mongoose.disconnect();
});
