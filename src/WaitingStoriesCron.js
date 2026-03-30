import { CronJob } from 'cron';
import ShortcutApi from './ShortcutApi.js';
import SlackApi from './SlackApi.js';

const waitingStoriesJob = new CronJob(
    '* * * * *', // Every minute
    getWaitingStories,
    null,
    false,
    'Europe/London'
);
waitingStoriesJob.start();

/**
 * Retrieves all (non-archived) stories from "Needs Edit" and passes required data to Slack API.
 */
async function getWaitingStories()
{
    console.log('[CRON] Waiting stories job started at', new Date().toISOString());
    
    try {
        const shortcutApi = new ShortcutApi();
        const slackApi = new SlackApi();
        const storiesResponse = await shortcutApi.searchStories("state:500000009 -is:archived");
        const memberNameCache = new Map();

        console.log('[CRON] Found', storiesResponse['data'].length, 'stories in Needs Edit');

        let stories = [];
        for (const story of storiesResponse['data']) {
            const requestedBy = await getStoryRequesterName(story, shortcutApi, memberNameCache);
            
            if (requestedBy) {
                let storyData = {
                    url: story['app_url'],
                    agent: requestedBy,
                    createdDate: new Date(story['created_at']).toDateString()
                };
                stories.push(storyData);
            }
        }

        console.log('[CRON] Filtered to', stories.length, 'stories with requesters');
        
        const result = await slackApi.postWaitingStoriesToSlack(stories);
        
        console.log('[CRON] Message posted to Slack. Status:', result.status);
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


export default {waitingStoriesJob};