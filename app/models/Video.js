import { pool } from '../config/postgresql.js';

export class Video {
  constructor(data) {
    this.video_id = data.video_id;
    this.uploader_id = data.uploader_id;
    this.file_name = data.file_name;
    this.original_name = data.original_name;
    this.storage_path = data.storage_path;
    this.file_size = data.file_size;
    this.duration = data.duration;
    this.resolution = data.resolution;
    this.checksum = data.checksum;
    this.upload_time = data.upload_time;
    this.status = data.status || 'uploaded';
    this.labels = data.labels || {};
    this.metadata = data.metadata || {};
    this.created_at = data.created_at;
    this.updated_at = data.updated_at;
  }

  static async create(videoData) {
    const {
      uploader_id,
      file_name,
      original_name,
      storage_path,
      file_size,
      duration,
      resolution,
      checksum,
      labels,
      metadata
    } = videoData;

    const query = `
      INSERT INTO public.videos (
        uploader_id, file_name, original_name, storage_path, 
        file_size, duration, resolution, checksum, labels, metadata
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING *
    `;

    const values = [
      uploader_id,
      file_name,
      original_name,
      storage_path,
      file_size,
      duration,
      resolution,
      checksum,
      JSON.stringify(labels || {}),
      JSON.stringify(metadata || {})
    ];

    try {
      const result = await pool.query(query, values);
      return new Video(result.rows[0]);
    } catch (error) {
      console.error('Error creating video:', error);
      throw error;
    }
  }

  static async findById(videoId) {
    const query = 'SELECT * FROM public.videos WHERE video_id = $1';
    
    try {
      const result = await pool.query(query, [videoId]);
      if (result.rows.length === 0) {
        return null;
      }
      return new Video(result.rows[0]);
    } catch (error) {
      console.error('Error finding video by ID:', error);
      throw error;
    }
  }

  static async findByUploader(uploaderId, limit = 50, offset = 0) {
    const query = `
      SELECT * FROM public.videos 
      WHERE uploader_id = $1 
      ORDER BY upload_time DESC 
      LIMIT $2 OFFSET $3
    `;
    
    try {
      const result = await pool.query(query, [uploaderId, limit, offset]);
      return result.rows.map(row => new Video(row));
    } catch (error) {
      console.error('Error finding videos by uploader:', error);
      throw error;
    }
  }

  static async findAll(limit = 50, offset = 0, status = null) {
    let query = 'SELECT * FROM public.videos';
    const values = [];
    let paramCount = 0;

    if (status) {
      paramCount++;
      query += ` WHERE status = $${paramCount}`;
      values.push(status);
    }

    query += ` ORDER BY upload_time DESC LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}`;
    values.push(limit, offset);

    try {
      const result = await pool.query(query, values);
      return result.rows.map(row => new Video(row));
    } catch (error) {
      console.error('Error finding all videos:', error);
      throw error;
    }
  }

  static async updateStatus(videoId, status) {
    const query = `
      UPDATE public.videos 
      SET status = $1, updated_at = CURRENT_TIMESTAMP 
      WHERE video_id = $2 
      RETURNING *
    `;
    
    try {
      const result = await pool.query(query, [status, videoId]);
      if (result.rows.length === 0) {
        return null;
      }
      return new Video(result.rows[0]);
    } catch (error) {
      console.error('Error updating video status:', error);
      throw error;
    }
  }

  static async updateMetadata(videoId, metadata) {
    const query = `
      UPDATE public.videos 
      SET metadata = $1, updated_at = CURRENT_TIMESTAMP 
      WHERE video_id = $2 
      RETURNING *
    `;
    
    try {
      const result = await pool.query(query, [JSON.stringify(metadata), videoId]);
      if (result.rows.length === 0) {
        return null;
      }
      return new Video(result.rows[0]);
    } catch (error) {
      console.error('Error updating video metadata:', error);
      throw error;
    }
  }

  static async updateLabels(videoId, labels) {
    const query = `
      UPDATE public.videos 
      SET labels = $1, updated_at = CURRENT_TIMESTAMP 
      WHERE video_id = $2 
      RETURNING *
    `;
    
    try {
      const result = await pool.query(query, [JSON.stringify(labels), videoId]);
      if (result.rows.length === 0) {
        return null;
      }
      return new Video(result.rows[0]);
    } catch (error) {
      console.error('Error updating video labels:', error);
      throw error;
    }
  }

  static async delete(videoId) {
    const query = 'DELETE FROM public.videos WHERE video_id = $1 RETURNING *';
    
    try {
      const result = await pool.query(query, [videoId]);
      if (result.rows.length === 0) {
        return null;
      }
      return new Video(result.rows[0]);
    } catch (error) {
      console.error('Error deleting video:', error);
      throw error;
    }
  }

  static async getStats(userId = null) {
    const query = `
      SELECT 
        COUNT(*) as total_videos,
        ROUND(SUM(file_size) / (1024.0 * 1024.0 * 1024.0), 2) as total_size_gb,
        COUNT(*) FILTER (WHERE upload_time >= CURRENT_DATE) as videos_today,
        ROUND(AVG(EXTRACT(EPOCH FROM duration)), 2) as avg_duration_sec,
        COUNT(*) FILTER (WHERE status = 'processing') as processing_videos
      FROM public.videos
      ${userId ? 'WHERE uploader_id = $1' : ''}
    `;
    
    try {
      const values = userId ? [userId] : [];
      const result = await pool.query(query, values);
      return result.rows[0];
    } catch (error) {
      console.error('Error getting video stats:', error);
      throw error;
    }
  }

  static async searchByLabels(searchTerm, userId = null) {
    let query = `
      SELECT * FROM public.videos 
      WHERE labels::text ILIKE $1
    `;
    const values = [`%${searchTerm}%`];
    
    if (userId) {
      query += ' AND uploader_id = $2';
      values.push(userId);
    }
    
    query += ' ORDER BY upload_time DESC';
    
    try {
      const result = await pool.query(query, values);
      return result.rows.map(row => new Video(row));
    } catch (error) {
      console.error('Error searching videos by labels:', error);
      throw error;
    }
  }

  // Instance methods
  async updateStatus(status) {
    const updated = await Video.updateStatus(this.video_id, status);
    if (updated) {
      this.status = updated.status;
      this.updated_at = updated.updated_at;
    }
    return updated;
  }

  async updateMetadata(metadata) {
    const updated = await Video.updateMetadata(this.video_id, metadata);
    if (updated) {
      this.metadata = updated.metadata;
      this.updated_at = updated.updated_at;
    }
    return updated;
  }

  async updateLabels(labels) {
    const updated = await Video.updateLabels(this.video_id, labels);
    if (updated) {
      this.labels = updated.labels;
      this.updated_at = updated.updated_at;
    }
    return updated;
  }

  async delete() {
    return await Video.delete(this.video_id);
  }

  toJSON() {
    return {
      video_id: this.video_id,
      uploader_id: this.uploader_id,
      file_name: this.file_name,
      original_name: this.original_name,
      storage_path: this.storage_path,
      file_size: this.file_size,
      duration: this.duration,
      resolution: this.resolution,
      checksum: this.checksum,
      upload_time: this.upload_time,
      status: this.status,
      labels: this.labels,
      metadata: this.metadata,
      created_at: this.created_at,
      updated_at: this.updated_at
    };
  }
}

