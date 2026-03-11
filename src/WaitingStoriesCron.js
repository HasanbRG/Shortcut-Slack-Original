import { CronJob } from 'cron';
import ShortcutApi from './ShortcutApi.js';
import SlackApi from './SlackApi.js';

const waitingStoriesJob = new CronJob(
    '0 10,15 * * 1-5',
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
    const shortcutApi = new ShortcutApi();
    const slackApi = new SlackApi();
    const storiesResponse = await shortcutApi.searchStories("state:500007166 -is:archived");

    let stories = [];
    storiesResponse['data'].forEach(story => {
        let productOwner = extractProductOwner(story);
        
        let storyData = {
            url: story['app_url'],
            agent: productOwner,
            createdDate: new Date(story['created_at']).toDateString()
        };

        stories.push(storyData);
    });

    slackApi.postWaitingStoriesToSlack(stories);
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

export default waitingStoriesJob;