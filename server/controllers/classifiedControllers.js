const Classified = require('../models/Classified');

// Create Classified
exports.createClassified = async (req, res) => {
    console.log("[Classified] CREATE - Body:", JSON.stringify(req.body));
    try {
        const { 
            title, 
            description, 
            category, 
            price, 
            postedBy, 
            itemImage, 
            photos = [], 
            viewableBy = [], 
            expiryDate, 
            isAd = false 
        } = req.body;

        if (!title || !category || !postedBy?.username || !postedBy?.email || !expiryDate) {
            console.log("[Classified] CREATE - Missing required fields");
            return res.status(400).json({ message: 'Missing required fields' });
        }

        // Make sure the poster can always view their own classified
        if (!viewableBy.includes(postedBy.email)) {
            viewableBy.push(postedBy.email);
        }

        const classified = new Classified({
            title,
            description,
            category,
            price,
            postedBy,
            itemImage,
            photos,
            viewableBy,
            expiryDate,
            isAd
        });

        await classified.save();
        console.log(`[Classified] CREATE - Created classified with id: ${classified._id}`);
        
        // Emit socket event to notify viewers
        const io = req.app.get('io');
        if (io) {
            io.emit('classified-created', classified);
            console.log(`[Classified] CREATE - Socket notification sent for new classified: ${classified._id}, visible to ${viewableBy.length} users`);
        } else {
            console.log(`[Classified] CREATE - Socket io not available, skipping notifications`);
        }
        
        res.status(201).json({ message: 'Classified created successfully', classified });
    } catch (error) {
        console.error('[Classified] CREATE - Error:', error);
        res.status(500).json({ message: 'Error creating classified', error: error.message });
    }
};

// Get Classifieds (with filter and search)
exports.getClassifieds = async (req, res) => {
    console.log("[Classified] GET ALL - Query:", JSON.stringify(req.query));
    try {
        const { category, search, page = 1, limit = 10, userEmail } = req.query;
        const query = {};

        if (!userEmail) {
            console.log("[Classified] GET ALL - Missing userEmail");
            return res.status(400).json({ message: 'User email is required to view classifieds' });
        }

        // Add visibility filter - show only classifieds viewable by this user
        query.$or = [
            { viewableBy: { $in: [userEmail] } },
            { 'postedBy.email': userEmail }
        ];

        if (category) {
            query.category = category;
        }

        if (search) {
            query.title = { $regex: search, $options: 'i' }; // case-insensitive search
        }

        // Only show non-expired classifieds
        query.expiryDate = { $gte: new Date() };

        console.log("[Classified] GET ALL - Mongo Query:", JSON.stringify(query));
        const classifieds = await Classified.find(query)
            .sort({ createdAt: -1 })
            .limit(parseInt(limit))
            .skip((page - 1) * parseInt(limit))
            .exec();

        const count = await Classified.countDocuments(query);
        console.log(`[Classified] GET ALL - Found ${classifieds.length} classifieds, total: ${count}`);

        res.status(200).json({
            classifieds,
            totalPages: Math.ceil(count / limit),
            currentPage: Number(page),
            totalClassifieds: count
        });
    } catch (error) {
        console.error('[Classified] GET ALL - Error:', error);
        res.status(500).json({ message: 'Error fetching classifieds', error: error.message });
    }
};

