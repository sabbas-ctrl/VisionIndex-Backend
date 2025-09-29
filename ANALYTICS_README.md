# VisionIndex Analytics & Dashboard System

## Overview

The VisionIndex Analytics system provides comprehensive data collection, processing, and visualization for the video surveillance and AI-powered search platform. It consists of three main databases working together to provide real-time analytics, historical data, and intelligent insights.

## Architecture

### Database Schema

#### PostgreSQL (Primary Database)
- **User Management**: Users, roles, permissions, sessions
- **Video Management**: Videos, video segments, upload sessions
- **Search System**: Search sessions, searches, search results, filters
- **Analytics**: Detection events, analytics aggregations, system metrics
- **Interactions**: Result interactions, saved searches, bookmarked results

#### MongoDB (Document Store)
- **Video Processing**: AI pipeline metadata, detected objects, embeddings
- **System Logs**: High-volume unstructured logs and events
- **Flags**: Dynamic anomalies and alerts
- **Search Analysis**: Query parsing and AI suggestions
- **Vector Embeddings**: Face and object recognition vectors

#### Vector Database (Future Integration)
- **Similarity Search**: Fast vector similarity queries
- **Face Recognition**: Face embedding storage and retrieval
- **Object Recognition**: Object embedding storage and retrieval

## Key Features

### Dashboard Analytics
- **Real-time Metrics**: Live detection counts, search statistics
- **Time-based Analysis**: Hourly, daily, weekly, monthly trends
- **Object Classification**: Person, vehicle, face, object detection breakdown
- **User Activity**: Search patterns, usage statistics
- **System Performance**: Processing times, system health metrics

### Search History
- **Comprehensive Logging**: All search queries and results
- **Advanced Filtering**: By date range, user role, result status
- **Export Functionality**: JSON/CSV export of search data
- **Pagination**: Efficient handling of large datasets

### Data Aggregation
- **Automated Jobs**: Hourly analytics calculation
- **Real-time Processing**: 15-minute detection event aggregation
- **System Monitoring**: 5-minute system metrics collection
- **Performance Optimization**: Pre-computed aggregations for fast queries

## API Endpoints

### Dashboard
```
GET /api/analytics/dashboard?timeRange=7d
```
Returns comprehensive dashboard metrics including:
- Detection statistics by hour
- Object type distribution
- User activity metrics
- System performance data

### Search History
```
GET /api/analytics/search-history?page=1&limit=8&dateRange=Today&userRole=All Roles&resultStatus=All Results&userId=1
```
Returns paginated search history with filtering options.

### Export
```
GET /api/analytics/export?format=json&timeRange=7d
```
Exports analytics data in JSON or CSV format.

### Metrics Calculation
```
POST /api/analytics/calculate-metrics
```
Triggers manual calculation of analytics metrics (admin only).

## Database Tables

### Core Analytics Tables

#### `upload_sessions`
Tracks video upload and processing pipeline status
- `upload_session_id` (UUID, Primary Key)
- `user_id` (Foreign Key to users)
- `video_id` (Foreign Key to videos)
- `status` (uploading, processing, completed, failed)
- `processing_started`, `processing_completed` (timestamps)
- `metadata` (JSONB for additional data)

#### `search_sessions`
Groups related searches into chat-like sessions
- `session_id` (UUID, Primary Key)
- `user_id` (Foreign Key to users)
- `title` (session title)
- `created_at`, `updated_at` (timestamps)

#### `searches`
Individual search queries with metadata
- `search_id` (Serial, Primary Key)
- `user_id` (Foreign Key to users)
- `search_session_id` (Foreign Key to search_sessions)
- `query_text` (search query text)
- `query_type` (text, image, face, vehicle)
- `query_vector_id` (pointer to vector DB)
- `query_metadata` (JSONB for preprocessing info)

#### `search_results`
Search results linking to videos/segments
- `result_id` (Serial, Primary Key)
- `search_id` (Foreign Key to searches)
- `video_id` (Foreign Key to videos)
- `segment_id` (Foreign Key to video_segments)
- `score` (similarity score)
- `thumbnail_url` (result thumbnail)
- `video_timestamp` (timestamp in video)
- `match_metadata` (JSONB for bounding box, confidence)

#### `detection_events`
Individual detection events from AI pipeline
- `event_id` (BigSerial, Primary Key)
- `video_id` (Foreign Key to videos)
- `segment_id` (Foreign Key to video_segments)
- `detection_type` (person, vehicle, face, object)
- `confidence_score` (AI confidence)
- `bounding_box` (JSONB for coordinates)
- `attributes` (JSONB for clothing, age, gender)
- `timestamp_in_video` (interval)

#### `analytics_aggregations`
Pre-computed analytics for dashboard performance
- `aggregation_id` (Serial, Primary Key)
- `metric_name` (metric identifier)
- `metric_type` (counter, gauge, histogram)
- `time_bucket` (timestamp)
- `time_granularity` (hour, day, week, month)
- `value` (metric value)
- `metadata` (JSONB for additional data)

### MongoDB Collections

#### `video_processing`
AI pipeline processing metadata
- `video_id` (reference to PostgreSQL)
- `processing_stage` (preprocessing, object_detection, face_recognition, etc.)
- `frames_analyzed` (number of processed frames)
- `detected_objects` (array of detection objects)
- `embeddings` (vector data references)
- `additional_metadata` (motion heatmap, anomaly scores)

