const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const Achiever = require('./models/Achiever');
const Event = require('./models/Event');
const Career = require('./models/Career');

const TARGET_ID = '6799f9776f8074906d4e24eb';

async function check() {
    try {
        console.log('Connecting to:', process.env.MONGO_URI.split('@')[1] || 'URL');
        await mongoose.connect(process.env.MONGO_URI);
        console.log('Connected.');

        console.log(`\nChecking for ID: ${TARGET_ID}`);

        const achiever = await Achiever.findById(TARGET_ID);
        console.log('Achiever Found:', achiever ? `YES (Deleted: ${achiever.isDeleted}, Status: ${achiever.status})` : 'NO');
        if (achiever) console.log('Achiever Name:', achiever.name);

        const event = await Event.findById(TARGET_ID);
        console.log('Event Found:', event ? `YES (Deleted: ${event.isDeleted})` : 'NO');

        const career = await Career.findById(TARGET_ID);
        console.log('Career Found:', career ? `YES (Deleted: ${career.isDeleted})` : 'NO');

    } catch (err) {
        console.error('Error:', err);
    } finally {
        await mongoose.connection.close();
    }
}

check();
