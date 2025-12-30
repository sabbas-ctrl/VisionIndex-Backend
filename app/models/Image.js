import { pool } from '../config/postgresql.js';

export class Image {
  constructor(data) {
    this.image_id = data.image_id;
    this.uploader_id = data.uploader_id;
    this.file_name = data.file_name;
    this.original_name = data.original_name;
    this.storage_path = data.storage_path;
    this.checksum = data.checksum;
    this.upload_time = data.upload_time;
    this.status = data.status || 'uploaded';
    this.metadata = data.metadata || {};
    this.created_at = data.created_at;
    this.updated_at = data.updated_at;
  }

  static async create(imageData) {
    const {
      uploader_id,
      file_name,
      original_name,
      storage_path,
      checksum,
      metadata
    } = imageData;

    const query = `
      INSERT INTO public.images (
        uploader_id, file_name, original_name, storage_path, 
        checksum, metadata
      ) VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `;

    const values = [
      uploader_id,
      file_name,
      original_name,
      storage_path,
      checksum,
      metadata ? JSON.stringify(metadata) : null
    ];

    try {
      const result = await pool.query(query, values);
      return result.rows[0];
    } catch (error) {
      console.error('Error creating image record:', error);
      throw error;
    }
  }

  static async getById(imageId) {
    const query = 'SELECT * FROM public.images WHERE image_id = $1';
    const result = await pool.query(query, [imageId]);
    return result.rows[0] || null;
  }

  static async getByUploaderId(uploaderId) {
    const query = 'SELECT * FROM public.images WHERE uploader_id = $1 ORDER BY created_at DESC';
    const result = await pool.query(query, [uploaderId]);
    return result.rows;
  }

  static async update(imageId, updates) {
    const allowedFields = ['status', 'metadata'];
    const fields = [];
    const values = [];
    let paramCount = 1;

    for (const [key, value] of Object.entries(updates)) {
      if (allowedFields.includes(key)) {
        fields.push(`${key} = $${paramCount++}`);
        values.push(key === 'metadata' ? JSON.stringify(value) : value);
      }
    }

    if (fields.length === 0) return null;

    fields.push(`updated_at = NOW()`);
    values.push(imageId);

    const query = `
      UPDATE public.images 
      SET ${fields.join(', ')}
      WHERE image_id = $${paramCount}
      RETURNING *
    `;

    try {
      const result = await pool.query(query, values);
      return result.rows[0] || null;
    } catch (error) {
      console.error('Error updating image record:', error);
      throw error;
    }
  }

  static async delete(imageId) {
    const query = 'DELETE FROM public.images WHERE image_id = $1 RETURNING *';
    try {
      const result = await pool.query(query, [imageId]);
      return result.rows[0] || null;
    } catch (error) {
      console.error('Error deleting image record:', error);
      throw error;
    }
  }
}
