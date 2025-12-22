import express from 'express';
import VideoMetadata from '../models/mongodb/VideoMetadata.js';
import { Video } from '../models/Video.js';

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
  try {
    const { video_id, stage, message, status = 'info', error, workflow_id, workflow_run_id, details } = req.body || {};
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

    // Optionally update Postgres video status when stage changes
    if (stage === 'completed') {
      await Video.updateStatus(video_id, 'completed');
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