// View Single Classified
exports.getClassifiedById = async (req, res) => {
    console.log("[Classified] GET BY ID - Params:", JSON.stringify(req.params), "Query:", JSON.stringify(req.query));
    try {
        const { id } = req.params;
        const { userEmail } = req.query;

        if (!userEmail) {
            console.log("[Classified] GET BY ID - Missing userEmail");
            return res.status(400).json({ message: 'User email is required to view classified' });
        }

        const classified = await Classified.findById(id);

        if (!classified) {
            console.log(`[Classified] GET BY ID - Not found: ${id}`);
            return res.status(404).json({ message: 'Classified not found' });
        }

        // Check if user has permission to view this classified
        if (!classified.viewableBy.includes(userEmail) && classified.postedBy.email !== userEmail) {
            console.log(`[Classified] GET BY ID - Access denied for user: ${userEmail}, classified id: ${id}`);
            return res.status(403).json({ message: 'You do not have permission to view this classified' });
        }

        console.log(`[Classified] GET BY ID - Success for user: ${userEmail}, classified id: ${id}`);
        res.status(200).json({ classified });
    } catch (error) {
        console.error('[Classified] GET BY ID - Error:', error);
        res.status(500).json({ message: 'Error fetching classified', error: error.message });
    }
};

// Get classifieds posted by a specific user
exports.getClassifiedsByUser = async (req, res) => {
    console.log("[Classified] GET BY USER - Params:", JSON.stringify(req.params), "Query:", JSON.stringify(req.query));
    try {
        const { email } = req.params;
        const { page = 1, limit = 10, userEmail } = req.query;

        if (!userEmail) {
            console.log("[Classified] GET BY USER - Missing userEmail");
            return res.status(400).json({ message: 'User email is required to view classifieds' });
        }

        const query = { 'postedBy.email': email };

        // Only show classifieds that the requester is allowed to view
        query.$or = [
            { viewableBy: { $in: [userEmail] } },
            { 'postedBy.email': userEmail }
        ];

        // Only show non-expired classifieds
        query.expiryDate = { $gte: new Date() };

        console.log("[Classified] GET BY USER - Mongo Query:", JSON.stringify(query));
        const classifieds = await Classified.find(query)
            .sort({ createdAt: -1 })
            .limit(parseInt(limit))
            .skip((page - 1) * parseInt(limit))
            .exec();

        const count = await Classified.countDocuments(query);
        console.log(`[Classified] GET BY USER - Found ${classifieds.length} classifieds, total: ${count}`);

        res.status(200).json({
            classifieds,
            totalPages: Math.ceil(count / limit),
            currentPage: Number(page),
            totalClassifieds: count
        });
    } catch (error) {
        console.error('[Classified] GET BY USER - Error:', error);
        res.status(500).json({ message: 'Error fetching classifieds by user', error: error.message });
    }
};

// Add new endpoint to add viewers to a classified
exports.addViewers = async (req, res) => {
    console.log("[Classified] ADD VIEWERS - Params:", JSON.stringify(req.params), "Query:", JSON.stringify(req.query), "Body:", JSON.stringify(req.body));
    try {
        const { id } = req.params;
        const { emails } = req.body;
        const { userEmail } = req.query;

        if (!Array.isArray(emails) || emails.length === 0) {
            console.log("[Classified] ADD VIEWERS - No emails provided");
            return res.status(400).json({ message: 'At least one email must be provided' });
        }

        const classified = await Classified.findById(id);

        if (!classified) {
            console.log(`[Classified] ADD VIEWERS - Not found: ${id}`);
            return res.status(404).json({ message: 'Classified not found' });
        }

        // Only the poster can add viewers
        if (classified.postedBy.email !== userEmail) {
            console.log(`[Classified] ADD VIEWERS - Permission denied for user: ${userEmail}, classified poster: ${classified.postedBy.email}`);
            return res.status(403).json({ message: 'Only the poster can add viewers' });
        }

        // Add new viewers
        const updatedViewers = [...new Set([...classified.viewableBy, ...emails])];
        console.log(`[Classified] ADD VIEWERS - Adding viewers: ${emails.join(', ')}. Updated viewers: ${updatedViewers.join(', ')}`);
        
        classified.viewableBy = updatedViewers;
        await classified.save();

        res.status(200).json({ 
            message: 'Viewers added successfully', 
            classified 
        });
    } catch (error) {
        console.error('[Classified] ADD VIEWERS - Error:', error);
        res.status(500).json({ message: 'Error adding viewers', error: error.message });
    }
};

