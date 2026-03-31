import ShortcutApi from './ShortcutApi.js';
import SlackApi from './SlackApi.js';
import express, { json, urlencoded } from 'express';
import db from './DatabaseManager.js';
import './WaitingStoriesCron.js'; // Starts cron job for stories in "Needs Edit" state in Shortcut
import './StoryCompletionCron.js'; // Starts cron job for completed stories notifications

var app = express();
app.use(json());
app.use(urlencoded({extended: true}));

// Initialize database
db.initialize().catch(err => {
    console.error('Failed to initialize database:', err);
    process.exit(1);
});

app.listen(8000) // Start server

app.get('/', (req, res) => {
    res.send('OK - Server is running');
});

app.post('/approve-story', async (req, res) => {
    console.log(`POST /approve-story ${req.body.text}`);
    
    const shortcutApi = new ShortcutApi();
    const slackApi = new SlackApi();

    const storyData = await shortcutApi.getStory(req.body.text); // Get story from Shortcut API

    if (Object.hasOwn(storyData, 'message') && storyData['message'] == 'Resource not found.') {
        res.send('Story not found');
        return;
    }
        
    if (storyData.errors) {
        console.dir(errors);
        res.send(errors);
        return;
    }

    const memberNameCache = new Map();
    const requesterName = await getStoryRequesterName(storyData, shortcutApi, memberNameCache);

    const data = {
        'title': storyData.name,
        'url': storyData.app_url,
        'type': storyData.story_type,
        'description': storyData.description,
        'requester': requesterName
    }
    
    const result = await slackApi.postStoryApprovalToSlack(data); // Post approval message to slack channel

    if (result.status == 200) {
        console.log("Message posted to Slack");
        res.send("OK, story sent through.");
    } else {
        res.send("Story failed to send.");
    }
});

app.get('/health', (req, res) => {
    res.status(200).send('OK - Health check passed');
});

async function getStoryRequesterName(story, shortcutApi, memberNameCache) {
    const memberId = story.requested_by_id;

    if (!memberId) {
        return null;
    }

    if (memberNameCache.has(memberId)) {
        return memberNameCache.get(memberId);
    }

    try {
        const member = await shortcutApi.getMember(memberId);
        const memberName = member?.profile?.name || member?.name || null;

        if (memberName) {
            memberNameCache.set(memberId, memberName);
        }

        return memberName;
    } catch (error) {
        console.error('[API] Failed to resolve requester for story', story.id, error);
        return null;
    }
}