class ShortcutApi 
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
     * Shortcut API token
     */
    #token;

    /**
     * Shortcut Base URL
     */
    #shortcutBaseUrl = 'https://api.app.shortcut.com/api/v3';

    constructor() {
        this.#token = process.env.SHORTCUT_API_TOKEN;
    }

    /**
     * Makes HTTP request to Shortcut API
     * @param {string} endpoint 
     * @param {string} method 
     * @returns 
     */
    async #makeRequest(endpoint, method, data = null) {
        let requestInit = {
            method: method,
            headers: {
                'Shortcut-Token': this.#token,
            },
        }

        if (method == this.#HTTP_POST) {
            requestInit['body'] = JSON.stringify(data);
            requestInit['Content-Type'] = 'application/json';
        }
            
        const response = fetch(this.#shortcutBaseUrl + endpoint, requestInit);

        return (await response).json();
    }

    /**
     * Gets details about an individual story
     * @param {int} storyId
     */
    getStory(storyId) {
        let endpoint = `/stories/${storyId}`;
        const response = this.#makeRequest(endpoint, this.#HTTP_GET);
        return response;
    }

    /**
     * Gets all stories that match search parameters
     * @param {string} searchParams Query string  e.g. 'state:500007166 -is:archived' https://help.shortcut.com/hc/en-us/articles/360000046646-Searching-in-Shortcut-Using-Search-Operators
     * @returns 
     */
    searchStories(searchParams) {
        let queryString = encodeURIComponent(searchParams);
        let endpoint = `/search/stories?query=${queryString}`;
        const response = this.#makeRequest(endpoint, this.#HTTP_GET);
        return response;
    }
}

export default ShortcutApi;