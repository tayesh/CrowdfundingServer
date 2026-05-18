import mongoose from 'mongoose';

const successStorySchema = new mongoose.Schema({
    title: {
        type: String,
        required: true
    },
    category: {
        type: String,
        required: true
    },
    raised: {
        type: String,
        required: true
    },
    backers: {
        type: String,
        required: true
    },
    image: {
        type: String,
        required: true
    },
    quote: {
        type: String,
        required: true
    },
    author: {
        type: String,
        required: true
    },
    role: {
        type: String,
        required: true
    }
}, { timestamps: true });

const SuccessStory = mongoose.model('SuccessStory', successStorySchema);
export default SuccessStory;
