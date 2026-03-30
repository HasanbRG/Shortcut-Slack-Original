import { CronJob } from 'cron';
import ShortcutApi from './ShortcutApi.js';
import SlackApi from './SlackApi.js';
import fs from 'fs';
import path from 'path';

const POSTED_STORIES_FILE = '/usr/src/app/data/postedStories.json';

// Ensure data directory exists
const dataDir = path.dirname(POSTED_STORIES_FILE);
if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
}

let postedStoryIds = loadPostedStories();

function loadPostedStories() {
    try {
        if (fs.existsSync(POSTED_STORIES_FILE)) {
            const data = fs.readFileSync(POSTED_STORIES_FILE, 'utf8');
            return new Set(JSON.parse(data));
        }
    } catch (error) {
        console.error('[CRON] Error loading posted stories:', error);
    }
    return new Set();
}

function savePostedStories() {
    try {
        fs.writeFileSync(POSTED_STORIES_FILE, JSON.stringify(Array.from(postedStoryIds)));
    } catch (error) {
        console.error('[CRON] Error saving posted stories:', error);
    }
}

const storyCompletionJob = new CronJob(
    '* * * * *', // Every minute
    checkCompletedStories,
    null,
    false,
    'Europe/London'
);
storyCompletionJob.start();

/**
 * Retrieves all stories that changed to "Done" state and sends notifications to Slack.
 * Only posts if the story hasn't been posted before.
 */
async function checkCompletedStories()
{
    console.log('[CRON] Story completion job started at', new Date().toISOString());
    
    try {
        const shortcutApi = new ShortcutApi();
        const slackApi = new SlackApi();
        
        const storiesResponse = await shortcutApi.searchStories('state:500000007 -is:archived');
        const stories = storiesResponse['data'] || [];
        const currentStoryIds = new Set(stories.map(s => s.id));

        console.log('[CRON] Found', stories.length, 'completed stories');

        // Remove stories that are no longer in Done state from the posted list
        for (const storyId of postedStoryIds) {
            if (!currentStoryIds.has(storyId)) {
                postedStoryIds.delete(storyId);
                console.log('[CRON] Story', storyId, 'removed from Done state, marking for re-post if it returns');
            }
        }
        savePostedStories();

        const memberNameCache = new Map();
        
        for (const story of stories) {
            // Skip if already posted
            if (postedStoryIds.has(story.id)) {
                console.log('[CRON] Story', story.id, 'already posted, skipping');
                continue;
            }
            
            try {
                const ownerName = await getStoryRequesterName(story, shortcutApi, memberNameCache);
                
                if (ownerName) {
                    await slackApi.postStoryCompletionToSlack(story, ownerName);
                    postedStoryIds.add(story.id);
                    savePostedStories();
                    console.log('[CRON] Completion message posted for story', story.id);
                    
                    // Wait 5 seconds before posting the next story
                    await new Promise(resolve => setTimeout(resolve, 5000));
                }
            } catch (error) {
                console.error('[CRON] Failed to post completion for story', story.id, error);
            }
        }
    } catch (error) {
        console.error('[CRON] Error:', error);
    }
}

/**
 * Resolves the requesting member name from requested_by_id
 * @param {Object} story
 * @param {ShortcutApi} shortcutApi
 * @param {Map<string, string>} memberNameCache
 * @returns {Promise<string|null>}
 */
async function getStoryRequesterName(story, shortcutApi, memberNameCache)
{
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
        console.error('[CRON] Failed to resolve requester for story', story.id, error);
        return null;
    }
}

export default {storyCompletionJob};
