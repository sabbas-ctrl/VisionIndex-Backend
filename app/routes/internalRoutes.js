import express from 'express';
import VideoMetadata from '../models/mongodb/VideoMetadata.js';
import { Video } from '../models/Video.js';
import { SearchResult } from '../models/SearchResult.js';
import { SearchMedia } from '../models/SearchMedia.js';

const router = express.Router();

function verifyWorkerToken(req, res, next) {
  const token = req.headers['x-worker-token'];
  const expected = process.env.WORKER_CALLBACK_TOKEN;
  if (!expected) {
    return res.status(500).json({ success: false, message: 'WORKER_CALLBACK_TOKEN not configured' });
  }
  if (!token || token !== expected) {
    return res.status(401).json({ success: false, message: 'Unauthorized worker callback' });
  }
  next();
}

router.post('/workflow-callback', verifyWorkerToken, async (req, res) => {
  console.log('📨 Received workflow-callback request');
  console.log('   Body keys:', Object.keys(req.body || {}));
  
  try {
    const { video_id, stage, message, status = 'info', error, workflow_id, workflow_run_id, details } = req.body || {};
    console.log(`   video_id: ${video_id}, stage: ${stage}`);
    
    if (!video_id) {
      return res.status(400).json({ success: false, message: 'Missing video_id' });
    }

    let metadata = await VideoMetadata.findOne({ video_id });
    if (!metadata) {
      metadata = new VideoMetadata({ video_id });
    }

    if (workflow_id) metadata.workflow_id = workflow_id;
    if (workflow_run_id) metadata.workflow_run_id = workflow_run_id;

    const allowedStages = ['downloading', 'preprocessing', 'analysis', 'postprocessing', 'completed', 'failed'];
    if (stage && allowedStages.includes(stage)) {
      metadata.processing_stage = stage;
    }

    metadata.processing_log.push({
      timestamp: new Date(),
      stage: stage || 'unknown',
      message: message || (error ? String(error) : ''),
      status: error ? 'error' : status,
      details: details || null
    });

    await metadata.save();

    // Helper to extract results payload from various sources
    const extractResults = () => {
      // 1) Check details.query_results (new format from Temporal activity)
      if (details && details.query_results && Array.isArray(details.query_results) && details.query_results.length > 0) {
        console.log('📥 Found query_results in details');
        return { query_results: details.query_results };
      }
      // 2) Prefer explicit JSON in body.details
      if (details && (details.results || details.person_tracks || details.object_tracks)) {
        return details.results || {
          person_tracks: details.person_tracks || [],
          object_tracks: details.object_tracks || []
        };
      }
      // 3) Try top-level fields
      if (req.body.results || req.body.person_tracks || req.body.object_tracks || req.body.query_results) {
        if (req.body.query_results) {
          return { query_results: req.body.query_results };
        }
        return req.body.results || {
          person_tracks: req.body.person_tracks || [],
          object_tracks: req.body.object_tracks || []
        };
      }
      // 4) Fallback to parsing [RESULTS-JSON] in message string
      if (message) {
        const m = message.match(/\[RESULTS-JSON\](.*?)\[\/RESULTS-JSON\]/s);
        if (m && m[1]) {
          try {
            return JSON.parse(m[1].trim());
          } catch (e) {
            console.error('❌ Failed to JSON.parse RESULTS-JSON content:', e);
          }
        }
      }
      return null;
    };

    // Parse results when workflow completes
    if (stage === 'completed') {
      console.log('🔔 Workflow completed callback received');
      console.log('   video_id:', video_id);
      console.log('   details:', JSON.stringify(details, null, 2));
      
      try {
        const resultsData = extractResults();
        console.log('📦 extractResults() returned:', resultsData ? 'data found' : 'null');
        
        if (resultsData) {
          console.log('📊 Results payload received from pipeline:', {
            query_results_count: Array.isArray(resultsData.query_results) ? resultsData.query_results.length : 0,
            person_count: Array.isArray(resultsData.person_tracks) ? resultsData.person_tracks.length : 0,
            object_count: Array.isArray(resultsData.object_tracks) ? resultsData.object_tracks.length : 0
          });

          // Find the search record for this video
          const searches = await SearchMedia.findByVideoId(video_id);
          if (searches && searches.length > 0) {
            const latestSearch = searches[0]; // Get the most recent search
            console.log(`✅ Found search_id: ${latestSearch.search_id} for video_id: ${video_id}`);

            // Handle query_results format (new format from pipeline)
            if (resultsData.query_results && Array.isArray(resultsData.query_results)) {
              for (const result of resultsData.query_results) {
                try {
                  // track_id can be a number or string - convert to string for type detection
                  const trackIdStr = String(result.track_id || '');
                  const trackType = trackIdStr.startsWith('person') ? 'person' : 
                                    trackIdStr.startsWith('object') ? 'object' : 'person'; // default to person
                  
                  await SearchResult.create({
                    search_id: latestSearch.search_id,
                    video_id: video_id,
                    segment_id: null,
                    score: result.similarity_score || 0,
                    thumbnail_url: null,
                    video_timestamp: result.start_time || null,
                    match_metadata: {
                      track_id: result.track_id,
                      track_type: trackType,
                      start_time: result.start_time,
                      end_time: result.end_time,
                      num_frames: result.num_frames,
                      upper_color: result.upper_color,
                      lower_color: result.lower_color,
                      attributes: result.attributes,
                      object_carried: result.object_carried,
                      similarity_score: result.similarity_score,
                      ...result // Store entire result payload
                    }
                  });
                } catch (e) {
                  console.error('❌ Failed inserting query_result into search_results:', e);
                }
              }
              console.log(`✅ Stored ${resultsData.query_results.length} query results to search_results`);
            }

            // Store each track result in search_results table (legacy format)
            if (resultsData.person_tracks && Array.isArray(resultsData.person_tracks)) {
              for (const track of resultsData.person_tracks) {
                try {
                  await SearchResult.create({
                    search_id: latestSearch.search_id,
                    video_id: video_id,
                    segment_id: null, // Can be added later if you use video_segments
                    score: track.avg_confidence || 0,
                    thumbnail_url: null, // Skip for now
                    video_timestamp: track.first_appearance_time || null,
                    match_metadata: {
                      track_id: track.track_id,
                      track_type: 'person',
                      ...track // Store entire track payload
                    }
                  });
                } catch (e) {
                  console.error('❌ Failed inserting person track into search_results:', e);
                }
              }
              console.log(`✅ Stored ${resultsData.person_tracks.length} person tracks to search_results`);
            }

            if (resultsData.object_tracks && Array.isArray(resultsData.object_tracks)) {
              for (const track of resultsData.object_tracks) {
                try {
                  await SearchResult.create({
                    search_id: latestSearch.search_id,
                    video_id: video_id,
                    segment_id: null,
                    score: track.avg_confidence || 0,
                    thumbnail_url: null,
                    video_timestamp: track.first_appearance_time || null,
                    match_metadata: {
                      track_id: track.track_id,
                      track_type: 'object',
                      ...track
                    }
                  });
                } catch (e) {
                  console.error('❌ Failed inserting object track into search_results:', e);
                }
              }
              console.log(`✅ Stored ${resultsData.object_tracks.length} object tracks to search_results`);
            }
          } else {
            console.warn(`⚠ No search record found for video_id: ${video_id}`);
          }
        } else {
          console.log('⚠ No results data extracted from callback');
          console.log('   details object:', details);
          console.log('   details.query_results:', details?.query_results);
        }
      } catch (parseError) {
        console.error('❌ Failed to parse/store results:', parseError);
      }
    }

    // Optionally update Postgres video status when stage changes
    if (stage === 'completed') {
      await Video.updateStatus(video_id, 'processed');
    } else if (stage === 'failed') {
      await Video.updateStatus(video_id, 'failed');
    } else if (stage === 'downloading' || stage === 'analysis' || stage === 'preprocessing' || stage === 'postprocessing') {
      await Video.updateStatus(video_id, 'processing');
    }

    return res.json({ success: true });
  } catch (err) {
    console.error('Internal workflow-callback error:', err);
    return res.status(500).json({ success: false, message: 'Internal error', error: err.message });
  }
});

export default router;
