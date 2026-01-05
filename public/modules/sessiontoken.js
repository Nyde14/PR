const jwt = require('jsonwebtoken');

const TokenValid = (req, res, next) =>{
    const Token = req.session.token || req.headers['authorization']?.split(' ')[1];

    if(!Token){
        return res.status(401).json({message:"Token Expired please log in again"})

    }
    try{
        const decoded = jwt.verify(Token, process.env.JWT_SECRET);
        req.user = decoded;
        next();
    }
    catch(e){
        res.status(403).json({message:"invalid token"});
    }
}
module.exports = TokenValid;