import { CronJob } from 'cron';
import ShortcutApi from './ShortcutApi.js';
import SlackApi from './SlackApi.js';

//const waitingStoriesJob = new CronJob(
//    '0 10,15 * * 1-5',
//    getWaitingStories,
//    null,
//    false,
//   'Europe/London'
//);

//const eveningJob = new CronJob(
//    '20 19 * * 1-5',
//    getWaitingStories,
//    null,
//    false,
//    'Europe/London'
//);

//eveningJob.start();
//waitingStoriesJob.start();

const waitingStoriesJob = new CronJob(
    '0 9-17 * * 1-5',
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
        const storiesResponse = await shortcutApi.searchStories("state:500000022 -is:archived");

        console.log('[CRON] Found', storiesResponse['data'].length, 'stories in Needs Edit');

        let stories = [];
        storiesResponse['data'].forEach(story => {
            let productOwner = extractProductOwner(story);
            
            if (productOwner) {
                let storyData = {
                    url: story['app_url'],
                    agent: productOwner,
                    createdDate: new Date(story['created_at']).toDateString()
                };
                stories.push(storyData);
            }
        });

        console.log('[CRON] Filtered to', stories.length, 'stories with product owners');
        
        const result = await slackApi.postWaitingStoriesToSlack(stories);
        
        console.log('[CRON] Message posted to Slack. Status:', result.status);
    } catch (error) {
        console.error('[CRON] Error:', error);
    }
}

/**
 * Gets the product owner from the story description
 * @param {Object} story
 * @returns 
 */
function extractProductOwner(story)
{
    let description = story.description;
    let customerDetails = description.split(/# Customer[\s\u00A0]Details/);

    let company = [];
    if (customerDetails[1]) {
        company = customerDetails[1].split("\n");
    } else {
        return null;
    }

    let productOwner;
    company.forEach(element => {
        let [key, value] = element.split(':');

        if (key == "Product Owner") {
            productOwner = value.trim();
            return;
        }
    });

    return productOwner;
}

export default {waitingStoriesJob};