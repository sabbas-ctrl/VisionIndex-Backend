import { SearchResult } from '../models/SearchResult.js';
import { Search } from '../models/Search.js';
import { Video } from '../models/Video.js';

export class SearchController {
  /**
   * Get the latest search for a video_id so the UI can open analysis from a video card.
   */
  static async getLatestSearchByVideoId(req, res) {
    try {
      const { videoId } = req.params;

      if (!videoId) {
        return res.status(400).json({
          success: false,
          message: 'Missing videoId parameter'
        });
      }

      const search = await Search.findByVideoId(videoId);

      if (!search) {
        return res.status(404).json({
          success: false,
          message: 'Search not found for this video'
        });
      }

      res.json({
        success: true,
        data: {
          search_id: search.search_id,
          video_id: search.query_video_id,
          query_text: search.query_text,
          query_type: search.query_type,
          created_at: search.created_at
        }
      });
    } catch (error) {
      console.error('Error fetching latest search by video ID:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch latest search by video ID',
        error: error.message
      });
    }
  }

  /**
   * Get search results by search_id for Analysis page
   */
  static async getSearchResults(req, res) {
    try {
      const { searchId } = req.params;

      if (!searchId) {
        return res.status(400).json({
          success: false,
          message: 'Missing searchId parameter'
        });
      }

      // Fetch search metadata
      const search = await Search.findById(searchId);
      if (!search) {
        return res.status(404).json({
          success: false,
          message: 'Search not found'
        });
      }

      // Fetch all search results
      const results = await SearchResult.findBySearchId(searchId);

      // Parse match_metadata for each result
      const formattedResults = results.map(result => {
        const metadata = typeof result.match_metadata === 'string' 
          ? JSON.parse(result.match_metadata) 
          : result.match_metadata;

        return {
          result_id: result.result_id,
          track_id: metadata.track_id,
          track_type: metadata.track_type,
          score: parseFloat(result.score),
          video_timestamp: result.video_timestamp,
          match_metadata: metadata
        };
      });

      // Separate person and object tracks
      const personTracks = formattedResults.filter(r => r.track_type === 'person');
      const objectTracks = formattedResults.filter(r => r.track_type === 'object');

      res.json({
        success: true,
        data: {
          search: {
            search_id: search.search_id,
            video_id: search.query_video_id,
            query_text: search.query_text,
            query_type: search.query_type,
            created_at: search.created_at
          },
          results: {
            person_tracks: personTracks,
            object_tracks: objectTracks,
            total_results: formattedResults.length
          }
        }
      });

    } catch (error) {
      console.error('Error fetching search results:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch search results',
        error: error.message
      });
    }
  }

  /**
   * Get formatted data for Analysis page
   */
  static async getAnalysisData(req, res) {
    try {
      const { searchId } = req.params;

      if (!searchId) {
        return res.status(400).json({
          success: false,
          message: 'Missing searchId parameter'
        });
      }

      // Fetch search record first to get video_id
      const search = await Search.findById(searchId);
      if (!search) {
        return res.status(404).json({
          success: false,
          message: 'Search not found'
        });
      }

      // Fetch search results
      const results = await SearchResult.findBySearchId(searchId, 100);
      
      // If no results yet, check video processing status to determine if truly still processing
      if (!results || results.length === 0) {
        // Fetch video to check its processing status
        const video = await Video.findById(search.query_video_id);
        const videoStatus = video?.status || 'processing';
        
        // If video is still processing, return processing status
        if (videoStatus === 'processing') {
          return res.json({
            success: true,
            processing: true,
            message: 'Results are still being processed',
            search: {
              search_id: search.search_id,
              query_text: search.query_text,
              created_at: search.created_at
            }
          });
        }
        
        // If video processing is complete (status: processed, completed, etc.) but no results found,
        // return empty analysis data with processing: false to proceed to analysis page
        return res.json({
          success: true,
          processing: false,
          data: {
            videoId: search.query_video_id,
            personResult: false,
            noMatchesFound: true,
            message: 'Video processing complete. No matches found for the search query.',
            detectionInfo: {
              timeZone: { start: 'N/A', end: 'N/A' },
              upperClothing: { color: 'N/A', type: 'N/A' },
              lowerClothing: { color: 'N/A', type: 'N/A' },
              objectCarried: 'None',
              gender: { type: 'N/A', confidence: 'N/A' },
              embeddingConfidence: 'N/A'
            },
            timeline: { segments: [] },
            appearances: { first: 'N/A', last: 'N/A', total: 0, numFrames: 0, confidence: 'N/A' },
            aiInsights: {
              behavioral: 'No matching subjects were detected in the video.',
              movement: 'N/A',
              observations: 'Try uploading a different reference image or adjust your search parameters.'
            },
            additionalMatches: []
          }
        });
      }

      // Get the first person track (primary result)
      const primaryResult = results.find(r => {
        const metadata = typeof r.match_metadata === 'string' 
          ? JSON.parse(r.match_metadata) 
          : r.match_metadata;
        return metadata.track_type === 'person' || (metadata.track_id && metadata.track_id.startsWith('person'));
      }) || results[0]; // Fallback to first result if no person found

      if (!primaryResult) {
        return res.status(404).json({
          success: false,
          message: 'No results found'
        });
      }

      const primaryMetadata = typeof primaryResult.match_metadata === 'string'
        ? JSON.parse(primaryResult.match_metadata)
        : primaryResult.match_metadata;

      // Handle both old format (avg_confidence, first_appearance_time) and new format (similarity_score, start_time)
      const confidence = primaryMetadata.similarity_score || primaryMetadata.avg_confidence || parseFloat(primaryResult.score) || 0;
      const startTime = primaryMetadata.start_time || primaryMetadata.first_appearance_time || primaryResult.video_timestamp || '0:00';
      const endTime = primaryMetadata.end_time || primaryMetadata.last_appearance_time || startTime;
      
      let finalEndTime = primaryMetadata.last_appearance_time || endTime;
      if (primaryMetadata.reappearances && primaryMetadata.reappearances.length > 0) {
        const lastReapp = primaryMetadata.reappearances[primaryMetadata.reappearances.length - 1];
        finalEndTime = lastReapp.end_time || lastReapp.endTime || finalEndTime;
      }
      
      const numFrames = primaryMetadata.num_frames || primaryMetadata.appearance_count || 1;

      // Fetch video record for metadata (duration, resolution, format)
      const video = await Video.findById(search.query_video_id);

      // Format for Analysis component
      const analysisData = {
        videoId: search.query_video_id, // Include videoId for post-processing queries
        videoInfo: video ? {
          duration: video.duration || null,
          resolution: video.resolution || null,
          originalName: video.original_name || null,
          fileName: video.file_name || null,
          format: video.original_name ? video.original_name.split('.').pop().toUpperCase() : 'MP4',
          fileSize: video.file_size || null,
        } : null,
        personResult: true,
        detectionInfo: {
          timeZone: {
            start: startTime,
            end: endTime
          },
          upperClothing: {
            color: primaryMetadata.upper_color || primaryMetadata.attributes?.upper_clothing?.color || 'Unknown',
            type: primaryMetadata.attributes?.upper_clothing?.type || 'Unknown'
          },
          lowerClothing: {
            color: (() => {
              const color = primaryMetadata.lower_color || primaryMetadata.attributes?.lower_clothing?.color;
              return (!color || color === 'Unknown') ? 'Not visible' : color;
            })(),
            type: primaryMetadata.attributes?.lower_clothing?.type || 'Unknown'
          },
          objectCarried: primaryMetadata.object_carried || primaryMetadata.attributes?.carried_objects?.[0]?.type || 'None',
          gender: {
            type: primaryMetadata.person_gender || primaryMetadata.attributes?.gender?.type || 'Unknown',
            confidence: primaryMetadata.attributes?.gender?.confidence 
              ? `${(primaryMetadata.attributes.gender.confidence * 100).toFixed(1)}% Conf.`
              : 'N/A'
          },
          embeddingConfidence: `${(confidence * 100).toFixed(1)}%`
        },
        timeline: {
          // Build segments: each has a start (arrival) and end (departure) marker
          segments: (() => {
            const segments = [];
            const totalSegments = 1 + (primaryMetadata.reappearances?.length || 0);
            const segmentWidth = 80 / totalSegments; // distribute across 10%–90%

            // First appearance segment
            segments.push({
              startTime: startTime,
              endTime: endTime,
              startPosition: 10,
              endPosition: 10 + segmentWidth * 0.8
            });

            // Reappearance segments
            if (primaryMetadata.reappearances && primaryMetadata.reappearances.length > 0) {
              primaryMetadata.reappearances.forEach((reapp, index) => {
                const basePos = 10 + (index + 1) * segmentWidth;
                segments.push({
                  startTime: reapp.start_time || 'N/A',
                  endTime: reapp.end_time || 'N/A',
                  startPosition: basePos,
                  endPosition: basePos + segmentWidth * 0.8
                });
              });
            }
            return segments;
          })()
        
        },
        appearances: {
          first: startTime,
          last: finalEndTime,
          total: primaryMetadata.total_appearances || (primaryMetadata.reappearances?.length || 0) + 1, // Number of times person appeared (reappearances + 1)
          numFrames: numFrames, // Total frames detected
          confidence: `${(confidence * 100).toFixed(1)}%`
        },
        aiInsights: {
          behavioral: `Subject detected across ${primaryMetadata.total_appearances || numFrames} different time segments.`,
          movement: `First detected at ${startTime}, last seen at ${finalEndTime}.`,
          observations: `Match confidence: ${(confidence * 100).toFixed(1)}%. Total frames: ${numFrames}.`
        },
        additionalMatches: results.slice(1, 4).map((result, index) => {
          const metadata = typeof result.match_metadata === 'string'
            ? JSON.parse(result.match_metadata)
            : result.match_metadata;
          
          const matchConfidence = metadata.similarity_score || metadata.avg_confidence || parseFloat(result.score) || 0;
          const matchTime = metadata.start_time || metadata.first_appearance_time || result.video_timestamp || '0:00';
          
          return {
            result_id: result.result_id,
            rank: index + 2,
            thumbnail: null, // Skip for now
            confidence: `${(matchConfidence * 100).toFixed(1)}%`,
            timeFound: matchTime,
            // Include full metadata for when user clicks on the match
            metadata: {
              track_id: metadata.track_id,
              start_time: metadata.start_time,
              end_time: metadata.end_time,
              num_frames: metadata.num_frames,
              person_gender: metadata.person_gender,
              upper_color: metadata.upper_color,
              lower_color: metadata.lower_color,
              attributes: metadata.attributes,
              object_carried: metadata.object_carried,
              has_reappearance: metadata.has_reappearance,
              reappearances: metadata.reappearances,
              similarity_score: metadata.similarity_score
            }
          };
        })
      };

      res.json({
        success: true,
        data: analysisData
      });

    } catch (error) {
      console.error('Error formatting analysis data:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to format analysis data',
        error: error.message
      });
    }
  }

  /**
   * Get all detections (persons + objects) from Qdrant for Detection Summary page
   */
  static async getAllDetections(req, res) {
    try {
      const { videoId } = req.params;
      const { page = 1, limit = 20, type = 'all' } = req.query;

      console.log('[getAllDetections] Called with videoId:', videoId, 'type:', type);

      if (!videoId) {
        return res.status(400).json({
          success: false,
          message: 'Missing videoId parameter'
        });
      }

      // Import Qdrant client
      const { QdrantClient } = await import('@qdrant/js-client-rest');
      
      const qdrantUrl = process.env.QDRANT_URL || 'http://localhost:6333';
      console.log('[getAllDetections] Connecting to Qdrant at:', qdrantUrl);
      const client = new QdrantClient({ url: qdrantUrl });

      const persons = [];
      const objects = [];

      // Fetch person tracks from Qdrant
      if (type === 'all' || type === 'persons') {
        try {
          const personResults = await client.scroll('person_tracks', {
            filter: {
              must: [
                { key: 'video_id', match: { value: parseInt(videoId) } }
              ]
            },
            limit: 100,
            with_payload: true,
            with_vectors: false
          });

          if (personResults.points) {
            personResults.points.forEach((point, index) => {
              const payload = point.payload || {};
              persons.push({
                id: point.id,
                personId: `Person-${String(payload.track_id || index + 1).padStart(3, '0')}`,
                trackId: payload.track_id,
                timeOfAppearance: payload.start_time || 'N/A',
                endTime: payload.end_time || 'N/A',
                clothingColors: {
                  upper: payload.upper_color || 'Unknown',
                  lower: payload.lower_color || 'Unknown'
                },
                objectCarried: Array.isArray(payload.object_carried) 
                  ? payload.object_carried.join(', ') || 'None'
                  : payload.object_carried || 'None',
                attributes: payload.attributes || {},
                numFrames: payload.num_frames || 0,
                confidence: payload.avg_confidence 
                  ? `${(payload.avg_confidence * 100).toFixed(1)}%`
                  : 'N/A',
                verified: payload.verified || false,
                gender: payload.person_gender || payload.attributes?.gender?.type || 'Unknown',
                hasReappearance: payload.has_reappearance || false,
                totalAppearances: payload.total_appearances || 1,
                reappearances: payload.reappearances || [],
                mergedTrackIds: payload.merged_track_ids || []
              });
            });
          }
        } catch (e) {
          console.error('Error fetching person tracks from Qdrant:', e);
        }
      }

      // Fetch object tracks from Qdrant
      if (type === 'all' || type === 'objects') {
        try {
          const objectResults = await client.scroll('object_tracks', {
            filter: {
              must: [
                { key: 'video_id', match: { value: parseInt(videoId) } }
              ]
            },
            limit: 100,
            with_payload: true,
            with_vectors: false
          });

          if (objectResults.points) {
            objectResults.points.forEach((point, index) => {
              const payload = point.payload || {};
              objects.push({
                id: point.id,
                objectId: `Object-${String(payload.track_id || index + 1).padStart(3, '0')}`,
                trackId: payload.track_id,
                objectName: payload.object_type || payload.object_class || 'Unknown Object',
                timeOfAppearance: payload.start_time || payload.first_appearance_time || 'N/A',
                endTime: payload.end_time || payload.last_appearance_time || 'N/A',
                color: payload.object_color || 'Unknown',
                carriedBy: payload.carried_by_person_id 
                  ? `Person-${String(payload.carried_by_person_id).padStart(3, '0')}`
                  : 'N/A',
                numFrames: payload.num_frames || 0,
                confidence: payload.avg_confidence 
                  ? `${(payload.avg_confidence * 100).toFixed(1)}%`
                  : 'N/A'
              });
            });
          }
        } catch (e) {
          console.error('Error fetching object tracks from Qdrant:', e);
        }
      }

      // Sort by time of appearance
      persons.sort((a, b) => {
        if (a.timeOfAppearance === 'N/A') return 1;
        if (b.timeOfAppearance === 'N/A') return -1;
        return a.timeOfAppearance.localeCompare(b.timeOfAppearance);
      });

      objects.sort((a, b) => {
        if (a.timeOfAppearance === 'N/A') return 1;
        if (b.timeOfAppearance === 'N/A') return -1;
        return a.timeOfAppearance.localeCompare(b.timeOfAppearance);
      });

      res.json({
        success: true,
        data: {
          videoId: parseInt(videoId),
          summary: {
            totalPersons: persons.length,
            totalObjects: objects.length
          },
          persons,
          objects
        }
      });

    } catch (error) {
      console.error('Error fetching detections from Qdrant:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch detections',
        error: error.message
      });
    }
  }

  /**
   * Post-processing query - search already processed video data in Qdrant
   * Uses CLIP embeddings via Python text query service for semantic search
   */
  static async postProcessingQuery(req, res) {
    try {
      const { videoId } = req.params;
      const { queryText, queryType = 'text', topK = 10 } = req.body;

      console.log('[postProcessingQuery] Called with videoId:', videoId, 'queryText:', queryText, 'queryType:', queryType);

      if (!videoId) {
        return res.status(400).json({
          success: false,
          message: 'Missing videoId parameter'
        });
      }

      if (!queryText && queryType === 'text') {
        return res.status(400).json({
          success: false,
          message: 'Missing queryText for text query'
        });
      }

      // Call unified Python query service for CLIP-based semantic search
      const queryServiceUrl = process.env.QUERY_SERVICE_URL || process.env.IMAGE_QUERY_SERVICE_URL || 'http://localhost:5001';
      
      try {
        const axios = (await import('axios')).default;
        const response = await axios.post(`${queryServiceUrl}/query/text`, {
          text: queryText,
          video_id: videoId,
          top_k: topK
        }, {
          timeout: 30000 // 30 second timeout
        });

        if (response.data.success) {
          return res.json({
            success: true,
            data: {
              query: queryText,
              queryType,
              videoId: parseInt(videoId),
              summary: response.data.summary,
              results: response.data.results
            }
          });
        } else {
          throw new Error(response.data.error || 'Text query failed');
        }
      } catch (serviceError) {
        console.error('Query service (text) error:', serviceError.message);
        
        // Check if it's a connection error to the Python service
        if (serviceError.code === 'ECONNREFUSED') {
          return res.status(503).json({
            success: false,
            message: 'Query service is not available. Please ensure the Python query service is running.',
            error: 'Service unavailable'
          });
        }
        
        throw serviceError;
      }

    } catch (error) {
      console.error('Error in post-processing query:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to execute post-processing query',
        error: error.message
      });
    }
  }

  /**
   * Legacy attribute-based query (kept for fallback/debugging)
   * This is the old implementation without CLIP
   */
  static async postProcessingQueryLegacy(req, res) {
    try {
      const { videoId } = req.params;
      const { queryText, queryType = 'text', topK = 10 } = req.body;

      // Import Qdrant client
      const { QdrantClient } = await import('@qdrant/js-client-rest');
      
      const qdrantUrl = process.env.QDRANT_URL || 'http://localhost:6333';
      const client = new QdrantClient({ url: qdrantUrl });
      
      const results = {
        persons: [],
        objects: []
      };

      // Parse the query text to extract search criteria
      const queryLower = queryText.toLowerCase();
      
      // Build filter conditions based on query text
      const personFilters = [];
      const objectFilters = [];
      
      // Color keywords
      const colors = ['red', 'blue', 'green', 'black', 'white', 'yellow', 'orange', 'purple', 'pink', 'brown', 'gray', 'grey'];
      const detectedColors = colors.filter(c => queryLower.includes(c));
      
      // Object keywords
      const objectKeywords = [
        'bag', 'backpack', 'laptop', 'phone', 'mobile', 'mobile phone', 'cell', 'cellphone', 'cell phone',
        'suitcase', 'handbag', 'purse', 'helmet', 'bottle'
      ];
      const detectedObjects = objectKeywords.filter(o => queryLower.includes(o));
      
      // Clothing keywords
      const hasUpperClothing = queryLower.includes('shirt') || queryLower.includes('jacket') || queryLower.includes('top') || queryLower.includes('hoodie');
      const hasLowerClothing = queryLower.includes('pants') || queryLower.includes('jeans') || queryLower.includes('shorts') || queryLower.includes('skirt');

      const personIndicators = ['person', 'people', 'man', 'woman', 'guy', 'girl', 'boy', 'child', 'individual'];
      const hasPersonIndicator = personIndicators.some(term => queryLower.includes(term));
      const objectOnlyQuery = detectedObjects.length > 0 && !hasUpperClothing && !hasLowerClothing && !hasPersonIndicator;

      const normalizeObjectToken = (token) => {
        if (!token) return '';
        const t = token.toLowerCase();
        if (t.includes('cell') || t.includes('mobile') || t.includes('phone')) return 'phone';
        if (t.includes('handbag') || t.includes('purse')) return 'handbag';
        return t;
      };

      const detectedObjectTokens = new Set(detectedObjects.map(normalizeObjectToken));

      const matchesObjectType = (objectType) => {
        const type = normalizeObjectToken(objectType || '');
        if (!type) return false;
        if (detectedObjectTokens.has(type)) return true;
        return [...detectedObjectTokens].some(token => type.includes(token) || token.includes(type));
      };

      // Search person_tracks (skip for object-only queries)
      if (!objectOnlyQuery) {
        try {
          // Build scroll filter
          const mustConditions = [
            { key: 'video_id', match: { value: parseInt(videoId) } }
          ];

          // Add color filter if detected
          if (detectedColors.length > 0 && (hasUpperClothing || (!hasUpperClothing && !hasLowerClothing))) {
            // Search upper_color
            mustConditions.push({
              key: 'upper_color',
              match: { any: detectedColors }
            });
          }
          
          if (detectedColors.length > 0 && hasLowerClothing) {
            // Search lower_color
            mustConditions.push({
              key: 'lower_color',
              match: { any: detectedColors }
            });
          }

          const personResults = await client.scroll('person_tracks', {
            filter: {
              must: mustConditions
            },
            limit: topK,
            with_payload: true,
            with_vectors: false
          });

          if (personResults.points) {
            // Score results based on query match
            personResults.points.forEach((point, index) => {
              const payload = point.payload || {};
              let score = 0.5; // Base score
              
              // Boost score based on matches
              if (detectedColors.includes(payload.upper_color?.toLowerCase())) score += 0.2;
              if (detectedColors.includes(payload.lower_color?.toLowerCase())) score += 0.2;
              
              // Check carried objects
              const carried = Array.isArray(payload.object_carried) ? payload.object_carried : [payload.object_carried];
              for (const obj of detectedObjects) {
                if (carried.some(c => c?.toLowerCase()?.includes(obj))) {
                  score += 0.15;
                }
              }

              results.persons.push({
                id: point.id,
                trackId: payload.track_id,
                personId: `Person-${String(payload.track_id || index + 1).padStart(3, '0')}`,
                score: Math.min(score, 1.0),
                confidence: `${(Math.min(score, 1.0) * 100).toFixed(1)}%`,
                timeOfAppearance: payload.start_time || 'N/A',
                endTime: payload.end_time || 'N/A',
                clothingColors: {
                  upper: payload.upper_color || 'Unknown',
                  lower: payload.lower_color || 'Unknown'
                },
                objectCarried: Array.isArray(payload.object_carried) 
                  ? payload.object_carried.join(', ') || 'None'
                  : payload.object_carried || 'None',
                numFrames: payload.num_frames || 0
              });
            });
          }
        } catch (e) {
          console.error('Error searching person_tracks:', e);
        }
      }

      // Search object_tracks if object keywords detected
      if (detectedObjects.length > 0) {
        try {
          const objectResults = await client.scroll('object_tracks', {
            filter: {
              must: [
                { key: 'video_id', match: { value: parseInt(videoId) } }
              ]
            },
            limit: topK,
            with_payload: true,
            with_vectors: false
          });

          if (objectResults.points) {
            objectResults.points.forEach((point, index) => {
              const payload = point.payload || {};
              const objType = payload.object_type?.toLowerCase() || '';
              
              // Only include if matches query
              if (matchesObjectType(objType)) {
                let score = 0.7; // Base score for matching object type
                
                if (detectedColors.includes(payload.object_color?.toLowerCase())) {
                  score += 0.2;
                }

                results.objects.push({
                  id: point.id,
                  trackId: payload.track_id,
                  objectId: `Object-${String(payload.track_id || index + 1).padStart(3, '0')}`,
                  objectName: payload.object_type || 'Unknown',
                  score: Math.min(score, 1.0),
                  confidence: `${(Math.min(score, 1.0) * 100).toFixed(1)}%`,
                  timeOfAppearance: payload.start_time || payload.first_appearance_time || 'N/A',
                  endTime: payload.end_time || payload.last_appearance_time || 'N/A',
                  color: payload.object_color || 'Unknown',
                  numFrames: payload.num_frames || 0
                });
              }
            });
          }
        } catch (e) {
          console.error('Error searching object_tracks:', e);
        }
      }

      // Fallback: if object-only query returned no objects, try unfiltered object scan for this video
      if (objectOnlyQuery && results.objects.length === 0) {
        try {
          const fallbackResults = await client.scroll('object_tracks', {
            filter: {
              must: [
                { key: 'video_id', match: { value: parseInt(videoId) } }
              ]
            },
            limit: topK,
            with_payload: true,
            with_vectors: false
          });

          if (fallbackResults.points) {
            fallbackResults.points.forEach((point, index) => {
              const payload = point.payload || {};
              const objType = payload.object_type?.toLowerCase() || '';
              if (!matchesObjectType(objType)) return;

              let score = 0.6;
              if (detectedColors.includes(payload.object_color?.toLowerCase())) {
                score += 0.2;
              }

              results.objects.push({
                id: point.id,
                trackId: payload.track_id,
                objectId: `Object-${String(payload.track_id || index + 1).padStart(3, '0')}`,
                objectName: payload.object_type || 'Unknown',
                score: Math.min(score, 1.0),
                confidence: `${(Math.min(score, 1.0) * 100).toFixed(1)}%`,
                timeOfAppearance: payload.start_time || payload.first_appearance_time || 'N/A',
                endTime: payload.end_time || payload.last_appearance_time || 'N/A',
                color: payload.object_color || 'Unknown',
                numFrames: payload.num_frames || 0
              });
            });
          }
        } catch (e) {
          console.error('Error in object-only fallback search:', e);
        }
      }

      // Sort results by score
      results.persons.sort((a, b) => b.score - a.score);
      results.objects.sort((a, b) => b.score - a.score);

      res.json({
        success: true,
        data: {
          query: queryText,
          queryType,
          videoId: parseInt(videoId),
          summary: {
            totalPersonsFound: results.persons.length,
            totalObjectsFound: results.objects.length
          },
          results
        }
      });

    } catch (error) {
      console.error('Error in post-processing query:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to execute post-processing query',
        error: error.message
      });
    }
  }

  /**
   * Post-processing image query - search by face image
   * Calls Python image query service to extract face embeddings and search Qdrant
   */
  static async postProcessingImageQuery(req, res) {
    try {
      const { videoId } = req.params;
      const { topK = 10 } = req.body;

      console.log('[postProcessingImageQuery] Called with videoId:', videoId);

      if (!videoId) {
        return res.status(400).json({
          success: false,
          message: 'Missing videoId parameter'
        });
      }

      // Check if image file was uploaded
      if (!req.file) {
        return res.status(400).json({
          success: false,
          message: 'No image file uploaded'
        });
      }

      console.log('[postProcessingImageQuery] Image received:', req.file.originalname, req.file.size, 'bytes');

      // Call unified Python query service
      const queryServiceUrl = process.env.QUERY_SERVICE_URL || process.env.IMAGE_QUERY_SERVICE_URL || 'http://localhost:5001';
      
      // Create form data to send to Python service
      const FormData = (await import('form-data')).default;
      const formData = new FormData();
      formData.append('image', req.file.buffer, {
        filename: req.file.originalname,
        contentType: req.file.mimetype
      });
      formData.append('video_id', videoId);
      formData.append('top_k', topK.toString());

      // Make request to Python service
      const axios = (await import('axios')).default;
      const response = await axios.post(`${queryServiceUrl}/query/image`, formData, {
        headers: formData.getHeaders(),
        timeout: 30000 // 30 second timeout
      });

      if (response.data.success) {
        res.json({
          success: true,
          data: response.data
        });
      } else {
        res.status(400).json({
          success: false,
          message: response.data.error || 'Image query failed'
        });
      }

    } catch (error) {
      console.error('Error in post-processing image query:', error);
      
      // Check if it's a connection error to the Python service
      if (error.code === 'ECONNREFUSED') {
        return res.status(503).json({
          success: false,
          message: 'Query service is not available. Please ensure the Python query service is running.',
          error: 'Service unavailable'
        });
      }

      res.status(500).json({
        success: false,
        message: 'Failed to execute image query',
        error: error.message
      });
    }
  }
}
