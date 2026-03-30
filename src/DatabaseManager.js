import pkg from 'pg';
const { Pool } = pkg;

class DatabaseManager {
    constructor() {
        this.pool = new Pool({
            host: process.env.DB_HOST || 'localhost',
            port: process.env.DB_PORT || 5432,
            user: process.env.DB_USER || 'postgres',
            password: process.env.DB_PASSWORD || 'postgres',
            database: process.env.DB_NAME || 'shortcut_slack'
        });

        this.pool.on('error', (err) => {
            console.error('[DB] Unexpected error on idle client', err);
        });
    }

    async initialize() {
        try {
            await this.createTable();
            console.log('[DB] Database initialized successfully');
        } catch (error) {
            console.error('[DB] Failed to initialize database:', error);
            throw error;
        }
    }

    async createTable() {
        const createTableQuery = `
            CREATE TABLE IF NOT EXISTS posted_stories (
                id SERIAL PRIMARY KEY,
                story_id INTEGER UNIQUE NOT NULL,
                posted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
            CREATE INDEX IF NOT EXISTS idx_story_id ON posted_stories(story_id);
        `;

        try {
            await this.pool.query(createTableQuery);
            console.log('[DB] Table created or already exists');
        } catch (error) {
            console.error('[DB] Error creating table:', error);
            throw error;
        }
    }

    async isStoryPosted(storyId) {
        try {
            const result = await this.pool.query(
                'SELECT 1 FROM posted_stories WHERE story_id = $1',
                [storyId]
            );
            return result.rows.length > 0;
        } catch (error) {
            console.error('[DB] Error checking if story posted:', error);
            return false;
        }
    }

    async markStoryAsPosted(storyId) {
        try {
            await this.pool.query(
                'INSERT INTO posted_stories (story_id) VALUES ($1) ON CONFLICT (story_id) DO NOTHING',
                [storyId]
            );
            console.log('[DB] Story', storyId, 'marked as posted');
        } catch (error) {
            console.error('[DB] Error marking story as posted:', error);
        }
    }

    async removeStoryFromPosted(storyId) {
        try {
            await this.pool.query(
                'DELETE FROM posted_stories WHERE story_id = $1',
                [storyId]
            );
            console.log('[DB] Story', storyId, 'removed from posted list');
        } catch (error) {
            console.error('[DB] Error removing story from posted:', error);
        }
    }

    async getAllPostedStoryIds() {
        try {
            const result = await this.pool.query('SELECT story_id FROM posted_stories');
            return new Set(result.rows.map(row => row.story_id));
        } catch (error) {
            console.error('[DB] Error getting all posted stories:', error);
            return new Set();
        }
    }

    async close() {
        return this.pool.end();
    }
}

export default new DatabaseManager();
