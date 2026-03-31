class SlackApi
{
    /**
     * POST
     */
    #HTTP_POST = 'POST';

    async #makeRequest(endpoint, method, data = null) {
        const response = await fetch(endpoint, {
            method: method,
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(data)
        });

        return response;
    }

    async postStoryApprovalToSlack(storyData) {
        const message = this.#formatStoryMessage(storyData);

        console.log(message);

        if (!message)
            return null;

        var payload = {text: message};

        const response = await this.#makeRequest(
            process.env.SLACK_APPROVE_STORY_WEBHOOK,
            this.#HTTP_POST,
            payload
        )

        return response;
    }
    #formatStoryMessage(storyData) {
        let description = storyData.description;
        let customerDetails = description.split(/# Customer[\s\u00A0]Details/);

        let company = [];
        if (customerDetails[1]) {
            company = customerDetails[1].split("\n");
        } else {
            return null;
        }

        let story = {
            type: storyData.type.toUpperCase(),
            title: storyData.title,
            url: storyData.url,
            requester: storyData.requester
        };

        company.forEach(element => {
            let [key, value] = element.split(':');

            if (key && value) {
                key = key.trim().toLowerCase();
                value = value.trim();
                story[key] = value;
            }
        });
        
        let message = "Story Approval Request\n\n";
        
        if (story.title) message += `Title: ${story.title}\n`;
        if (story.type) message += `Type: ${story.type}\n`;
        if (story.importance) message += `Importance: ${story.importance}\n`;
        if (story.requester) message += `Requester: ${story.requester}\n`;
        if (story['company id']) message += `Company ID: ${story['company id']}\n`;
        if (story.subscription) message += `Subscription: ${story.subscription}\n`;
        if (story.email) message += `Email: ${story.email}\n`;
        if (story.url) message += `Link: ${story.url}`;

        return message;
    }

    async postWaitingStoriesToSlack(stories) {
        const message = this.#formatWaitingStoriesMessage(stories);

        if (!message)
            return null;

        var payload = {text: message};

        const response = this.#makeRequest(
            process.env.SLACK_WAITING_STORY_WEBHOOK,
            this.#HTTP_POST,
            payload
        )

        return response;
    }

    #formatWaitingStoriesMessage(stories) {
    // Count stories by agent
    const agentCounts = {};
    stories.forEach(story => {
        if (story['agent']) {
            agentCounts[story['agent']] = (agentCounts[story['agent']] || 0) + 1;
        }
    });

    const totalCards = stories.length;
    let message = `<!here>\nThere are ${totalCards} cards waiting to be edited.\n`;

    // Format by agent with counts
    Object.entries(agentCounts).forEach(([agent, count]) => {
        message += `\n${agent} - ${count}`;
    });

    return message;
}

    async postStoryCompletionToSlack(storyData, ownerName) {
        const message = this.#formatCompletionMessage(storyData, ownerName);

        if (!message)
            return null;

        var payload = {text: message};

        const response = await this.#makeRequest(
            process.env.SLACK_STORY_COMPLETION_WEBHOOK,
            this.#HTTP_POST,
            payload
        )

        return response;
    }

    #formatCompletionMessage(storyData, ownerName) {
        const storyName = storyData.name || 'Unknown Story';
        const storyType = storyData.story_type ? storyData.story_type.toUpperCase() : 'UNKNOWN';
        const storyUrl = storyData.app_url || '#';
        const storyId = storyData.id || 'N/A';
        
        const message = `Story Completed\n\n` +
            `Title: ${storyName}\n` +
            `Type: ${storyType}\n` +
            `ID: ${storyId}\n` +
            `Owner: ${ownerName}\n` +
            `Link: ${storyUrl}`;

        return message;
    }
}

export default SlackApi;