#### `search_query_analysis`
Query parsing and AI suggestions
- `search_id` (reference to PostgreSQL)
- `query_text` (original query)
- `parsed_attributes` (extracted attributes)
- `query_embedding_metadata` (vector model info)
- `similar_past_searches` (related searches)
- `ai_suggestions` (AI-generated suggestions)

#### `vector_embeddings`
Face and object recognition vectors
- `vector_id` (unique identifier)
- `video_id` (reference to PostgreSQL)
- `embedding_type` (face, object, scene, person, vehicle)
- `model_name` (AI model used)
- `embedding_vector` (actual vector data)
- `confidence_score` (AI confidence)
- `metadata` (bounding box, attributes, quality)

## Data Flow

### 1. Video Upload & Processing
1. Video uploaded → `upload_sessions` table
2. AI pipeline processes video → `video_processing` collection
3. Detection events created → `detection_events` table
4. Vector embeddings stored → `vector_embeddings` collection

### 2. Search Operations
1. User performs search → `searches` table
2. Query analyzed → `search_query_analysis` collection
3. Vector similarity search → Vector DB
4. Results stored → `search_results` table
5. User interactions logged → `result_interactions` table

### 3. Analytics Processing
1. Detection events aggregated → `analytics_aggregations` table
2. System metrics collected → `system_metrics` table
3. Dashboard queries → Pre-computed aggregations
4. Real-time updates → Live data queries

## Performance Optimizations

### Indexing Strategy
- **Primary Keys**: All tables have appropriate primary keys
- **Foreign Keys**: Indexed for join performance
- **Time-based Queries**: Indexes on timestamp columns
- **Search Queries**: Indexes on query_type, detection_type
- **Vector Queries**: Specialized indexes for similarity search

### Aggregation Strategy
- **Pre-computed Metrics**: Hourly/daily aggregations
- **Real-time Updates**: Live data for current period
- **Caching**: Frequently accessed metrics cached
- **Batch Processing**: Bulk operations for large datasets

### Query Optimization
- **Pagination**: Efficient LIMIT/OFFSET queries
- **Filtering**: Indexed WHERE clauses
- **Joins**: Optimized join strategies
- **Subqueries**: Minimized nested queries

## Monitoring & Maintenance

### Automated Jobs
- **Analytics Calculation**: Every hour
- **Detection Aggregation**: Every 15 minutes
- **System Metrics**: Every 5 minutes
- **Token Cleanup**: Daily

### Health Checks
- **Database Connections**: PostgreSQL and MongoDB
- **Job Status**: Cron job monitoring
- **API Endpoints**: Health check endpoints
- **Performance Metrics**: Query performance monitoring

### Data Retention
- **Raw Data**: 90 days (configurable)
- **Aggregated Data**: 2 years
- **Logs**: 30 days
- **Vector Data**: Indefinite (for search functionality)

## Security Considerations

### Data Protection
- **Encryption**: Sensitive data encrypted at rest
- **Access Control**: Role-based permissions
- **Audit Logging**: All operations logged
- **Data Anonymization**: PII protection

### API Security
- **Authentication**: JWT token validation
- **Authorization**: Role-based access control
- **Rate Limiting**: API rate limiting
- **Input Validation**: Comprehensive input sanitization

## Future Enhancements

### Planned Features
- **Real-time Dashboard**: WebSocket updates
- **Advanced Analytics**: Machine learning insights
- **Custom Dashboards**: User-configurable views
- **Data Visualization**: Interactive charts and graphs
- **Alert System**: Automated anomaly detection
- **API Versioning**: Backward compatibility
- **Caching Layer**: Redis integration
- **Load Balancing**: Horizontal scaling

### Integration Points
- **Vector Database**: Pinecone/Weaviate integration
- **Message Queue**: Redis/RabbitMQ for async processing
- **Monitoring**: Prometheus/Grafana integration
- **Logging**: ELK stack integration
- **CDN**: Static asset delivery
- **Backup**: Automated backup system

## Development Guidelines

### Code Structure
- **Models**: Database abstraction layer
- **Controllers**: Business logic layer
- **Routes**: API endpoint definitions
- **Middleware**: Authentication and validation
- **Jobs**: Background processing
- **Utils**: Helper functions

### Testing Strategy
- **Unit Tests**: Individual function testing
- **Integration Tests**: API endpoint testing
- **Performance Tests**: Load and stress testing
- **Security Tests**: Vulnerability assessment

### Deployment
- **Environment Variables**: Configuration management
- **Database Migrations**: Version-controlled schema changes
- **Health Checks**: Application monitoring
- **Rollback Strategy**: Safe deployment practices

## Troubleshooting

### Common Issues
1. **Database Connection**: Check connection strings and credentials
2. **Job Failures**: Monitor cron job logs
3. **Performance Issues**: Check query execution plans
4. **Memory Usage**: Monitor MongoDB and PostgreSQL memory
5. **API Errors**: Check authentication and validation

### Debug Tools
- **Query Logging**: Enable SQL query logging
- **Performance Monitoring**: Database performance metrics
- **Error Tracking**: Comprehensive error logging
- **Health Endpoints**: System status monitoring

## Support

For technical support or questions about the analytics system:
- **Documentation**: This README and inline code comments
- **Logs**: Check application and database logs
- **Monitoring**: Use health check endpoints
- **Issues**: Report bugs and feature requests
