import { pool } from '../config/postgresql.js';

export class VideoSegment {
  constructor(data) {
    this.segment_id = data.segment_id;
    this.video_id = data.video_id;
    this.start_time_sec = data.start_time_sec;
    this.end_time_sec = data.end_time_sec;
    this.status = data.status || 'pending';
    this.created_at = data.created_at;
    this.updated_at = data.updated_at;
  }

  static async create(segmentData) {
    const {
      video_id,
      start_time_sec,
      end_time_sec,
      status = 'pending'
    } = segmentData;

    const query = `
      INSERT INTO public.video_segments (
        video_id, start_time_sec, end_time_sec, status
      ) VALUES ($1, $2, $3, $4)
      RETURNING *
    `;

    const values = [video_id, start_time_sec, end_time_sec, status];

    try {
      const result = await pool.query(query, values);
      return new VideoSegment(result.rows[0]);
    } catch (error) {
      console.error('Error creating video segment:', error);
      throw error;
    }
  }

  static async createMultiple(videoId, segments) {
    const query = `
      INSERT INTO public.video_segments (
        video_id, start_time_sec, end_time_sec, status
      ) VALUES ($1, $2, $3, $4)
      RETURNING *
    `;

    try {
      const results = [];
      for (const segment of segments) {
        const values = [
          videoId,
          segment.start_time_sec,
          segment.end_time_sec,
          segment.status || 'pending'
        ];
        const result = await pool.query(query, values);
        results.push(new VideoSegment(result.rows[0]));
      }
      return results;
    } catch (error) {
      console.error('Error creating multiple video segments:', error);
      throw error;
    }
  }

  static async findById(segmentId) {
    const query = 'SELECT * FROM public.video_segments WHERE segment_id = $1';
    
    try {
      const result = await pool.query(query, [segmentId]);
      if (result.rows.length === 0) {
        return null;
      }
      return new VideoSegment(result.rows[0]);
    } catch (error) {
      console.error('Error finding video segment by ID:', error);
      throw error;
    }
  }

  static async findByVideoId(videoId) {
    const query = `
      SELECT * FROM public.video_segments 
      WHERE video_id = $1 
      ORDER BY start_time_sec ASC
    `;
    
    try {
      const result = await pool.query(query, [videoId]);
      return result.rows.map(row => new VideoSegment(row));
    } catch (error) {
      console.error('Error finding video segments by video ID:', error);
      throw error;
    }
  }

  static async findByStatus(status, limit = 100) {
    const query = `
      SELECT * FROM public.video_segments 
      WHERE status = $1 
      ORDER BY created_at ASC 
      LIMIT $2
    `;
    
    try {
      const result = await pool.query(query, [status, limit]);
      return result.rows.map(row => new VideoSegment(row));
    } catch (error) {
      console.error('Error finding video segments by status:', error);
      throw error;
    }
  }

  static async updateStatus(segmentId, status) {
    const query = `
      UPDATE public.video_segments 
      SET status = $1, updated_at = CURRENT_TIMESTAMP 
      WHERE segment_id = $2 
      RETURNING *
    `;
    
    try {
      const result = await pool.query(query, [status, segmentId]);
      if (result.rows.length === 0) {
        return null;
      }
      return new VideoSegment(result.rows[0]);
    } catch (error) {
      console.error('Error updating video segment status:', error);
      throw error;
    }
  }

  static async updateMultipleStatus(segmentIds, status) {
    const query = `
      UPDATE public.video_segments 
      SET status = $1, updated_at = CURRENT_TIMESTAMP 
      WHERE segment_id = ANY($2) 
      RETURNING *
    `;
    
    try {
      const result = await pool.query(query, [status, segmentIds]);
      return result.rows.map(row => new VideoSegment(row));
    } catch (error) {
      console.error('Error updating multiple video segment status:', error);
      throw error;
    }
  }

  static async delete(segmentId) {
    const query = 'DELETE FROM public.video_segments WHERE segment_id = $1 RETURNING *';
    
    try {
      const result = await pool.query(query, [segmentId]);
      if (result.rows.length === 0) {
        return null;
      }
      return new VideoSegment(result.rows[0]);
    } catch (error) {
      console.error('Error deleting video segment:', error);
      throw error;
    }
  }

  static async deleteByVideoId(videoId) {
    const query = 'DELETE FROM public.video_segments WHERE video_id = $1 RETURNING *';
    
    try {
      const result = await pool.query(query, [videoId]);
      return result.rows.map(row => new VideoSegment(row));
    } catch (error) {
      console.error('Error deleting video segments by video ID:', error);
      throw error;
    }
  }

  static async getStats(videoId = null) {
    let query = `
      SELECT 
        COUNT(*) as total_segments,
        COUNT(*) FILTER (WHERE status = 'pending') as pending_segments,
        COUNT(*) FILTER (WHERE status = 'processing') as processing_segments,
        COUNT(*) FILTER (WHERE status = 'processed') as processed_segments,
        COUNT(*) FILTER (WHERE status = 'failed') as failed_segments,
        AVG(end_time_sec - start_time_sec) as avg_segment_duration
      FROM public.video_segments
    `;
    
    const values = [];
    if (videoId) {
      query += ' WHERE video_id = $1';
      values.push(videoId);
    }
    
    try {
      const result = await pool.query(query, values);
      return result.rows[0];
    } catch (error) {
      console.error('Error getting video segment stats:', error);
      throw error;
    }
  }

  static async getSegmentsInTimeRange(videoId, startTime, endTime) {
    const query = `
      SELECT * FROM public.video_segments 
      WHERE video_id = $1 
      AND (
        (start_time_sec <= $2 AND end_time_sec >= $2) OR
        (start_time_sec <= $3 AND end_time_sec >= $3) OR
        (start_time_sec >= $2 AND end_time_sec <= $3)
      )
      ORDER BY start_time_sec ASC
    `;
    
    try {
      const result = await pool.query(query, [videoId, startTime, endTime]);
      return result.rows.map(row => new VideoSegment(row));
    } catch (error) {
      console.error('Error getting segments in time range:', error);
      throw error;
    }
  }

  // Instance methods
  async updateStatus(status) {
    const updated = await VideoSegment.updateStatus(this.segment_id, status);
    if (updated) {
      this.status = updated.status;
      this.updated_at = updated.updated_at;
    }
    return updated;
  }

  async delete() {
    return await VideoSegment.delete(this.segment_id);
  }

  getDuration() {
    return this.end_time_sec - this.start_time_sec;
  }

  toJSON() {
    return {
      segment_id: this.segment_id,
      video_id: this.video_id,
      start_time_sec: this.start_time_sec,
      end_time_sec: this.end_time_sec,
      status: this.status,
      duration: this.getDuration(),
      created_at: this.created_at,
      updated_at: this.updated_at
    };
  }
}

