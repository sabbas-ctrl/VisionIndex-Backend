/**
 * Temporal Client Integration for Backend
 * 
 * This module provides functions to interact with Temporal workflows
 * from the Node.js backend.
 */

import { Client, Connection } from '@temporalio/client';

// Temporal configuration
const TEMPORAL_HOST = process.env.TEMPORAL_HOST || 'localhost:7233';
const TASK_QUEUE = 'video-processing-task-queue';

let temporalClient = null;

/**
 * Initialize Temporal client connection
 * Call this once at application startup
 */
export async function initializeTemporalClient() {
  try {
    console.log(`Connecting to Temporal server at ${TEMPORAL_HOST}...`);
    
    const connection = await Connection.connect({
      address: TEMPORAL_HOST,
    });
    
    temporalClient = new Client({
      connection,
      namespace: 'default',
    });
    
    console.log('✅ Temporal client initialized successfully');
    return temporalClient;
    
  } catch (error) {
    console.error('❌ Failed to initialize Temporal client:', error.message);
    console.error('Make sure Temporal server is running:');
    console.error('  docker run -p 7233:7233 temporalio/auto-setup:latest');
    throw error;
  }
}

/**
 * Get or create Temporal client
 */
export async function getTemporalClient() {
  if (!temporalClient) {
    temporalClient = await initializeTemporalClient();
  }
  return temporalClient;
}

/**
 * Start video processing workflow
 * 
 * @param {Object} videoData - Video information
 * @param {number} videoData.video_id - Video ID from database
 * @param {string} videoData.file_name - S3 file key
 * @param {string} videoData.original_name - Original filename
 * @param {number} videoData.uploader_id - User ID
 * @param {string} videoData.storage_path - Full S3 URL
 * @returns {Promise<Object>} Workflow handle
 */
export async function startVideoProcessingWorkflow(videoData) {
  try {
    const client = await getTemporalClient();
    
    const workflowId = `video-processing-${videoData.video_id}`;
    
    console.log(`🚀 Starting video processing workflow for video_id: ${videoData.video_id}`);
    console.log(`   Workflow ID: ${workflowId}`);
    console.log(`   File: ${videoData.file_name}`);
    
    // Start workflow
    const handle = await client.workflow.start('VideoProcessingWorkflow', {
      workflowId: workflowId,
      taskQueue: TASK_QUEUE,
      args: [videoData],
      // Workflow timeout: 4 hours (for very large videos)
      workflowExecutionTimeout: '4h',
    });
    
    console.log(`✅ Workflow started successfully`);
    console.log(`   Workflow ID: ${handle.workflowId}`);
    console.log(`   Run ID: ${handle.firstExecutionRunId}`);
    
    return {
      workflowId: handle.workflowId,
      runId: handle.firstExecutionRunId,
      status: 'started',
    };
    
  } catch (error) {
    console.error(`❌ Failed to start workflow for video_id ${videoData.video_id}:`, error);
    throw error;
  }
}

/**
 * Get workflow status
 * 
 * @param {string} workflowId - Workflow ID
 * @returns {Promise<Object>} Workflow status
 */
export async function getWorkflowStatus(workflowId) {
  try {
    const client = await getTemporalClient();
    
    const handle = client.workflow.getHandle(workflowId);
    const description = await handle.describe();
    
    return {
      workflowId: description.workflowId,
      runId: description.runId,
      status: description.status.name,
      startTime: description.startTime,
      closeTime: description.closeTime,
    };
    
  } catch (error) {
    console.error(`Error getting workflow status for ${workflowId}:`, error);
    throw error;
  }
}

/**
 * Get workflow result
 * 
 * @param {string} workflowId - Workflow ID
 * @returns {Promise<Object>} Workflow result
 */
export async function getWorkflowResult(workflowId) {
  try {
    const client = await getTemporalClient();
    
    const handle = client.workflow.getHandle(workflowId);
    const result = await handle.result();
    
    return result;
    
  } catch (error) {
    console.error(`Error getting workflow result for ${workflowId}:`, error);
    throw error;
  }
}

/**
 * Cancel workflow
 * 
 * @param {string} workflowId - Workflow ID
 * @returns {Promise<void>}
 */
export async function cancelWorkflow(workflowId) {
  try {
    const client = await getTemporalClient();
    
    const handle = client.workflow.getHandle(workflowId);
    await handle.cancel();
    
    console.log(`✅ Workflow ${workflowId} cancelled successfully`);
    
  } catch (error) {
    console.error(`Error cancelling workflow ${workflowId}:`, error);
    throw error;
  }
}

/**
 * Start batch video processing workflow
 * 
 * @param {Array<Object>} videoList - Array of video data objects
 * @returns {Promise<Object>} Workflow handle
 */
export async function startBatchVideoProcessingWorkflow(videoList) {
  try {
    const client = await getTemporalClient();
    
    const workflowId = `batch-video-processing-${Date.now()}`;
    
    console.log(`🚀 Starting batch video processing workflow for ${videoList.length} videos`);
    
    const handle = await client.workflow.start('BatchVideoProcessingWorkflow', {
      workflowId: workflowId,
      taskQueue: TASK_QUEUE,
      args: [videoList],
      workflowExecutionTimeout: '24h', // 24 hours for batch processing
    });
    
    console.log(`✅ Batch workflow started: ${handle.workflowId}`);
    
    return {
      workflowId: handle.workflowId,
      runId: handle.firstExecutionRunId,
      status: 'started',
      videoCount: videoList.length,
    };
    
  } catch (error) {
    console.error('❌ Failed to start batch workflow:', error);
    throw error;
  }
}

/**
 * Start video reprocessing workflow
 * 
 * @param {Object} videoData - Video information
 * @returns {Promise<Object>} Workflow handle
 */
export async function startVideoReprocessingWorkflow(videoData) {
  try {
    const client = await getTemporalClient();
    
    const workflowId = `video-reprocessing-${videoData.video_id}-${Date.now()}`;
    
    console.log(`🔄 Starting video reprocessing workflow for video_id: ${videoData.video_id}`);
    
    const handle = await client.workflow.start('VideoReprocessingWorkflow', {
      workflowId: workflowId,
      taskQueue: TASK_QUEUE,
      args: [videoData],
      workflowExecutionTimeout: '4h',
    });
    
    console.log(`✅ Reprocessing workflow started: ${handle.workflowId}`);
    
    return {
      workflowId: handle.workflowId,
      runId: handle.firstExecutionRunId,
      status: 'started',
    };
    
  } catch (error) {
    console.error(`❌ Failed to start reprocessing workflow for video_id ${videoData.video_id}:`, error);
    throw error;
  }
}

export default {
  initializeTemporalClient,
  getTemporalClient,
  startVideoProcessingWorkflow,
  getWorkflowStatus,
  getWorkflowResult,
  cancelWorkflow,
  startBatchVideoProcessingWorkflow,
  startVideoReprocessingWorkflow,
};
