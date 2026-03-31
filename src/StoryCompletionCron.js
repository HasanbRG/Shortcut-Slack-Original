import { CronJob } from 'cron';
import ShortcutApi from './ShortcutApi.js';
import SlackApi from './SlackApi.js';
import db from './DatabaseManager.js';

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
        
        // Calculate date from 24 hours ago
        const oneDayAgo = new Date();
        oneDayAgo.setHours(oneDayAgo.getHours() - 24);
        const dateFilter = oneDayAgo.toISOString().split('T')[0];
        
        // Search for stories in Completed state updated in last 24 hours
        const storiesResponse = await shortcutApi.searchStories(`state:500005946 -is:archived updated_at:>=${dateFilter}`);
        const stories = storiesResponse['data'] || [];
        const currentStoryIds = new Set(stories.map(s => s.id));

        console.log('[CRON] Found', stories.length, 'completed stories');

        // Get all previously posted stories from database
        const postedStoryIds = await db.getAllPostedStoryIds();

        // Remove stories that are no longer in Done state from the posted list
        for (const storyId of postedStoryIds) {
            if (!currentStoryIds.has(storyId)) {
                await db.removeStoryFromPosted(storyId);
                console.log('[CRON] Story', storyId, 'removed from Done state, marking for re-post if it returns');
            }
        }

        const memberNameCache = new Map();
        
        for (const story of stories) {
            // Skip if already posted (check in-memory Set for O(1) performance)
            if (postedStoryIds.has(story.id)) {
                continue;
            }
            
            try {
                const ownerName = await getStoryRequesterName(story, shortcutApi, memberNameCache);
                
                if (!ownerName) {
                    console.log('[CRON] Story', story.id, 'has no owner name, skipping');
                    continue;
                }
                
                // Post to Slack first
                const response = await slackApi.postStoryCompletionToSlack(story, ownerName);
                
                // Only mark as posted if Slack post was successful
                if (response && (response.ok === true || response.status === 200)) {
                    await db.markStoryAsPosted(story.id);
                    console.log('[CRON] Completion message posted for story', story.id);
                } else {
                    console.error('[CRON] Slack post failed for story', story.id, '| Status:', response?.status, '| OK:', response?.ok);
                }
                
                // Wait 5 seconds before posting the next story
                await new Promise(resolve => setTimeout(resolve, 5000));
            } catch (error) {
                console.error('[CRON] Exception for story', story.id, ':', error.message);
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
