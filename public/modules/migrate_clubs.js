/*
  Run this once (e.g., `node public/modules/migrate_clubs.js`) to migrate old `club` string fields
  into Club documents and fill `clubs` arrays on users.
  This script will not run automatically from server; run manually when ready.
*/

const mongoose = require('mongoose');
const ConnectDB = require('./connectdb');
const User = require('./UserSchema');
const Club = require('./ClubSchema');

(async function migrate(){
  try{
    await ConnectDB();
    const users = await User.find({ club: { $exists: true, $ne: '' } });
    console.log('Found', users.length, 'users with legacy club string');
    let created = 0, updated = 0;
    for (const user of users){
      const clubName = user.club.trim();
      if(!clubName) continue;
      let club = await Club.findOne({ name: clubName });
      if(!club){
        club = new Club({ name: clubName, description: '', members: [user._id] });
        await club.save();
        created++;
      } else {
        if(!club.members.some(m => String(m) === String(user._id))){
          club.members.push(user._id);
          await club.save();
        }
      }
      if(!user.clubs || !user.clubs.some(c => String(c) === String(club._id))){
        user.clubs = user.clubs || [];
        user.clubs.push(club._id);
        await user.save();
        updated++;
      }
    }
    console.log('Migration complete:', { created, updated });
    process.exit(0);
  } catch(e){
    console.error('Migration failed', e);
    process.exit(1);
  }
})();