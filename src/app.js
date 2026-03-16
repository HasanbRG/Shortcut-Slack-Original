import ShortcutApi from './ShortcutApi.js';
import SlackApi from './SlackApi.js';
import express, { json, urlencoded } from 'express';
import './WaitingStoriesCron.js'; // Starts cron job for stories in "Needs Edit" state in Shortcut

var app = express();
app.use(json());
app.use(urlencoded({extended: true}));
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

    const data = {
        'title': storyData.name,
        'url': storyData.app_url,
        'type': storyData.story_type,
        'description': storyData.description
    }
    
    const result = await slackApi.postStoryApprovalToSlack(data); // Post approval message to slack channel

    if (result.status == 200) {
        console.log("Message posted to Slack");
        res.send("OK, story sent through.");
    } else {
        res.send("Story failed to send.");
    }
});

app.post('/test-waiting-stories', async (req, res) => {
    const shortcutApi = new ShortcutApi();
    const slackApi = new SlackApi();
    const storiesResponse = await shortcutApi.searchStories("state:500000022 -is:archived");

    let stories = [];
    storiesResponse['data'].forEach(story => {
        let description = story.description;
        let customerDetails = description.split(/# Customer[\s\u00A0]Details/);
        let productOwner = null;
        
        if (customerDetails[1]) {
            let company = customerDetails[1].split("\n");
            company.forEach(element => {
                let [key, value] = element.split(':');
                if (key && value && key.trim() === "Product Owner") {
                    productOwner = value.trim();
                }
            });
        }
        
        if (productOwner) {
            stories.push({
                url: story['app_url'],
                agent: productOwner,
                createdDate: new Date(story['created_at']).toDateString()
            });
        }
    });

    await slackApi.postWaitingStoriesToSlack(stories);
    res.send('Waiting stories message sent to Slack');
});