// Remove a classified from being visible to specific users
exports.removeViewers = async (req, res) => {
    console.log("[Classified] REMOVE VIEWERS - Params:", JSON.stringify(req.params), "Query:", JSON.stringify(req.query));
    try {
        const { id } = req.params;
        const { userEmail } = req.query;

        if (!userEmail) {
            console.log("[Classified] REMOVE VIEWERS - Missing userEmail");
            return res.status(400).json({ message: 'User email is required' });
        }

        const classified = await Classified.findById(id);

        if (!classified) {
            console.log(`[Classified] REMOVE VIEWERS - Classified not found: ${id}`);
            return res.status(404).json({ message: 'Classified not found' });
        }

        // Check if user is the poster of the classified
        if (classified.postedBy.email !== userEmail) {
            console.log(`[Classified] REMOVE VIEWERS - Permission denied for user: ${userEmail}, classified poster: ${classified.postedBy.email}`);
            return res.status(403).json({ message: 'Only the poster can remove viewers' });
        }

        const currentViewers = classified.viewableBy || [];
        console.log(`[Classified] REMOVE VIEWERS - Current viewers: ${currentViewers.join(', ')}`);

        // Remove all viewers except the poster
        const updatedViewers = [classified.postedBy.email];
        
        // Update the classified
        classified.viewableBy = updatedViewers;
        await classified.save();
        
        console.log(`[Classified] REMOVE VIEWERS - Updated viewers: ${updatedViewers.join(', ')}`);
        
        res.status(200).json({
            message: 'Viewers removed successfully',
            classified
        });
    } catch (error) {
        console.error('[Classified] REMOVE VIEWERS - Error:', error);
        res.status(500).json({ message: 'Error removing viewers', error: error.message });
    }
};

// Delete a classified
exports.deleteClassified = async (req, res) => {
    console.log("[Classified] DELETE - Params:", JSON.stringify(req.params), "Query:", JSON.stringify(req.query));
    try {
        const { id } = req.params;
        const { userEmail } = req.query;

        if (!userEmail) {
            console.log("[Classified] DELETE - Missing userEmail");
            return res.status(400).json({ message: 'User email is required' });
        }

        const classified = await Classified.findById(id);

        if (!classified) {
            console.log(`[Classified] DELETE - Classified not found: ${id}`);
            return res.status(404).json({ message: 'Classified not found' });
        }

        // Check if user is the poster of the classified
        if (classified.postedBy.email !== userEmail) {
            console.log(`[Classified] DELETE - Permission denied for user: ${userEmail}, classified poster: ${classified.postedBy.email}`);
            return res.status(403).json({ message: 'Only the poster can delete the classified' });
        }

        // Store relevant information for notifications before deletion
        const classifiedInfo = {
            id: classified._id.toString(),
            title: classified.title,
            viewableBy: classified.viewableBy || []
        };
        
        console.log(`[Classified] DELETE - About to delete classified: ${id}, viewable by ${classifiedInfo.viewableBy.length} users`);

        // Delete the classified
        await Classified.findByIdAndDelete(id);
        
        console.log(`[Classified] DELETE - Classified deleted: ${id}`);
        
        // Emit socket event to notify users
        const io = req.app.get('io');
        if (io) {
            io.emit('classified-deleted', {
                classifiedId: classifiedInfo.id,
                title: classifiedInfo.title,
                viewableBy: classifiedInfo.viewableBy
            });
            console.log(`[Classified] DELETE - Socket notification sent for deleted classified: ${id}`);
        } else {
            console.log(`[Classified] DELETE - Socket io not available, skipping notifications`);
        }
        
        res.status(200).json({
            message: 'Classified deleted successfully'
        });
    } catch (error) {
        console.error('[Classified] DELETE - Error:', error);
        res.status(500).json({ message: 'Error deleting classified', error: error.message });
    }
};
