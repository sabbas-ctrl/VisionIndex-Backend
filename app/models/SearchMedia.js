import { pool } from '../config/postgresql.js';

export class SearchMedia {
  /**
   * Create a search record referencing video/image IDs per user's schema.
   * Accepts nulls for optional fields; leaves query_text null by default.
   */
  static async createRecord({
    user_id,
    search_session_id = null,
    query_type,
    query_text = null,
    query_image_id = null,
    query_video_id = null
  }) {
    const query = `
      INSERT INTO public.searches (
        user_id, search_session_id, query_text, query_type, query_image_id, query_video_id
      ) VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `;
    const values = [
      user_id,
      search_session_id,
      query_text,
      query_type,
      query_image_id,
      query_video_id
    ];

    try {
      const result = await pool.query(query, values);
      return result.rows[0];
    } catch (error) {
      console.error('Error creating search record with media refs:', error);
      throw error;
    }
  }

  static async createForVideo({ user_id, search_session_id = null, video_id }) {
    return this.createRecord({
      user_id,
      search_session_id,
      query_type: 'video',
      query_text: null,
      query_video_id: video_id,
      query_image_id: null
    });
  }

  static async createForImage({ user_id, search_session_id = null, image_id, video_id = null }) {
    return this.createRecord({
      user_id,
      search_session_id,
      query_type: 'image',
      query_text: null,
      query_image_id: image_id,
      query_video_id: video_id
    });
  }

  static async createForText({ user_id, search_session_id = null, query_text, video_id }) {
    return this.createRecord({
      user_id,
      search_session_id,
      query_type: 'text',
      query_text: query_text,
      query_image_id: null,
      query_video_id: video_id
    });
  }

  static async findByVideoId(video_id) {
    const query = `
      SELECT * FROM public.searches
      WHERE query_video_id = $1
      ORDER BY created_at DESC
    `;
    
    try {
      const result = await pool.query(query, [video_id]);
      return result.rows;
    } catch (error) {
      console.error('Error finding searches by video_id:', error);
      throw error;
    }
  }
}
