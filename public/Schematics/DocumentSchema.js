const mongoose = require('mongoose');

const documentSubmissionSchema = new mongoose.Schema({
    clubName: { 
        type: String, 
        required: true,
        index: true // Optimized for the Dashboard lookup
    },
    fileName: { 
        type: String, 
        required: true 
    },
    fileUrl: { 
        type: String, 
        required: true 
    },
    purpose: { 
        type: String, 
        required: true,
        trim: true 
    },
    status: { 
        type: String, 
        enum: ['pending', 'approved', 'rejected'], 
        default: 'pending',
        index: true 
    },
    // Tracking the specific user who uploaded it
    submittedBy: { 
        type: String, 
        required: true 
    },
    uploaderRole: { 
        type: String, 
        required: true 
    },
    // Admin feedback and e-signature tracking
    adminFeedback: { 
        type: String, 
        default: "" 
    },
    resolvedBy: { 
        type: String, 
        default: null 
    },
    resolvedAt: { 
        type: Date, 
        default: null 
    },
    // New feature: Link to the "signed" version of the file
    signedFileUrl: { 
        type: String, 
        default: null 
    }
}, { timestamps: true }); // Automatically adds createdAt and updatedAt

module.exports = mongoose.model('DocumentSubmission', documentSubmissionSchema);