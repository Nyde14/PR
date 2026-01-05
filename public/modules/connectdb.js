const mongoose = require('mongoose');
require('dotenv').config();

const ConnectDB = async () => {
    try{
        if (!process.env.MONGODB_URI) {
            console.warn('MONGODB_URI is not set — check your .env or environment variables');
        }
        const dbName = process.env.MONGODB_DB || 'main';
        if (!process.env.MONGODB_DB) {
            console.warn(`MONGODB_DB not set — defaulting to '${dbName}'`);
        }
        await mongoose.connect(process.env.MONGODB_URI, { dbName });
        console.log("successfully connected to database");
        // Connection diagnostics
        console.log('Mongo connection:', {
            host: mongoose.connection.host,
            port: mongoose.connection.port,
            name: mongoose.connection.name,
            readyState: mongoose.connection.readyState,
            dbName
        });
    }
    catch(e){
        console.error("error connecting to database: " + e.message)
    }
}
module.exports = ConnectDB;