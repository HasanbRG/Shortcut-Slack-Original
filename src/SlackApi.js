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
        const fields = this.#formatStoryMessage(storyData);

        console.log(fields);

        if (!fields)
            return null;

        var payload = {
            attachments: [{
                color: "#0099FF",
                fields: fields
            }]
        };

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
        
        let fields = [];
        
        if (story.title) fields.push({"title": "Title", "value": story.title, "short": true});
        if (story.type) fields.push({"title": "Type", "value": story.type, "short": true});
        if (story.importance) fields.push({"title": "Importance", "value": story.importance, "short": true});
        if (story.requester) fields.push({"title": "Requester", "value": story.requester, "short": true});
        if (story['company id']) fields.push({"title": "Company ID", "value": story['company id'], "short": true});
        if (story.subscription) fields.push({"title": "Subscription", "value": story.subscription, "short": true});
        if (story.email) fields.push({"title": "Email", "value": story.email, "short": true});
        if (story.url) fields.push({"title": "Link", "value": story.url, "short": false});

        return fields;
    }

    async postWaitingStoriesToSlack(stories) {
        const fields = this.#formatWaitingStoriesMessage(stories);

        if (!fields)
            return null;

        var payload = {
            attachments: [{
                color: "#FF9900",
                fields: fields
            }]
        };

        const response = await this.#makeRequest(
            process.env.SLACK_WAITING_STORY_WEBHOOK,
            this.#HTTP_POST,
            payload
        )

        return response;
    }

    #formatWaitingStoriesMessage(stories) {
        const agentCounts = {};
        stories.forEach(story => {
            if (story['agent']) {
                agentCounts[story['agent']] = (agentCounts[story['agent']] || 0) + 1;
            }
        });

        let fields = [];
        const totalCards = stories.length;
        fields.push({"title": "Total Cards", "value": totalCards.toString(), "short": false});

        Object.entries(agentCounts).forEach(([agent, count]) => {
            fields.push({"title": agent, "value": count.toString(), "short": true});
        });

        return fields;
    }

    async postStoryCompletionToSlack(storyData, ownerName) {
        const fields = this.#formatCompletionMessage(storyData, ownerName);

        if (!fields)
            return null;

        var payload = {
            attachments: [{
                color: "#36A64F",
                fields: fields
            }]
        };

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
        
        return [
            {"title": "Title", "value": storyName, "short": true},
            {"title": "Type", "value": storyType, "short": true},
            {"title": "ID", "value": storyId.toString(), "short": true},
            {"title": "Owner", "value": ownerName, "short": true},
            {"title": "Link", "value": storyUrl, "short": false}
        ];
    }
}

export default SlackApi;