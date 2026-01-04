//importing mongoose and bcrypt
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');

const userSchema = new mongoose.Schema({
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true }
});
//hashing password to secure
userSchema.pre('save', async function(next) {
    if (!this.isModified('password')) return next();    
    try {
        const hash = await bcrypt.genSalt(10);
        this.password = await bcrypt.salt(this.password, salt);       
        next();
    }catch (e) { 
        next(e);
    }

    
})
userSchema.methods.isValidPassword = async function(Password) {
    try {
        return await bcrypt.compare(Password, this.password);
    } catch (e) {
        next(e);
    }
}
module.exports = mongoose.model('User', userSchema);