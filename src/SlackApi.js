class SlackApi
{
    /**
     * GET
     */
    #HTTP_GET = 'GET';

    /**
     * POST
     */
    #HTTP_POST = 'POST';

    /**
     * Token
     */
    #token;

    constructor() {

    }

    async #makeRequest(endpoint, method, data = null) {
        const response = fetch(endpoint, {
            method: method,
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(data)
        });

        return await response;
    }

    postStoryApprovalToSlack(storyData) {
        const message = this.#formatStoryMessage(storyData);

        console.log(message);

        if (!message)
            return null;

        var payload = {text: message};

        const response = this.#makeRequest(
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
            url: storyData.url
        };

        company.forEach(element => {
            let [key, value] = element.split(':');

            if (key && value) {
                key = key.trim().toLowerCase();
                value = value.trim();
                story[key] = value;
            }
        });
        
        const keys = [
            'type',
            'importance',
            'product owner',
            'company id',
            'subscription',
            'email',
            'title',
            'url'
        ];

        let message = "";
        keys.forEach(key => {
            if (Object.hasOwn(story, key)) {
                message += ` ${story[key]} |`;
            }
        });

        return message;
    }

    postWaitingStoriesToSlack(stories) {
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
}

function getCompanyFromDesc(description) {
    const parts = description.split("\n");
    for (let i = 0; i < parts.length; i++) {
        if (parts[i].trim().toLowerCase() === "# customer details\n") {
            console.log("----------------------------")
            return parts.slice(i - parts.length);
        }        
    }

    return [];
}

export default SlackApi;